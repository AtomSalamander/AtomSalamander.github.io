// Прицел (как в Baldur's Gate 3). Работает в фоне и рисует только у того, кто целится.
//  • startAim  — заклинания по области: превью сферы / конуса следует за курсором, токены внутри подсвечиваются;
//  • startPick — направленные и «касательные» заклинания: клик по токену или по месту на карте.
// Клик — применить, Shift+клик — добавить ещё цель, Enter — применить к отмеченным, Esc — отмена.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS } from "./const.js";
import { grid, prim, tokens } from "./engine.js";

const TOOL = NS + "/aim", MODE = NS + "/aim-mode", ICON = "/fx/icon.svg";
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
  if (S.attach && !S.free) {   // прикрепляемая зона: курсор над токеном — сфера «прилипает» к нему
    const t = tokAt(p);
    if (t && (!S.range || Math.hypot(t.x - C.x, t.y - C.y) <= S.range + (t.r || S.DPI / 2))) {
      const inside = S.toks.filter(o => Math.hypot(o.x - t.x, o.y - t.y) <= S.R + (o.r || S.DPI / 2) * 0.5);
      return { pt: { x: t.x, y: t.y }, inside, tok: t };
    }
  }
  let q = { x: p.x, y: p.y };
  const dx = p.x - C.x, dy = p.y - C.y, d = Math.hypot(dx, dy);
  if (S.range && d > S.range) q = { x: C.x + dx / d * S.range, y: C.y + dy / d * S.range };   // дальше дальности — прижимаем к краю
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
  const lit = new Set(g.inside.map(t => t.id)), ids = [...s.shapeIds];
  for (const [tid, rid] of s.rings) if (lit.has(tid) !== s.lit.has(tid)) ids.push(rid);
  s.lit = lit;
  await OBR.scene.local.updateItems(ids, ds => {
    for (const d of ds) {
      if (s.ringTok.has(d.id)) { const on = lit.has(s.ringTok.get(d.id)); d.style.strokeOpacity = on ? 0.95 : 0; d.style.fillOpacity = on ? 0.12 : 0; continue; }
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
  const okPoint = hov || s.allowPoint;
  await OBR.scene.local.updateItems(ids, ds => {
    for (const d of ds) {
      if (s.ringTok.has(d.id)) {
        const t = s.ringTok.get(d.id), on = want.has(t), pk = s.picked.has(t);
        d.style.strokeOpacity = on ? 0.95 : 0; d.style.fillOpacity = pk ? 0.22 : on ? 0.1 : 0;
        d.scale = t === hovId ? { x: 1.08, y: 1.08 } : { x: 1, y: 1 };
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

async function firePick(p, ev, enter) {
  const s = S; if (!s) return;
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
      s.kind === "pick" ? firePick(ev.pointerPosition, ev) : fire(ev.pointerPosition); return false;
    },
    onKeyDown: (_, ev) => {
      if (ev.key === "Escape") cancelAim();
      else if (ev.key === "Enter" && s.kind === "pick" && S === s) firePick(s.last && s.last.p, null, true);
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
  const C = (await tokens([cId]))[cId];
  if (!C) throw new Error("caster not found");
  const toks = await sceneTokens(isGM);
  const s = {
    kind: "area", A, cfg, DPI, onFire, toks, C: { ...C, id: cId }, attach: !!attach && cfg.shape !== "cone", free: false,
    L: (cfg.length || 15) / fpc * DPI, half: (cfg.angle ?? 53) / 2 * Math.PI / 180,
    R: (cfg.radius || 20) / fpc * DPI, range: cfg.range ? cfg.range / fpc * DPI : 0,
    ui: {}, rings: new Map(), ringTok: new Map(), lit: new Set(), shapeIds: [], allIds: [],
  };
  const z = Date.now() + 1000, items = [];
  if (cfg.shape === "cone") {
    const w = prim.poly({ x: C.x, y: C.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], fill: color, fo: 0.18, stroke: color, so: 0.9, sw: DPI * 0.035, dash: [DPI * 0.12, DPI * 0.07], z });
    s.ui.wedge = w.id; items.push(w);
  } else {
    if (s.range) items.push(prim.circle({ x: C.x, y: C.y, r: s.range, fill: color, fo: 0.025, stroke: color, so: 0.35, sw: DPI * 0.025, dash: [DPI * 0.2, DPI * 0.15], n: 96, z: z - 5 }));
    const ln = prim.poly({ x: C.x, y: C.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: color, so: 0.55, sw: DPI * 0.025, dash: [DPI * 0.1, DPI * 0.08], closed: false, z: z - 1 });
    const ar = prim.circle({ x: C.x, y: C.y, r: s.R, fill: color, fo: 0.16, stroke: color, so: 0.9, sw: DPI * 0.04, dash: [DPI * 0.15, DPI * 0.08], n: 72, z });
    const dt = prim.circle({ x: C.x, y: C.y, r: DPI * 0.08, fill: color, fo: 0.9, n: 12, z: z + 1 });
    s.ui.line = ln.id; s.ui.area = ar.id; s.ui.dot = dt.id; items.push(ln, ar, dt);
    if (s.attach) {
      const pin = prim.circle({ x: C.x, y: C.y, r: DPI * 0.5 * 1.3, fill: "#f3d58a", fo: 0, stroke: "#f3d58a", so: 0, sw: DPI * 0.06, dash: [DPI * 0.14, DPI * 0.08], n: 40, z: z + 2 });
      s.ui.pin = pin.id; items.push(pin);
    }
  }
  s.shapeIds = items.filter(i => [s.ui.wedge, s.ui.line, s.ui.area, s.ui.dot, s.ui.pin].includes(i.id)).map(i => i.id);
  items.push(...ringsFor(s, toks, "#ff5a5a", z, cfg.shape === "cone" ? cId : null));
  await arm(s, items, s.attach ? "Прицел: клик по токену — прикрепить, Alt+клик — в точку (ПКМ / Esc — отмена)" : "Прицел заклинания (ПКМ / Esc — отмена)",
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
  const z = Date.now() + 1000, items = [];
  if (C) {
    const ln = prim.poly({ x: C.x, y: C.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: color, so: 0.6, sw: DPI * 0.03, dash: [DPI * 0.12, DPI * 0.08], closed: false, z: z - 1 });
    s.ui.line = ln.id; items.push(ln);
  }
  const ret = prim.circle({ x: 0, y: 0, r: DPI * 0.28, fill: color, fo: 0.1, stroke: color, so: 0.9, sw: DPI * 0.035, dash: [DPI * 0.1, DPI * 0.07], n: 32, z });
  const dt = prim.circle({ x: 0, y: 0, r: DPI * 0.06, fill: color, fo: 0.9, n: 12, z: z + 1 });
  s.ui.ret = ret.id; s.ui.dot = dt.id; items.push(ret, dt);
  s.shapeIds = items.map(i => i.id);
  items.push(...ringsFor(s, toks, color, z, null));
  const c0 = C || toks[0] || { x: 0, y: 0 };
  await arm(s, items, "Выбор цели (Shift — несколько, ПКМ / Esc — отмена)", { x: c0.x + DPI * 2, y: c0.y });
}
