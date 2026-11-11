// Прицел для заклинаний по области (как в Baldur's Gate 3):
// превью сферы / конуса следует за курсором, токены внутри подсвечиваются,
// клик по карте — применить, Esc — отмена. Работает в фоне и рисует только у того, кто целится.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS } from "./const.js";
import { grid, prim, tokens } from "./engine.js";

const TOOL = NS + "/aim", MODE = NS + "/aim-mode", ICON = "/fx/icon.svg";
const TAU = Math.PI * 2;
let S = null;   // текущий прицел

const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); };
const tokName = it => (it.text && it.text.plainText || "").trim() || it.name || "без имени";

export async function feetPerCell() {
  try { const s = await OBR.scene.grid.getScale(); return (s && s.parsed && s.parsed.multiplier) || 5; } catch (e) { return 5; }
}

// все токены сцены (персонажи и «маунты»); игрокам — только видимые
async function sceneTokens(isGM) {
  const items = await OBR.scene.items.getItems(i => (i.layer === "CHARACTER" || i.layer === "MOUNT") && (isGM || i.visible !== false));
  const info = await tokens(items.map(i => i.id));
  return items.filter(i => info[i.id]).map(i => ({ ...info[i.id], id: i.id, name: tokName(i) }));
}

// геометрия области для точки курсора p
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

let busy = false, pend = null;
async function move(p) {
  if (!S || !p) return;
  pend = p; if (busy) return;
  busy = true;
  try { while (pend && S) { const q = pend; pend = null; await draw(q); } }
  catch (e) { console.warn("[fx] aim", e); }
  finally { busy = false; }
}
async function draw(p) {
  const g = shape(p), s = S; s.last = g;
  const lit = new Set(g.inside.map(t => t.id)), ids = [...s.shapeIds];
  for (const [tid, rid] of s.rings) if (lit.has(tid) !== s.lit.has(tid)) ids.push(rid);
  s.lit = lit;
  const ringOf = new Map([...s.rings].map(([t, r]) => [r, t]));
  await OBR.scene.local.updateItems(ids, ds => {
    for (const d of ds) {
      if (ringOf.has(d.id)) { d.style.strokeOpacity = lit.has(ringOf.get(d.id)) ? 0.95 : 0; d.style.fillOpacity = lit.has(ringOf.get(d.id)) ? 0.12 : 0; continue; }
      if (d.id === s.ui.wedge) { d.position = g.o; d.points = wedge(g.ang, s.L); }
      else if (d.id === s.ui.area || d.id === s.ui.dot) d.position = { x: g.pt.x, y: g.pt.y };
      else if (d.id === s.ui.line) d.points = [{ x: 0, y: 0 }, { x: g.pt.x - s.C.x, y: g.pt.y - s.C.y }];
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
export async function cancelAim(silent) {
  const s = await cleanup();
  if (s && !silent) OBR.notification.show("🎯 Прицел отменён").catch(() => {});
}
async function fire(p) {
  if (!S) return;
  const g = shape(p || (S.last && S.last.pt) || S.C);
  const s = await cleanup();
  if (s) try { await s.onFire({ pt: { x: g.pt.x, y: g.pt.y }, targets: g.inside.map(t => ({ id: t.id, name: t.name })) }); } catch (e) { console.warn("[fx] aim fire", e); }
}

// A — способность с A.area; cId — токен «Кто»; color — цвет превью; onFire({pt, targets})
export async function startAim({ A, cId, color = "#ff7a1a", isGM = false, onFire }) {
  if (S) await cleanup();
  const DPI = await grid(), fpc = await feetPerCell(), cfg = A.area || {};
  const C = (await tokens([cId]))[cId];
  if (!C) throw new Error("caster not found");
  const toks = await sceneTokens(isGM);
  const s = {
    A, cfg, DPI, onFire, toks, C: { ...C, id: cId },
    L: (cfg.length || 15) / fpc * DPI, half: (cfg.angle ?? 53) / 2 * Math.PI / 180,
    R: (cfg.radius || 20) / fpc * DPI, range: cfg.range ? cfg.range / fpc * DPI : 0,
    ui: {}, rings: new Map(), lit: new Set(), shapeIds: [], allIds: [],
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
  }
  s.shapeIds = items.filter(i => [s.ui.wedge, s.ui.line, s.ui.area, s.ui.dot].includes(i.id)).map(i => i.id);
  for (const t of toks) {
    if (cfg.shape === "cone" && t.id === cId) continue;
    const r = prim.circle({ x: t.x, y: t.y, r: (t.r || DPI / 2) * 1.12, fill: "#ff4d4d", fo: 0, stroke: "#ff6b6b", so: 0, sw: DPI * 0.05, n: 36, z: z + 5 });
    s.rings.set(t.id, r.id); items.push(r);
  }
  s.allIds = items.map(i => i.id);
  S = s;
  await OBR.scene.local.addItems(items);
  try { s.prevTool = await OBR.tool.getActiveTool(); } catch (e) {}
  await OBR.tool.create({ id: TOOL, icons: [{ icon: ICON, label: "Прицел заклинания (Esc — отмена)" }], defaultMode: MODE });
  await OBR.tool.createMode({
    id: MODE,
    icons: [{ icon: ICON, label: "Прицел", filter: { activeTools: [TOOL] } }],
    cursors: [{ cursor: "crosshair" }],
    onToolMove: (_, ev) => { move(ev.pointerPosition); },
    onToolClick: (_, ev) => { fire(ev.pointerPosition); return false; },
    onKeyDown: (_, ev) => { if (ev.key === "Escape") cancelAim(); },
    onDeactivate: () => { if (S === s) cancelAim(); },   // переключили инструмент — отмена
  });
  await OBR.tool.activateTool(TOOL);
  try { await OBR.tool.activateMode(TOOL, MODE); } catch (e) {}
  move({ x: C.x + (cfg.shape === "cone" ? s.L : 0), y: C.y - (cfg.shape === "cone" ? 0 : DPI * 2) });
}
