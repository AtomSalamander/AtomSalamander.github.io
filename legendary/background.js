// Фон: работает у каждого игрока и показывает надпись, когда мастер её объявляет.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { CH, POP, THEMES } from "./const.js";

let hideTimer = 0;

async function show(m) {
  const boss = String(m.boss || "").slice(0, 80);
  const act = String(m.act || "").slice(0, 120);
  if (!boss || !act) return;
  const theme = THEMES[m.theme] ? m.theme : "gold";
  const dur = Math.max(2000, Math.min(15000, +m.dur || 5000));
  const cost = Math.max(0, Math.min(3, +m.cost || 0));

  let w = 1200, h = 800;
  try { w = await OBR.viewport.getWidth(); h = await OBR.viewport.getHeight(); } catch (e) {}

  const q = new URLSearchParams({ boss, act, theme, dur: String(dur), cost: String(cost), n: String(Date.now()) });
  const width = Math.max(320, Math.min(780, w - 32));
  const height = 250;

  clearTimeout(hideTimer);
  await OBR.popover.close(POP).catch(() => {});
  await OBR.popover.open({
    id: POP,
    url: `/legendary/banner.html?${q}`,
    width, height,
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
    anchorReference: "POSITION",
    anchorPosition: { left: w / 2, top: Math.max(height / 2 + 16, h * 0.3) },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
  }).catch(e => console.warn("[legendary] popover", e));
  hideTimer = setTimeout(() => OBR.popover.close(POP).catch(() => {}), dur + 900);
}

OBR.onReady(() => {
  OBR.broadcast.onMessage(CH, ev => {
    const m = ev.data;
    if (m && m.op === "show") show(m);
    if (m && m.op === "hide") { clearTimeout(hideTimer); OBR.popover.close(POP).catch(() => {}); }
  });
});
