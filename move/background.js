// 🏃 Передвижение в бою — фон. Работает у каждого игрока и у мастера:
//  • инструмент «Передвижение»: тащишь токен — за ним рисуется путь по клеткам, как в Foundry VTT
//    (зелёный — хватает скорости, жёлтый — нужен рывок, красный — не дойти), у курсора — сколько пройдено и осталось;
//  • обычное перетаскивание тоже считается (по прямой от прошлой позиции);
//  • в начале хода токена (по трекеру инициативы) пройденное сбрасывается;
//  • под токеном, чей сейчас ход, висит «🏃 15 / 30 фт» и пунктир пройденного пути; на иконке расширения — остаток.
import OBR, { buildCurve, buildLabel } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  NS, KEY, CFG, CH, INIT, LS_TOK, LS_DIFF, LAYERS, COL, curTurn, isTurnOf, tokName, getM, blank,
  perTurn, maxMove, leftOf, fmt, pushMove, stepCells, gridInfo, undoMove,
} from "./lib.js";

const TOOL = NS + "/tool", MODE = NS + "/drag", CTX = NS + "/bind", ICON = "/move/icon.svg", TAG = "🏃 move";
let me = "", isGM = false, sceneOn = false, items = [], T = null, cfg = {};
let G = { dpi: 150, mul: 5, unit: "фт", meas: "CHEBYSHEV", sq: true };
const tried = new Set();
const P2 = p => ({ x: p.x, y: p.y });
const ls = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const bound = () => { try { return JSON.parse(ls(LS_TOK) || "null"); } catch (e) { return null; } };
const setBound = b => { try { localStorage.setItem(LS_TOK, JSON.stringify(b)); } catch (e) {} };
const diffK = () => (ls(LS_DIFF) === "1" ? 2 : 1);

// ── запись данных токена (без прав — через мастера) ──
async function write(id, m, pos) {
  try {
    await OBR.scene.items.updateItems([id], ds => { for (const d of ds) { d.metadata[KEY] = m; if (pos) d.position = P2(pos); } });
  } catch (e) {
    if (!isGM) OBR.broadcast.sendMessage(CH, { op: "set", id, m, pos: pos || null }).catch(() => {});
  }
}

// ── «мой токен» ──
async function bind(it) {
  setBound({ id: it.id, name: tokName(it) });
  if (!getM(it)) await write(it.id, { ...blank(), pos: P2(it.position), key: T && isTurnOf(tokName(it), T) ? T.key : "" });
}
async function ensureBound() {
  if (isGM) return;
  const b = bound(), chars = items.filter(i => LAYERS.includes(i.layer));
  if (b && chars.some(i => i.id === b.id)) return;
  if (b && b.name) {   // другая сцена — ищем свой токен по имени
    const f = chars.find(i => tokName(i) === b.name && (i.createdUserId === me || getM(i)));
    if (f) setBound({ id: f.id, name: b.name });
    return;
  }
  const mine = chars.filter(i => i.createdUserId === me);
  if (mine.length === 1) await bind(mine[0]);   // ровно один свой токен — выбираем сами
}

// ── расстояние по прямой (обычное перетаскивание) ──
async function straight(a, b, dg = 0) {
  if (G.sq) {
    const s = stepCells(Math.round((b.x - a.x) / G.dpi), Math.round((b.y - a.y) / G.dpi), G.meas, dg);
    return { ft: s.c * G.mul, dg: s.dg };
  }
  try { return { ft: (await OBR.scene.grid.getDistance(a, b)) * G.mul, dg }; }
  catch (e) { return { ft: Math.hypot(b.x - a.x, b.y - a.y) / G.dpi * G.mul, dg }; }
}

// ── начало хода и учёт обычных перемещений ──
async function process() {
  const b = bound();
  for (const it of items) {
    if (!LAYERS.includes(it.layer)) continue;
    const m = getM(it); if (!m) continue;
    const p = it.position, mine = !!b && b.id === it.id;
    if (T && m.key !== T.key && isTurnOf(tokName(it), T) && (isGM || mine)) {   // начался ход этого токена
      const k = it.id + "|" + T.key;
      if (tried.has(k)) continue;
      tried.add(k);
      await write(it.id, { ...m, used: 0, ex: 0, dash: 0, dg: 0, tr: [], key: T.key, pos: P2(p) });
      continue;
    }
    // передвинули обычным инструментом — считает только тот, кто двигал
    if (it.lastModifiedUserId !== me || (D && D.id === it.id)) continue;
    if (m.pos && Math.hypot(p.x - m.pos.x, p.y - m.pos.y) < 1) continue;
    const k = it.id + "|" + it.lastModified;
    if (tried.has(k)) continue;
    tried.add(k);
    if (!m.pos || !T || m.key !== T.key) { await write(it.id, { ...m, pos: P2(p) }); continue; }   // не его ход — не считаем
    const c = await straight(m.pos, p, m.dg || 0), ft = c.ft * diffK();
    await write(it.id, { ...m, used: (+m.used || 0) + ft, dg: c.dg, tr: pushMove(m.tr, { p: [P2(m.pos), P2(p)], d: ft, g: m.dg || 0 }), pos: P2(p) });
  }
}

// ── примитивы (локальные объекты: видит только этот игрок, по сети не ходят) ──
function curve(pts, color, w, op, layer = "DRAWING", dash = [], closed = false) {
  const P = pts.map(P2), it = buildCurve().points(P).build();
  it.points = P; it.position = { x: 0, y: 0 };
  it.style = { fillColor: color, fillOpacity: closed ? op * 0.35 : 0, strokeColor: color, strokeOpacity: op, strokeWidth: w, strokeDash: dash, tension: 0, closed };
  it.layer = layer; it.locked = true; it.disableHit = true; it.name = TAG; it.zIndex = Date.now();
  return it;
}
function ring(c, r, color, op, layer = "RULER") {
  const pts = [];
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); }
  return curve(pts, color, G.dpi * 0.035, op, layer, [], true);
}
function label(text, pos, color, dir) {
  const it = buildLabel().plainText(text).build();
  it.position = P2(pos); it.layer = "TEXT"; it.locked = true; it.disableHit = true; it.name = TAG; it.zIndex = Date.now() + 50;
  const ts = it.text && it.text.style;
  if (ts) { ts.fontSize = Math.round(G.dpi * 0.17); ts.fillColor = color; ts.fontWeight = 600; ts.padding = Math.round(G.dpi * 0.04); }
  if (it.style) { it.style.backgroundColor = "#0f172a"; it.style.backgroundOpacity = 0.85; it.style.pointerDirection = dir; it.style.pointerHeight = 0; it.style.cornerRadius = Math.round(G.dpi * 0.06); }
  return it;
}

// ── подпись и пройденный путь у того, чей сейчас ход ──
const shown = new Map();   // id токена → {sig, ids}
async function overlay(it, m) {
  let bb = null;
  try { bb = await OBR.scene.items.getItemBounds([it.id]); } catch (e) {}
  const cx = bb ? bb.center.x : it.position.x, by = bb ? bb.max.y : it.position.y + G.dpi / 2;
  const used = +m.used || 0, mx = maxMove(m);
  const col = used > mx + 0.01 ? COL.over : used > perTurn(m) + 0.01 ? COL.dash : COL.ok;
  const out = [label(`🏃 ${fmt(used)} / ${fmt(mx)} ${G.unit}${m.dash ? `  💨×${m.dash}` : ""}`, { x: cx, y: by + G.dpi * 0.04 }, col, "UP")];
  for (const mv of m.tr) if (mv.p && mv.p.length > 1) out.push(curve(mv.p, COL.trail, G.dpi * 0.045, 0.6, "DRAWING", [G.dpi * 0.1, G.dpi * 0.08]));
  return out;
}
async function render() {
  const want = new Map();
  if (T) for (const it of items) {
    if (!LAYERS.includes(it.layer) || (!isGM && it.visible === false)) continue;
    const m = getM(it); if (!m || m.key !== T.key) continue;
    want.set(it.id, { it, m, sig: JSON.stringify([it.position, it.scale, m.used, m.sp, m.ex, m.x2, m.dash, m.tr, G.dpi, G.unit]) });
  }
  const del = [];
  for (const [id, s] of shown) if (!want.has(id) || want.get(id).sig !== s.sig) { del.push(...s.ids); shown.delete(id); }
  if (del.length) await OBR.scene.local.deleteItems(del).catch(() => {});
  const add = [];
  for (const [id, w] of want) {
    if (shown.has(id)) continue;
    const parts = await overlay(w.it, w.m);
    shown.set(id, { sig: w.sig, ids: parts.map(p => p.id) });
    add.push(...parts);
  }
  if (add.length) await OBR.scene.local.addItems(add).catch(e => console.warn("[move] overlay", e));
}

// ── остаток на иконке расширения ──
let lastBadge = null;
async function badge() {
  const b = bound(), it = b && items.find(i => i.id === b.id), m = it && getM(it);
  const on = !!(m && T && m.key === T.key), txt = on ? fmt(Math.max(0, leftOf(m))) : "";
  const key = txt + (on && leftOf(m) < 0 ? "!" : "");
  if (key === lastBadge) return;
  lastBadge = key;
  try {
    await OBR.action.setBadgeText(txt || undefined);
    if (txt) await OBR.action.setBadgeBackgroundColor(leftOf(m) < 0 ? COL.over : leftOf(m) < 0.01 ? "#64748b" : "#16a34a");
  } catch (e) {}
}

let busy = false, again = false;
async function kick() {
  if (busy) { again = true; return; }
  busy = true;
  try { do { again = false; if (!sceneOn) break; await ensureBound(); await process(); await render(); await badge(); } while (again); }
  catch (e) { console.warn("[move]", e); }
  finally { busy = false; }
}

// ── линейка при перетаскивании (как в Foundry VTT) ──
let D = null;
// клетки пути: возврат в уже пройденную клетку обрезает петлю, быстрые рывки мыши заполняются по клеткам
function extend(path, c) {
  let last = path[path.length - 1];
  if (c.i === last.i && c.j === last.j) return;
  const k0 = path.findIndex(q => q.i === c.i && q.j === c.j);
  if (k0 >= 0) { path.length = k0 + 1; return; }
  let { i, j } = last;
  while (i !== c.i || j !== c.j) {
    i += Math.sign(c.i - i); j += Math.sign(c.j - j);
    const k = path.findIndex(q => q.i === i && q.j === j);
    if (k >= 0) path.length = k + 1; else path.push({ i, j });
  }
}
function simplify(pts) {   // убираем промежуточные точки на прямых участках
  if (pts.length < 3) return pts.map(P2);
  const out = [P2(pts[0])];
  for (let k = 1; k < pts.length - 1; k++) {
    const a = out[out.length - 1], b = pts[k], c = pts[k + 1];
    if (Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) > 1) out.push(P2(b));
  }
  out.push(P2(pts[pts.length - 1]));
  return out;
}
function mkRuler(d) {
  const w = G.dpi * 0.09, s = d.s;
  d.ui = {
    shadow: curve([s, s], "#0f172a", w * 1.9, 0.45, "RULER"),
    free: curve([s, s], COL.free, w, 0, "RULER"),
    ok: curve([s, s], COL.ok, w, 0, "RULER"),
    dash: curve([s, s], COL.dash, w, 0, "RULER"),
    over: curve([s, s], COL.over, w, 0, "RULER"),
    start: ring(s, G.dpi * 0.12, "#e2e8f0", 0.9),
  };
  d.lab = null;
  return Object.values(d.ui);
}
function cls(d, tot) {
  if (!d.active) return "free";
  if (tot <= d.avail + 0.01) return "ok";
  return tot <= d.avail + d.per + 0.01 ? "dash" : "over";
}
async function drawRuler(d) {
  const { pts, cost, end } = d.plan, used0 = d.active ? d.used0 : 0;
  const seg = { free: null, ok: null, dash: null, over: null };
  for (let k = 1; k < pts.length; k++) {
    const c = cls(d, used0 + cost[k]);
    if (!seg[c]) seg[c] = [k - 1, k]; else seg[c][1] = k;
  }
  const ids = Object.values(d.ui).map(i => i.id);
  await OBR.scene.local.updateItems(ids, ds => {
    for (const x of ds) {
      if (x.id === d.ui.shadow.id) { x.points = pts.length > 1 ? pts.map(P2) : [P2(d.s), P2(d.s)]; continue; }
      for (const c of Object.keys(seg)) if (x.id === d.ui[c].id) {
        const r = seg[c];
        x.points = r ? pts.slice(r[0], r[1] + 1).map(P2) : [P2(d.s), P2(d.s)];
        x.style.strokeOpacity = r ? 0.95 : 0;
      }
    }
  });
  // подпись у конца пути
  const tot = cost[end], full = used0 + cost[pts.length - 1];
  let t = `${fmt(tot)} ${G.unit}`;
  if (d.active) {
    const rest = d.avail - used0 - tot;
    if (rest >= -0.01) t += ` · осталось ${fmt(rest)}`;
    if (full > d.avail + 0.01) t += full <= d.avail + d.per + 0.01 ? " · 💨 нужен рывок" : ` · ✋ не хватает ${fmt(full - d.avail)}`;
    if (end < pts.length - 1) t += " · стоп";
  } else if (d.m && T) t += " · не твой ход";
  if (d.k > 1) t = "🌿 " + t;
  const col = d.active ? COL[cls(d, used0 + cost[pts.length - 1])] : COL.free;
  if (D !== d || (d.lab && d.labT === t + col)) return;
  const old = d.lab;
  d.lab = label(t, { x: pts[end].x, y: pts[end].y - G.dpi * 0.6 }, col, "DOWN"); d.labT = t + col;
  await OBR.scene.local.addItems([d.lab]).catch(() => {});
  if (old) await OBR.scene.local.deleteItems([old.id]).catch(() => {});
  if (D !== d) OBR.scene.local.deleteItems([d.lab.id]).catch(() => {});
}
async function plan(d, p) {
  const raw = { x: p.x + d.off.x, y: p.y + d.off.y };
  let pts, cost = [0], dgs = null;
  if (G.sq) {
    extend(d.cells, { i: Math.round((raw.x - d.s.x) / G.dpi), j: Math.round((raw.y - d.s.y) / G.dpi) });
    pts = d.cells.map(c => ({ x: d.s.x + c.i * G.dpi, y: d.s.y + c.j * G.dpi }));
    let dg = d.m ? d.m.dg || 0 : 0, ft = 0;
    dgs = [dg];
    for (let k = 1; k < d.cells.length; k++) {
      const st = stepCells(d.cells[k].i - d.cells[k - 1].i, d.cells[k].j - d.cells[k - 1].j, G.meas, dg);
      dg = st.dg; ft += st.c * G.mul * d.k; cost.push(ft); dgs.push(dg);
    }
  } else {   // шестиугольная сетка — по прямой
    let q = raw;
    try { q = await OBR.scene.grid.snapPosition(raw, 1, false, true); } catch (e) {}
    let c;
    try { c = (await OBR.scene.grid.getDistance(d.s, q)) * G.mul * d.k; } catch (e) { c = Math.hypot(q.x - d.s.x, q.y - d.s.y) / G.dpi * G.mul * d.k; }
    pts = [P2(d.s), P2(q)]; cost.push(c);
  }
  let end = pts.length - 1;
  if (d.active && cfg.hard) while (end > 0 && d.used0 + cost[end] > d.avail + 0.01) end--;   // жёсткий лимит мастера
  return { pts, cost, dgs, end };
}
async function stepTo(d, p) {
  const pl = await plan(d, p);
  if (D !== d) return;
  d.plan = pl;
  d.update(x => { x.position = P2(pl.pts[pl.end]); });
  await drawRuler(d);
}
function dragStart(ev) {
  if (D) dragCancel();
  const it = ev && ev.target;
  if (!it || !LAYERS.includes(it.layer) || (it.locked && !isGM)) return;
  const m = getM(it), active = !!(m && T && m.key === T.key), s = P2(it.position);
  const d = {
    id: it.id, m, active, s, k: diffK(), cells: [{ i: 0, j: 0 }], plan: null, busy: false, pend: null,
    off: { x: s.x - ev.pointerPosition.x, y: s.y - ev.pointerPosition.y },
    used0: m ? +m.used || 0 : 0, avail: m ? maxMove(m) : 0, per: m ? perTurn(m) : 0,
  };
  D = d;
  d.ready = (async () => {
    const r = await OBR.interaction.startItemInteraction(it);
    d.update = r[0]; d.stop = r[1];
    await OBR.scene.local.addItems(mkRuler(d));
  })().catch(e => { console.warn("[move] drag", e); d.failed = true; });
  d.ready.then(() => { if (D === d && !d.failed) dragMove(ev); });
}
async function dragMove(ev) {
  const d = D;
  if (!d || !d.update || !ev || !ev.pointerPosition) return;
  d.pend = P2(ev.pointerPosition);
  if (d.busy) return;
  d.busy = true;
  try { while (D === d && d.pend) { const p = d.pend; d.pend = null; await stepTo(d, p); } }
  catch (e) { console.warn("[move] drag", e); }
  finally { d.busy = false; }
}
async function clearRuler(d) {
  const ids = [...(d.ui ? Object.values(d.ui).map(i => i.id) : []), ...(d.lab ? [d.lab.id] : [])];
  if (ids.length) await OBR.scene.local.deleteItems(ids).catch(() => {});
}
async function dragEnd() {
  const d = D; if (!d) return;
  D = null;
  await d.ready;
  if (d.failed) return;
  await clearRuler(d);
  const pl = d.plan;
  if (pl && pl.end > 0) {
    const pts = pl.pts.slice(0, pl.end + 1), ft = pl.cost[pl.end], to = P2(pts[pts.length - 1]);
    try {
      await OBR.scene.items.updateItems([d.id], ds => {
        for (const x of ds) {
          x.position = to;
          const m = getM(x); if (!m) continue;
          if (d.active && T && m.key === T.key) {
            m.tr = pushMove(m.tr, { p: simplify(pts), d: ft, g: m.dg || 0 });
            m.used = (+m.used || 0) + ft;
            if (pl.dgs) m.dg = pl.dgs[pl.end];
          }
          m.pos = to;
          x.metadata[KEY] = m;
        }
      });
    } catch (e) { console.warn("[move] commit", e); }
  }
  try { d.stop(); } catch (e) {}
}
async function dragCancel() {
  const d = D; if (!d) return;
  D = null;
  await d.ready;
  await clearRuler(d);
  try { if (d.stop) d.stop(); } catch (e) {}
}
async function undoMine() {
  let id = bound() && bound().id;
  if (isGM || !id) { const sel = (await OBR.player.getSelection()) || []; if (sel.length) id = sel[0]; }
  if (id) undoMove(id);
}

async function setup() {
  await OBR.tool.create({ id: TOOL, icons: [{ icon: ICON, label: "Передвижение — линейка хода" }], defaultMode: MODE });
  await OBR.tool.createMode({
    id: MODE,
    icons: [{ icon: ICON, label: "Тащи токен", filter: { activeTools: [TOOL] } }],
    cursors: [{ cursor: "grab" }],
    onToolDragStart: (_, ev) => { dragStart(ev); },
    onToolDragMove: (_, ev) => { dragMove(ev); },
    onToolDragEnd: () => { dragEnd(); },
    onToolDragCancel: () => { dragCancel(); },
    onToolClick: (_, ev) => {
      if (ev && ev.target && LAYERS.includes(ev.target.layer)) OBR.player.select([ev.target.id]).catch(() => {});
      return false;
    },
    onKeyDown: (_, ev) => {
      if (ev.key === "Escape" && D) dragCancel();
      else if ((ev.ctrlKey || ev.metaKey) && (ev.key === "z" || ev.key === "Z" || ev.key === "я" || ev.key === "Я")) undoMine();
    },
  });
  await OBR.contextMenu.create({
    id: CTX,
    icons: [{ icon: ICON, label: "🏃 Мой токен (передвижение)", filter: { every: [{ key: "layer", value: "CHARACTER" }], max: 1 } }],
    onClick: ctx => { const it = ctx.items && ctx.items[0]; if (it) bind(it).then(kick); },
  });
}

OBR.onReady(async () => {
  me = await OBR.player.getId();
  isGM = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(p => { const g = p.role === "GM"; if (g !== isGM) { isGM = g; kick(); } });
  const md = await OBR.room.getMetadata();
  T = curTurn(md[INIT]); cfg = md[CFG] || {};
  OBR.room.onMetadataChange(md => {
    const nt = curTurn(md[INIT]), changed = (nt && nt.key) !== (T && T.key);
    T = nt; cfg = md[CFG] || {};
    if (changed) kick();
  });
  // игрок без прав на токен присылает изменения — записывает мастер
  OBR.broadcast.onMessage(CH, async ev => {
    const q = ev.data || {};
    if (!isGM || q.op !== "set" || !q.id || !q.m) return;
    try {
      await OBR.scene.items.updateItems(i => i.id === q.id && LAYERS.includes(i.layer), ds => {
        for (const d of ds) { d.metadata[KEY] = q.m; if (q.pos) d.position = P2(q.pos); }
      });
    } catch (e) {}
  });
  try { await setup(); } catch (e) { console.warn("[move] setup", e); }
  const start = async () => {
    sceneOn = await OBR.scene.isReady();
    shown.clear();
    if (!sceneOn) { items = []; lastBadge = null; badge(); return; }
    G = await gridInfo();
    items = await OBR.scene.items.getItems();
    kick();
  };
  OBR.scene.onReadyChange(start);
  OBR.scene.items.onChange(list => { items = list; kick(); });
  OBR.scene.grid.onChange(async () => { G = await gridInfo(); kick(); });
  addEventListener("storage", e => { if (e.key === LS_TOK || e.key === LS_DIFF) kick(); });
  start();
});
