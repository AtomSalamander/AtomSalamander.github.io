// Выбор точек кликом по карте (только у мастера). pickPoints({n, labels}) → [{x, y, tok}] | null (Esc / ПКМ — отмена)
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { DPI, circle, line } from "./engine.js";
import { NS, PAL } from "./const.js";

const TOOL = NS + "/pick", MODE = NS + "/pick-mode", ICON = "/emergence/icon.svg";
let S = null;
const note = m => OBR.notification.show(m).catch(() => {});
const isRight = ev => !!ev && (ev.button === 2 || ev.buttons === 2 || (ev.nativeEvent && (ev.nativeEvent.button === 2 || ev.nativeEvent.buttons === 2)));

async function charTokens() {
  try {
    const its = await OBR.scene.items.getItems(i => (i.layer === "CHARACTER" || i.layer === "MOUNT") && i.visible !== false);
    const out = [];
    for (const it of its) { try { const b = await OBR.scene.items.getItemBounds([it.id]); out.push({ id: it.id, x: b.center.x, y: b.center.y, r: Math.max(b.width, b.height) / 2 }); } catch (e) {} }
    return out;
  } catch (e) { return []; }
}
async function finish(res) {
  const s = S; S = null; if (!s) return;
  try { if (s.ids.length) await OBR.scene.local.deleteItems(s.ids); } catch (e) {}
  try { if (s.prev && s.prev !== TOOL) await OBR.tool.activateTool(s.prev); } catch (e) {}
  try { await OBR.tool.removeMode(MODE); } catch (e) {}
  try { await OBR.tool.remove(TOOL); } catch (e) {}
  s.done(res);
}
export const picking = () => !!S;
export function cancelPick() { return finish(null); }

export async function pickPoints({ n = 1, labels = [], snap = true } = {}) {
  if (S) await finish(null);
  const toks = snap ? await charTokens() : [];
  return new Promise(async done => {
    const s = S = { n, pts: [], ids: [], done, prev: null };
    const hint = () => note(`🎯 ${labels[s.pts.length] || "Кликни точку"} (${s.pts.length + 1}/${n}) · Esc — отмена`);
    const click = async ev => {
      if (S !== s) return;
      const p = ev.pointerPosition; if (!p) return;
      let tok = null;
      const tg = ev.target && toks.find(t => t.id === ev.target.id);
      if (tg) tok = tg; else if (snap) { let best = 1e9; for (const t of toks) { const d = Math.hypot(t.x - p.x, t.y - p.y); if (d <= t.r && d < best) { best = d; tok = t; } } }
      const pt = tok ? { x: tok.x, y: tok.y, tok: tok.id } : { x: p.x, y: p.y, tok: null };
      s.pts.push(pt);
      const m = circle({ x: pt.x, y: pt.y, r: DPI * .3, stroke: PAL.cy2, so: .95, sw: DPI * .05, fill: PAL.cy, fo: .2 });
      const m2 = line({ pts: [{ x: pt.x - DPI * .2, y: pt.y }, { x: pt.x + DPI * .2, y: pt.y }], stroke: PAL.white, so: .9, sw: DPI * .03 });
      s.ids.push(m.id, m2.id);
      try { await OBR.scene.local.addItems([m, m2]); } catch (e) {}
      if (s.pts.length >= s.n) setTimeout(() => finish(s.pts), 120); else hint();
    };
    try { s.prev = await OBR.tool.getActiveTool(); } catch (e) {}
    try {
      await OBR.tool.create({ id: TOOL, icons: [{ icon: ICON, label: "Эмерджентность: выбор точки" }], defaultMode: MODE });
      await OBR.tool.createMode({
        id: MODE,
        icons: [{ icon: ICON, label: "Точка", filter: { activeTools: [TOOL] } }],
        cursors: [{ cursor: "crosshair" }],
        onToolDown: (_, ev) => { if (isRight(ev)) { finish(null); return false; } },
        onToolClick: (_, ev) => { if (isRight(ev)) { finish(null); return false; } click(ev); return false; },
        onKeyDown: (_, ev) => { if (ev.key === "Escape") finish(null); },
        onDeactivate: () => { if (S === s) finish(null); },
      });
      await OBR.tool.activateTool(TOOL);
      try { await OBR.tool.activateMode(TOOL, MODE); } catch (e) {}
      hint();
    } catch (e) { console.warn("[emergence] pick", e); finish(null); }
  });
}
