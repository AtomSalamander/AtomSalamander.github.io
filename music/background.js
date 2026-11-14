// Фон: работает у каждого игрока.
// У мастера дополнительно опрашивает Kenku FM и записывает текущий трек в метаданные комнаты.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  META, CH, POP, POP_MOVE, LS_CFG, LS_POS, LS_STATUS, LS_SEEN, LS_HIDDEN,
  DEF_CFG, DEF_POS, SIZE, POLL_MS,
} from "./const.js";
import { readKenku, explain } from "./kenku.js";

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// Все операции с окнами выполняем по очереди, чтобы они не перебивали друг друга.
let queue = Promise.resolve();
const run = fn => (queue = queue.then(fn).catch(e => console.warn("[music]", e)));

let cur = null;        // текущий трек из комнаты
let shown = null;      // "big" | "small" | null — что сейчас открыто

async function viewport() {
  let w = 1280, h = 800;
  try { w = await OBR.viewport.getWidth(); h = await OBR.viewport.getHeight(); } catch (e) {}
  return { w, h };
}

function position(size, w, h) {
  const p = { ...DEF_POS, ...(ls.get(LS_POS, {}) || {}) };
  return {
    right: Math.round(Math.max(0, Math.min(w - size.w, +p.right || 0))),
    bottom: Math.round(Math.max(0, Math.min(h - size.h, +p.bottom || 0))),
  };
}

const hidden = () => cur && ls.get(LS_HIDDEN) === cur.id;

async function openPlate(mode) {
  if (!cur || hidden()) return closePlate();
  const { w, h } = await viewport();
  const size = SIZE[mode];
  const pos = position(size, w, h);
  const q = new URLSearchParams({
    mode, title: cur.title, pl: cur.playlist, p: cur.playing ? "1" : "0",
    big: String(cur.big), n: String(Date.now()),
  });
  shown = mode;
  await OBR.popover.close(POP).catch(() => {});
  await OBR.popover.open({
    id: POP,
    url: `/music/plate.html?${q}`,
    width: size.w,
    height: size.h,
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
    anchorReference: "POSITION",
    anchorPosition: { left: w - pos.right, top: h - pos.bottom },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
  }).catch(e => console.warn("[music] popover", e));
}

async function closePlate() {
  shown = null;
  await OBR.popover.close(POP).catch(() => {});
}

async function openMove() {
  const { w, h } = await viewport();
  const pos = position(SIZE.small, w, h);
  await closePlate();
  await OBR.popover.open({
    id: POP_MOVE,
    url: `/music/move.html?r=${pos.right}&b=${pos.bottom}`,
    width: w,
    height: h,
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
    anchorReference: "POSITION",
    anchorPosition: { left: w / 2, top: h / 2 },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
  }).catch(e => console.warn("[music] move", e));
}

async function closeMove() {
  await OBR.popover.close(POP_MOVE).catch(() => {});
  if (cur && !hidden()) await openPlate("small");
}

// ---------- реакция на трек в комнате ----------
async function onTrack(m) {
  if (!m || typeof m !== "object" || !m.id || !m.title) {
    if (cur) { cur = null; await closePlate(); }
    return;
  }
  const prev = cur;
  cur = {
    id: String(m.id),
    title: String(m.title).slice(0, 160),
    playlist: String(m.playlist || "").slice(0, 80),
    playing: m.playing !== false,
    big: Math.max(2, Math.min(60, +m.big || 6)),
  };
  if (prev && ["id", "title", "playlist", "playing", "big"].every(k => prev[k] === cur[k])) return;
  if (!prev || prev.id !== cur.id) { if (ls.get(LS_HIDDEN) && ls.get(LS_HIDDEN) !== cur.id) ls.del(LS_HIDDEN); }
  if (hidden()) { if (shown) await closePlate(); return; }

  const fresh = ls.get(LS_SEEN) !== cur.id;
  ls.set(LS_SEEN, cur.id);
  await openPlate(fresh && cur.playing ? "big" : "small");
}

// ---------- опрос Kenku (только у мастера) ----------
let isGM = false, timer = 0, lastKey;

async function publish(track) {
  await OBR.room.setMetadata({ [META]: track ? { ...track, t: Date.now() } : null });
}

async function poll() {
  clearTimeout(timer);
  if (!isGM) return;
  const cfg = { ...DEF_CFG, ...(ls.get(LS_CFG, {}) || {}) };
  if (!cfg.on) {
    ls.set(LS_STATUS, { state: "off", at: Date.now() });
    if (lastKey !== "off") { lastKey = "off"; await publish(null).catch(() => {}); }
  } else {
    try {
      const t = await readKenku(cfg.url);
      ls.set(LS_STATUS, { state: "ok", at: Date.now(), track: t });
      const key = t ? `${t.id}|${t.playing}|${t.title}` : "none";
      if (key !== lastKey) {
        await publish(t ? { ...t, big: cfg.big } : null);
        lastKey = key;
      }
    } catch (e) {
      ls.set(LS_STATUS, { state: "err", at: Date.now(), err: explain(e) });
    }
  }
  timer = setTimeout(poll, POLL_MS);
}

async function setRole(role) {
  const gm = role === "GM";
  if (gm === isGM) return;
  isGM = gm;
  lastKey = undefined;
  if (isGM) poll(); else clearTimeout(timer);
}

// ---------- запуск ----------
OBR.onReady(async () => {
  OBR.broadcast.onMessage(CH, ev => {
    const m = ev.data || {};
    switch (m.op) {
      case "compact": if (cur && shown) run(() => openPlate("small")); break;
      case "expand":  if (cur) run(() => openPlate("big")); break;
      case "close":   if (cur) ls.set(LS_HIDDEN, cur.id); run(closePlate); break;
      case "move":    run(openMove); break;
      case "place":
        if (Number.isFinite(+m.right) && Number.isFinite(+m.bottom)) ls.set(LS_POS, { right: +m.right, bottom: +m.bottom });
        run(closeMove); break;
      case "cancelMove": run(closeMove); break;
      case "reshow":  ls.del(LS_HIDDEN); if (cur) run(() => openPlate("small")); break;
      case "resetPos": ls.del(LS_POS); if (cur && shown) run(() => openPlate(shown)); break;
      case "poll":    if (isGM) { lastKey = undefined; poll(); } break;
    }
  });

  OBR.room.onMetadataChange(md => run(() => onTrack(md[META])));
  OBR.player.onChange(p => setRole(p.role));

  try { await setRole(await OBR.player.getRole()); } catch (e) {}
  try { const md = await OBR.room.getMetadata(); run(() => onTrack(md[META])); } catch (e) {}
});
