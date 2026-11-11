// Панель быстрого доступа: хранение (localStorage этого браузера) и открытие поповера.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS } from "./const.js";

export const BAR = NS + "/bar", BK = "dndfx_bar";
export const TILE = 64, GAP = 6, COLS = 4, PAD = 10, HEAD = 44;

export function loadBar() {
  try {
    const b = JSON.parse(localStorage.getItem(BK));
    if (b && typeof b === "object") return { slots: Array.isArray(b.slots) ? b.slots.filter(x => x && x.a) : [], pos: b.pos || null, min: !!b.min, open: !!b.open };
  } catch (e) {}
  return { slots: [], pos: null, min: false, open: false };
}
export function saveBar(b) { try { localStorage.setItem(BK, JSON.stringify(b)); } catch (e) {} }

// размер поповера под содержимое
export function barSize(b) {
  const w = PAD * 2 + COLS * TILE + (COLS - 1) * GAP + 8;
  if (b.min) return { w: 236, h: HEAD + 8 };
  const n = b.slots.length, rows = Math.max(1, Math.ceil(n / COLS));
  return { w, h: HEAD + 8 + PAD + (n ? rows * (TILE + 18) + (rows - 1) * GAP + 26 : 64) };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export async function openBar(b = loadBar()) {
  const W = await OBR.viewport.getWidth(), H = await OBR.viewport.getHeight();
  const { w, h } = barSize(b);
  const p = b.pos || { left: Math.round(W / 2 - w / 2), top: H - h - 80 };
  b.pos = { left: Math.round(clamp(p.left, 4, Math.max(4, W - w - 4))), top: Math.round(clamp(p.top, 4, Math.max(4, H - h - 4))) };
  b.open = true; saveBar(b);
  await OBR.popover.open({
    id: BAR, url: "/fx/bar.html", width: w, height: h,
    anchorReference: "POSITION", anchorPosition: b.pos,
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    disableClickAway: true, hidePaper: true, marginThreshold: 0,
  });
}
export async function closeBar() {
  const b = loadBar(); b.open = false; saveBar(b);
  try { await OBR.popover.close(BAR); } catch (e) {}
}
// добавить слот {a, el, dur}; true — добавлен, false — уже был (обновлён)
export async function addSlot(slot) {
  const b = loadBar();
  const i = b.slots.findIndex(s => s.a === slot.a && (s.el || "") === (slot.el || ""));
  if (i >= 0) b.slots[i] = slot; else b.slots.push(slot);
  b.min = false;
  saveBar(b);
  await openBar(b);
  return i < 0;
}
