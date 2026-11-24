// Прицел (как в Baldur's Gate 3). Работает в фоне и рисует только у того, кто целится.
//  • startAim  — заклинания по области: превью сферы / конуса следует за курсором, токены внутри подсвечиваются;
//  • startPick — направленные и «касательные» заклинания: клик по токену или по месту на карте.
// Клик — применить, Shift+клик — добавить ещё цель, Enter — применить к отмеченным, Esc — отмена.
//  • A.pick = {max, range} — выбор нескольких целей как в BG3 (Благословение): клик отмечает/снимает,
//    счётчик-«пипсы» у курсора, на max целей заклинание срабатывает само, Enter — раньше, Backspace — снять последнюю.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS } from "./const.js";
import { grid, prim, tokens } from "./engine.js";

const TOOL = NS + "/aim", MODE = NS + "/aim-mode", ICON = "/owlbear-dnd/fx/icon.svg";
const TAU = Math.PI * 2;
let S = null;   // текущий прицел

const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); };
const tokName = it => (it.text && it.text.plainText || "").trim() || it.name || "без имени";
const note = m => OBR.notification.show(m).catch(() => {});

export async function feetPerCell() {
  try { const s = await OBR.scene.grid.getScale(); return (s && s.parsed && s.parsed.multiplier) || 5; } catch (e) { return 5; }
}

// все токены сцены (персонажи и «маунты»); игрокам — только видимые
async function sceneTokens(isGM) {
  const items = await OBR.scene.items.getItems(i => (i.layer === "CHARACTER" || i.layer === "MOUNT") && (isGM || i.visible !== false));
  const info = await tokens(items.map(i => i.id));
  return items.filter(i => info[i.id]).map(i => ({ ...info[i.id], id: i.id, name: tokName(i) }));
}

// ── область: геометрия для точки курсора p ──
function shape(p) {
  const { C } = S;
  if (S.cfg.shape === "cone") {
    const ang = Math.atan2(p.y - C.y, p.x - C.x) || 0, r0 = (C.r || S.DPI / 2) * 0.6;
    const ox = C.x + Math.cos(ang) * r0, oy = C.y + Math.sin(ang) * r0;
    const inside = S.toks.filter(t => {
      if (t.id === C.id) return false;
      const dx = t.x - ox, dy = t.y - oy, d = Math.hypot(dx, dy), tr = (t.r || S.DPI / 2) * 0.5;
      if (d > S.L + tr) return false;
      if (d < tr) return true;
      return angDiff(Math.atan2(dy, dx), ang) <= S.half + Math.asin(Math.min(1, tr / d));
    });
    return { ang, o: { x: ox, y: oy }, pt: { x: ox + Math.cos(ang) * S.L * 0.6, y: oy + Math.sin(ang) * S.L * 0.6 }, inside };
  }
  if ((S.attach || S.snap) && !S.free) {   // прикрепляемая зона / area.snap: курсор над токеном — сфера «прилипает» к нему
    const t = tokAt(p);
    if (t && (!S.range || Math.hypot(t.x - C.x, t.y - C.y) <= S.range + (t.r || S.DPI / 2))) {
      const inside = S.toks.filter(o => Math.hypot(o.x - t.x, o.y - t.y) <= S.R + (o.r || S.DPI / 2) * 0.5);
      return { pt: { x: t.x, y: t.y }, inside, tok: t };
    }
  }
  let q = { x: p.x, y: p.y };
  const dx = p.x - C.x, dy = p.y - C.y, d = Math.hypot(dx, dy);
  if (S.range && d > S.range) q = { x: C.x + dx / d * S.range, y: C.y + dy / d * S.range };   // дальше дальности — прижимаем к краю
  if (S.cfg.line) {   // линия шириной W от заклинателя до точки (Шов Порога) — заклинатель не задевается
    const lx = q.x - C.x, ly = q.y - C.y, l2 = lx * lx + ly * ly || 1;
    const inside = S.toks.filter(t => {
      if (t.id === C.id) return false;
      const k = Math.max(0, Math.min(1, ((t.x - C.x) * lx + (t.y - C.y) * ly) / l2));
      return Math.hypot(t.x - C.x - lx * k, t.y - C.y - ly * k) <= S.W / 2 + (t.r || S.DPI / 2) * 0.5;
    });
    return { pt: q, inside };
  }
  const inside = S.toks.filter(t => Math.hypot(t.x - q.x, t.y - q.y) <= S.R + (t.r || S.DPI / 2) * 0.5);
  return { pt: q, inside };
}

const wedge = (ang, len) => {
  const pts = [{ x: 0, y: 0 }];
  for (let k = 0; k <= 16; k++) { const a = ang - S.half + 2 * S.half * k / 16; pts.push({ x: Math.cos(a) * len, y: Math.sin(a) * len }); }
  return pts;
};

// токен под курсором (ближайший центр в пределах радиуса)
function tokAt(p) {
  let best = null, bd = Infinity;
  for (const t of S.toks) {
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d <= (t.r || S.DPI / 2) && d < bd) { bd = d; best = t; }
  }
  return best;
}

let busy = false, pend = null;
async function move(p) {
  if (!S || !p) return;
  pend = p; if (busy) return;
  busy = true;
  try { while (pend && S) { const q = pend; pend = null; await (S.kind === "pick" ? drawPick(q) : draw(q)); } }
  catch (e) { console.warn("[fx] aim", e); }
  finally { busy = false; }
}
async function draw(p) {
  const g = shape(p), s = S; s.last = g;
  const lit = new Set([...g.inside, ...(s.placed || []).flatMap(q => q.inside)].map(t => t.id)), ids = [...s.shapeIds];
  for (const [tid, rid] of s.rings) if (lit.has(tid) !== s.lit.has(tid)) ids.push(rid);
  s.lit = lit;
  await OBR.scene.local.updateItems(ids, ds => {
    for (const d of ds) {
      if (s.ringTok.has(d.id)) { const on = lit.has(s.ringTok.get(d.id)); d.style.strokeOpacity = on ? 0.95 : 0; d.style.fillOpacity = on ? 0.12 : 0; continue; }
      if (s.pipIdx && s.pipIdx.has(d.id)) {   // несколько точек (Метеоритный дождь): кружки-счётчик под прицелом
        const k = s.pipIdx.get(d.id), n = s.count;
        d.position = { x: g.pt.x + (k - (n - 1) / 2) * s.DPI * 0.3, y: g.pt.y + s.DPI * 0.42 };
        d.style.fillOpacity = k < s.placed.length ? 0.95 : 0.15; d.style.strokeOpacity = 0.95;
        continue;
      }
      if (d.id === s.ui.wedge) { d.position = g.o; d.points = wedge(g.ang, s.L); }
      else if (d.id === s.ui.area || d.id === s.ui.dot) d.position = { x: g.pt.x, y: g.pt.y };
      else if (d.id === s.ui.line) d.points = [{ x: 0, y: 0 }, { x: g.pt.x - s.C.x, y: g.pt.y - s.C.y }];
      else if (d.id === s.ui.pin) {   // золотое кольцо вокруг токена, к которому прикрепится зона
        if (g.tok) { const k = (g.tok.r || s.DPI / 2) / (s.DPI / 2); d.position = { x: g.tok.x, y: g.tok.y }; d.scale = { x: k, y: k }; }
        d.style.strokeOpacity = g.tok ? 0.95 : 0; d.style.fillOpacity = g.tok ? 0.15 : 0;
      }
    }
  });
}

// ── выбор цели: подсветка токена под курсором и отмеченных Shift'ом ──
async function drawPick(p, force) {
  const s = S, hov = tokAt(p);
  const q = hov ? { x: hov.x, y: hov.y } : { x: p.x, y: p.y };
  s.last = { p: { x: p.x, y: p.y }, hov };
  const want = new Set(s.picked); if (hov) want.add(hov.id);
  const hovId = hov ? hov.id : null, ids = [...s.shapeIds];
  for (const [tid, rid] of s.rings) if (force || want.has(tid) !== s.lit.has(tid) || (tid === hovId) !== (tid === s.hovId)) ids.push(rid);
  s.lit = want; s.hovId = hovId;
  const okPoint = s.multi ? !!hov && !s.far.has(hov.id) : hov || s.allowPoint;
  const pk = [...s.picked];
  await OBR.scene.local.updateItems(ids, ds => {
    for (const d of ds) {
      if (s.ringTok.has(d.id)) {
        const t = s.ringTok.get(d.id), on = want.has(t), pk = s.picked.has(t);
        d.style.strokeOpacity = on ? 0.95 : 0; d.style.fillOpacity = pk ? 0.22 : on ? 0.1 : 0;
        d.scale = t === hovId ? { x: 1.08, y: 1.08 } : { x: 1, y: 1 };
        continue;
      }
      if (s.pipIdx && s.pipIdx.has(d.id)) {   // счётчик целей: n кружков под прицелом, отмеченные — залиты
        const k = s.pipIdx.get(d.id), n = s.multi, on = k < pk.length;
        d.position = { x: q.x + (k - (n - 1) / 2) * s.DPI * (n > 6 ? 0.17 : 0.22), y: q.y + s.DPI * 0.5 };
        d.style.fillOpacity = on ? 0.95 : 0.15; d.style.strokeOpacity = 0.95;
        continue;
      }
      if (s.tethIdx && s.tethIdx.has(d.id)) {   // золотые нити от заклинателя к отмеченным целям
        const t = s.byId.get(pk[s.tethIdx.get(d.id)]);
        if (t) d.points = [{ x: 0, y: 0 }, { x: t.x - s.C.x, y: t.y - s.C.y }];
        d.style.strokeOpacity = t ? 0.75 : 0;
        continue;
      }
      if (d.id === s.ui.ret || d.id === s.ui.dot) {
        d.position = q;
        d.style.strokeOpacity = d.id === s.ui.ret ? (hov ? 0 : okPoint ? 0.9 : 0.25) : 0;
        d.style.fillOpacity = d.id === s.ui.dot ? (hov ? 0 : okPoint ? 0.9 : 0.25) : (hov ? 0 : 0.1);
      } else if (d.id === s.ui.line) {
        d.points = [{ x: 0, y: 0 }, { x: q.x - s.C.x, y: q.y - s.C.y }];
        d.style.strokeOpacity = okPoint ? 0.6 : 0.2;
      }
    }
  });
}

async function cleanup() {
  const s = S; S = null; pend = null;
  if (!s) return null;
  try { await OBR.scene.local.deleteItems(s.allIds); } catch (e) {}
  try { if (s.prevTool && s.prevTool !== TOOL) await OBR.tool.activateTool(s.prevTool); } catch (e) {}
  try { await OBR.tool.removeMode(MODE); } catch (e) {}
  try { await OBR.tool.remove(TOOL); } catch (e) {}
  return s;
}
export async function cancelAim() { await cleanup(); }

// правая кнопка мыши (поля события зависят от версии Owlbear — проверяем все варианты)
const isRight = ev => !!ev && (ev.button === 2 || ev.buttons === 2 ||
  (ev.nativeEvent && (ev.nativeEvent.button === 2 || ev.nativeEvent.buttons === 2)));
export const aiming = () => !!S;

async function fire(p) {
  if (!S) return;
  const g = shape(p || (S.last && S.last.pt) || S.C);
  const s = await cleanup();
  if (s) try { await s.onFire({ pt: { x: g.pt.x, y: g.pt.y }, targets: g.inside.map(t => ({ id: t.id, name: t.name })), tok: g.tok ? { id: g.tok.id, name: g.tok.name } : null }); } catch (e) { console.warn("[fx] aim fire", e); }
}

// ── несколько сфер, каждая в своей точке (A.area.count — Метеоритный дождь) ──
// клик — поставить сферу; набрали count — запуск; Enter — запустить раньше (недостающие встанут рядом сами);
// Backspace — убрать последнюю
async function place(p) {
  const s = S; if (!s || s.firing || !p) return;
  const g = shape(p), k = s.placed.length, sl = s.ui.slots[k];
  if (!sl) return;
  s.placed.push({ pt: { x: g.pt.x, y: g.pt.y }, inside: g.inside });
  await OBR.scene.local.updateItems([sl.a, sl.d], ds => {
    for (const d of ds) { d.position = { x: g.pt.x, y: g.pt.y }; if (d.id === sl.a) { d.style.strokeOpacity = 0.9; d.style.fillOpacity = 0.12; } else d.style.fillOpacity = 0.9; }
  });
  if (s.placed.length >= s.count) return fireMany(s);
  move(p);
}
async function unplace() {
  const s = S; if (!s || !s.placed.length) return;
  s.placed.pop();
  const sl = s.ui.slots[s.placed.length];
  await OBR.scene.local.updateItems([sl.a, sl.d], ds => { for (const d of ds) { d.style.strokeOpacity = 0; d.style.fillOpacity = 0; } });
  move((s.last && s.last.pt) || s.C);
}
async function fireMany(s) {
  if (S !== s || s.firing) return;
  s.firing = true;
  const pl = s.placed.length ? [...s.placed] : s.last ? [{ pt: s.last.pt, inside: s.last.inside }] : [{ pt: { x: s.C.x, y: s.C.y }, inside: [] }];
  // не все точки поставлены — недостающие сферы ложатся вокруг поставленных, не дальше полутора радиусов
  const base = pl.map(q => q.pt), miss = s.count - pl.length, a0 = Math.random() * Math.PI * 2;
  for (let j = 0; j < miss; j++) {   // равномерно по кругу вокруг поставленных точек (по очереди)
    const b = base[j % base.length], a = a0 + j / miss * Math.PI * 2 + (Math.random() - 0.5) * 0.6, d = s.R * (1.05 + Math.random() * 0.45);
    const pt = { x: b.x + Math.cos(a) * d, y: b.y + Math.sin(a) * d };
    pl.push({ pt, inside: s.toks.filter(t => Math.hypot(t.x - pt.x, t.y - pt.y) <= s.R + (t.r || s.DPI / 2) * 0.5) });
  }
  const tg = new Map();
  for (const q of pl) for (const t of q.inside) tg.set(t.id, { id: t.id, name: t.name });
  await cleanup();
  try { await s.onFire({ pt: pl[0].pt, pts: pl.map(q => ({ x: Math.round(q.pt.x * 10) / 10, y: Math.round(q.pt.y * 10) / 10 })), targets: [...tg.values()], tok: null }); }
  catch (e) { console.warn("[fx] aim fire", e); }
}

// ── выбор нескольких целей (как в BG3) ──
function hovFrom(s, p, ev) {
  const it = ev && ev.target;
  if (it && s.byId.has(it.id)) return s.byId.get(it.id);
  if (it && s.ringTok.has(it.id)) return s.byId.get(s.ringTok.get(it.id));
  return p ? tokAt(p) : null;
}
async function fireMulti(s) {
  if (S !== s || s.firing) return;
  s.firing = true;
  const targets = [...s.picked].map(id => s.byId.get(id)).filter(Boolean).map(t => ({ id: t.id, name: t.name }));
  await cleanup();
  try { await s.onFire({ pt: null, targets }); } catch (e) { console.warn("[fx] pick fire", e); }
}
async function pickMulti(s, p, ev, enter) {
  if (s.firing) return;
  if (enter) return s.picked.size ? fireMulti(s) : note(`Отметь хотя бы одну цель (до ${s.multi})`);
  const hov = hovFrom(s, p, ev);
  if (!hov) return;
  if (s.far.has(hov.id)) return note(`Слишком далеко — дальность ${s.A.pick.range} фт`);
  if (s.picked.has(hov.id)) s.picked.delete(hov.id);   // повторный клик — снять отметку
  else if (s.picked.size < s.multi) s.picked.add(hov.id);
  await drawPick(p || hov, true);
  if (s.picked.size >= s.multi) setTimeout(() => fireMulti(s), 250);   // набрали все цели — применяем сами
}

async function firePick(p, ev, enter) {
  const s = S; if (!s) return;
  if (s.multi) return pickMulti(s, p, ev, enter);
  let hov = null;
  if (!enter) {
    const it = ev && ev.target;
    if (it && s.byId.has(it.id)) hov = s.byId.get(it.id);
    else if (it && s.ringTok.has(it.id)) hov = s.byId.get(s.ringTok.get(it.id));
    else if (p) hov = tokAt(p);
    if (ev && ev.shiftKey) {   // Shift+клик — отметить / снять отметку и продолжить выбор
      if (!hov) return;
      s.picked.has(hov.id) ? s.picked.delete(hov.id) : s.picked.add(hov.id);
      return drawPick(p, true);
    }
  }
  const set = new Map([...s.picked].map(id => [id, s.byId.get(id)]).filter(x => x[1]));
  if (hov) set.set(hov.id, hov);
  if (!set.size) {
    if (enter) return;
    if (!s.allowPoint) return note("Кликни по токену (Shift+клик — несколько целей)");
  }
  await cleanup();
  try {
    await s.onFire({ pt: set.size ? null : { x: p.x, y: p.y }, targets: [...set.values()].map(t => ({ id: t.id, name: t.name })) });
  } catch (e) { console.warn("[fx] pick fire", e); }
}

// общий запуск инструмента-прицела
async function arm(s, items, label, first) {
  s.allIds = items.map(i => i.id);
  S = s;
  await OBR.scene.local.addItems(items);
  try { s.prevTool = await OBR.tool.getActiveTool(); } catch (e) {}
  await OBR.tool.create({ id: TOOL, icons: [{ icon: ICON, label }], defaultMode: MODE });
  await OBR.tool.createMode({
    id: MODE,
    icons: [{ icon: ICON, label: "Прицел", filter: { activeTools: [TOOL] } }],
    cursors: [{ cursor: "crosshair" }],
    onToolMove: (_, ev) => { s.free = !!(ev && ev.altKey); move(ev.pointerPosition); },   // Alt — не прилипать к токенам
    onToolDown: (_, ev) => { if (isRight(ev)) { cancelAim(); return false; } },   // ПКМ по карте — отмена
    onToolClick: (_, ev) => {
      if (isRight(ev)) { cancelAim(); return false; }
      if (s.kind !== "pick") s.free = !!(ev && ev.altKey);
      s.kind === "pick" ? firePick(ev.pointerPosition, ev) : s.count ? place(ev.pointerPosition) : fire(ev.pointerPosition); return false;
    },
    onKeyDown: (_, ev) => {
      if (ev.key === "Escape") cancelAim();
      else if (ev.key === "Enter" && s.kind === "pick" && S === s) firePick(s.last && s.last.p, null, true);
      else if (ev.key === "Enter" && s.count && S === s) fireMany(s);
      else if (ev.key === "Backspace" && s.count && S === s) unplace();
      else if (ev.key === "Backspace" && s.multi && S === s && s.picked.size) { s.picked.delete([...s.picked].pop()); drawPick((s.last && s.last.p) || s.C || { x: 0, y: 0 }, true); }
    },
    onDeactivate: () => { if (S === s) cancelAim(); },   // переключили инструмент — отмена
  });
  await OBR.tool.activateTool(TOOL);
  try { await OBR.tool.activateMode(TOOL, MODE); } catch (e) {}
  move(first);
}

function ringsFor(s, toks, color, z, skip) {
  const items = [];
  for (const t of toks) {
    if (skip && t.id === skip) continue;
    const r = prim.circle({ x: t.x, y: t.y, r: (t.r || s.DPI / 2) * 1.12, fill: color, fo: 0, stroke: color, so: 0, sw: s.DPI * 0.05, n: 36, z: z + 5 });
    s.rings.set(t.id, r.id); s.ringTok.set(r.id, t.id); items.push(r);
  }
  return items;
}

// A — способность с A.area; cId — токен «Кто»; color — цвет превью; onFire({pt, targets, tok})
// attach — клик по токену прикрепляет зону к нему (tok = {id, name}), Alt+клик — в точку
export async function startAim({ A, cId, color = "#ff7a1a", isGM = false, attach = false, onFire }) {
  if (S) await cleanup();
  const DPI = await grid(), fpc = await feetPerCell(), cfg = A.area || {};
  let C = cId ? (await tokens([cId]))[cId] : null;
  const noC = !C;
  if (noC && !(cfg.free && cfg.shape !== "cone")) throw new Error("caster not found");
  if (noC) {   // area.free: заклинатель не нужен — прицел стартует из центра экрана, без линии и дальности
    C = { x: 0, y: 0, r: DPI / 2 };
    try { const W = await OBR.viewport.getWidth(), H = await OBR.viewport.getHeight(), q = await OBR.viewport.inverseTransformPoint({ x: W / 2, y: H / 2 }); C = { x: q.x, y: q.y, r: DPI / 2 }; } catch (e) {}
  }
  const toks = await sceneTokens(isGM);
  const s = {
    kind: "area", A, cfg, DPI, onFire, toks, C: { ...C, id: noC ? null : cId }, attach: !!attach && cfg.shape !== "cone", snap: !!cfg.snap && cfg.shape !== "cone", free: false,
    L: (cfg.length || 15) / fpc * DPI, half: (cfg.angle ?? 53) / 2 * Math.PI / 180,
    R: (cfg.radius || 20) / fpc * DPI, range: cfg.range && !noC ? cfg.range / fpc * DPI : 0, W: (cfg.line || 0) / fpc * DPI,
    count: cfg.shape !== "cone" && cfg.count > 1 ? Math.round(cfg.count) : 0, placed: [],
    ui: {}, rings: new Map(), ringTok: new Map(), lit: new Set(), shapeIds: [], allIds: [],
  };
  const z = Date.now() + 1000, items = [];
  if (cfg.shape === "cone") {
    const w = prim.poly({ x: C.x, y: C.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], fill: color, fo: 0.18, stroke: color, so: 0.9, sw: DPI * 0.035, dash: [DPI * 0.12, DPI * 0.07], z });
    s.ui.wedge = w.id; items.push(w);
  } else {
    if (s.range) items.push(prim.circle({ x: C.x, y: C.y, r: s.range, fill: color, fo: 0.025, stroke: color, so: 0.35, sw: DPI * 0.025, dash: [DPI * 0.2, DPI * 0.15], n: 96, z: z - 5 }));
    const ln = prim.poly({ x: C.x, y: C.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: color, so: noC ? 0 : cfg.line ? 0.3 : 0.55, sw: cfg.line ? s.W : DPI * 0.025, dash: cfg.line ? [] : [DPI * 0.1, DPI * 0.08], closed: false, z: z - 1 });
    const ar = prim.circle({ x: C.x, y: C.y, r: s.R, fill: color, fo: 0.16, stroke: color, so: 0.9, sw: DPI * 0.04, dash: [DPI * 0.15, DPI * 0.08], n: 72, z });
    const dt = prim.circle({ x: C.x, y: C.y, r: DPI * 0.08, fill: color, fo: 0.9, n: 12, z: z + 1 });
    s.ui.line = ln.id; s.ui.area = ar.id; s.ui.dot = dt.id; items.push(ln, ar, dt);
    if (s.count) {   // поставленные сферы (скрыты, пока не кликнули) и счётчик точек под прицелом
      s.ui.slots = []; s.pipIdx = new Map();
      for (let k = 0; k < s.count; k++) {
        const a = prim.circle({ x: C.x, y: C.y, r: s.R, fill: color, fo: 0, stroke: color, so: 0, sw: DPI * 0.05, n: 72, z: z - 3 });
        const d = prim.circle({ x: C.x, y: C.y, r: DPI * 0.12, fill: color, fo: 0, n: 12, z: z - 2 });
        s.ui.slots.push({ a: a.id, d: d.id }); items.push(a, d);
      }
      for (let k = 0; k < s.count; k++) {
        const pp = prim.circle({ x: C.x, y: C.y, r: DPI * 0.09, fill: color, fo: 0.15, stroke: "#fff1d0", so: 0.95, sw: DPI * 0.022, n: 14, z: z + 3 + k });
        s.pipIdx.set(pp.id, k); items.push(pp);
      }
    }
    if (s.attach || s.snap) {
      const pin = prim.circle({ x: C.x, y: C.y, r: DPI * 0.5 * 1.3, fill: "#f3d58a", fo: 0, stroke: "#f3d58a", so: 0, sw: DPI * 0.06, dash: [DPI * 0.14, DPI * 0.08], n: 40, z: z + 2 });
      s.ui.pin = pin.id; items.push(pin);
    }
  }
  s.shapeIds = items.filter(i => [s.ui.wedge, s.ui.line, s.ui.area, s.ui.dot, s.ui.pin].includes(i.id) || (s.pipIdx && s.pipIdx.has(i.id))).map(i => i.id);
  items.push(...ringsFor(s, toks, "#ff5a5a", z, cfg.shape === "cone" ? cId : null));
  if (s.count) note(`${A.icon || "✨"} ${A.name}: кликни до ${s.count} точек удара · Enter — запустить сразу · Backspace — убрать последнюю · Esc — отмена`);
  await arm(s, items, s.count ? `${A.name}: клик — точка удара (до ${s.count}), Enter — запустить, Backspace — убрать последнюю (ПКМ / Esc — отмена)`
    : s.attach ? "Прицел: клик по токену — прикрепить, Alt+клик — в точку (ПКМ / Esc — отмена)"
    : s.snap ? "Прицел: наведи на цель — область встанет на неё, Alt+клик — в точку (ПКМ / Esc — отмена)" : "Прицел заклинания (ПКМ / Esc — отмена)",
    { x: C.x + (cfg.shape === "cone" ? s.L : 0), y: C.y - (cfg.shape === "cone" ? 0 : DPI * 2) });
}

// Выбор цели кликом: по токену (Shift — несколько) или по месту (allowPoint).
// cId — заклинатель (может не быть: тогда без линии); onFire({pt|null, targets})
export async function startPick({ A, cId, color = "#b48cff", isGM = false, allowPoint = true, onFire }) {
  if (S) await cleanup();
  const DPI = await grid();
  const C = cId ? (await tokens([cId]))[cId] : null;
  if (cId && !C) throw new Error("caster not found");
  const toks = await sceneTokens(isGM);
  const s = {
    kind: "pick", A, DPI, onFire, toks, allowPoint, C: C ? { ...C, id: cId } : null,
    byId: new Map(toks.map(t => [t.id, t])), picked: new Set(), hovId: null,
    ui: {}, rings: new Map(), ringTok: new Map(), lit: new Set(), shapeIds: [], allIds: [],
  };
  const pk = A && A.pick && A.pick.max > 1 ? A.pick : null;
  if (pk) {   // BG3-выбор: до max целей, дальше дальности — нельзя
    s.multi = pk.max; s.allowPoint = false; s.far = new Set();
    s.range = pk.range && C ? pk.range / (await feetPerCell()) * DPI : 0;
    if (s.range) for (const t of toks) if (Math.hypot(t.x - C.x, t.y - C.y) > s.range + (t.r || DPI / 2) * 0.5) s.far.add(t.id);
  }
  const z = Date.now() + 1000, items = [];
  if (C) {
    const ln = prim.poly({ x: C.x, y: C.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: color, so: 0.6, sw: DPI * 0.03, dash: [DPI * 0.12, DPI * 0.08], closed: false, z: z - 1 });
    s.ui.line = ln.id; items.push(ln);
  }
  const ret = prim.circle({ x: 0, y: 0, r: DPI * 0.28, fill: color, fo: 0.1, stroke: color, so: 0.9, sw: DPI * 0.035, dash: [DPI * 0.1, DPI * 0.07], n: 32, z });
  const dt = prim.circle({ x: 0, y: 0, r: DPI * 0.06, fill: color, fo: 0.9, n: 12, z: z + 1 });
  s.ui.ret = ret.id; s.ui.dot = dt.id; items.push(ret, dt);
  if (s.multi) {
    s.pipIdx = new Map(); s.tethIdx = new Map();
    if (C) for (let k = 0; k < s.multi; k++) {
      const tl = prim.poly({ x: C.x, y: C.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: color, so: 0, sw: DPI * 0.025, dash: [DPI * 0.06, DPI * 0.06], closed: false, z: z - 2 });
      s.tethIdx.set(tl.id, k); items.push(tl);
    }
    for (let k = 0; k < s.multi; k++) {
      const pp = prim.circle({ x: 0, y: 0, r: DPI * 0.075, fill: color, fo: 0.15, stroke: "#fff6d8", so: 0.95, sw: DPI * 0.02, n: 16, z: z + 2 + k });
      s.pipIdx.set(pp.id, k); items.push(pp);
    }
  }
  s.shapeIds = items.map(i => i.id);
  if (s.range) items.push(prim.circle({ x: C.x, y: C.y, r: s.range, fill: color, fo: 0.03, stroke: color, so: 0.4, sw: DPI * 0.025, dash: [DPI * 0.2, DPI * 0.15], n: 96, z: z - 5 }));
  const rs = ringsFor(s, toks, color, z, null);
  if (s.far) for (const r of rs) if (s.far.has(s.ringTok.get(r.id))) { r.style.strokeColor = "#8c8c8c"; r.style.fillColor = "#8c8c8c"; r.style.strokeDash = [DPI * 0.08, DPI * 0.08]; }
  items.push(...rs);
  const c0 = C || toks[0] || { x: 0, y: 0 };
  await arm(s, items, s.multi
    ? `${A.name}: до ${s.multi} целей — клик отметить/снять, Enter — применить, Backspace — снять последнюю (ПКМ / Esc — отмена)`
    : "Выбор цели (Shift — несколько, ПКМ / Esc — отмена)", { x: c0.x + DPI * 2, y: c0.y });
  if (s.multi) note(`${A.icon || "✨"} ${A.name}: отметь до ${s.multi} целей${s.range ? ` в пределах ${pk.range} фт` : ""} · Enter — применить раньше · Esc — отмена`);
}
