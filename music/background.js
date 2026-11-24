// Фон: работает у каждого игрока. Следит за треком в метаданных комнаты и показывает плашку.
// Трек включает мастер из панели (просто вписывает название) — никаких внешних программ и опросов.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { META, CH, POP, POP_MOVE, LS_POS, LS_SEEN, LS_HIDDEN, DEF_POS, SIZE } from "./const.js";

const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// Все операции с окнами — по очереди, чтобы они не перебивали друг друга.
let queue = Promise.resolve();
const run = fn => (queue = queue.then(fn).catch(e => console.warn("[music]", e)));

let cur = null;        // текущий трек из комнаты
let shown = null;      // "big" | "small" | null — что сейчас открыто
let lastRaw = "";      // чтобы не разбирать одно и то же при каждом изменении метаданных комнаты

let vp = null;         // размер экрана, кэшируем на пару секунд
async function viewport() {
  if (vp && Date.now() - vp.at < 2000) return vp;
  let w = 1280, h = 800;
  try { [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]); } catch (e) {}
  return (vp = { w, h, at: Date.now() });
}

function position(size, w, h) {
  const p = { ...DEF_POS, ...(ls.get(LS_POS, {}) || {}) };
  return {
    right: Math.round(Math.max(0, Math.min(w - size.w, +p.right || 0))),
    bottom: Math.round(Math.max(0, Math.min(h - size.h, +p.bottom || 0))),
  };
}

const hidden = () => cur && ls.get(LS_HIDDEN) === cur.id;
const local = msg => OBR.broadcast.sendMessage(CH, msg, { destination: "LOCAL" }).catch(() => {});

async function openPlate(mode) {
  if (!cur || hidden()) return closePlate();
  const { w, h } = await viewport();
  const size = SIZE[mode];
  const pos = position(size, w, h);
  const q = new URLSearchParams({
    mode, title: cur.title, pl: cur.playlist, p: cur.playing ? "1" : "0",
    big: String(cur.big), id: cur.id,
  });
  if (shown) await OBR.popover.close(POP).catch(() => {});
  shown = mode;
  await OBR.popover.open({
    id: POP,
    url: `/owlbear-dnd/music/plate.html?${q}`,
    width: size.w,
    height: size.h,
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
    anchorReference: "POSITION",
    anchorPosition: { left: w - pos.right, top: h - pos.bottom },
    transformOrigin: { horizontal: "RIGHT", vertical: "BOTTOM" },
  }).catch(e => { shown = null; console.warn("[music] popover", e); });
}

async function closePlate() {
  if (!shown) return;
  shown = null;
  await OBR.popover.close(POP).catch(() => {});
}

async function openMove() {
  vp = null;
  const { w, h } = await viewport();
  const pos = position(SIZE.small, w, h);
  await closePlate();
  await OBR.popover.open({
    id: POP_MOVE,
    url: `/owlbear-dnd/music/move.html?r=${pos.right}&b=${pos.bottom}`,
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
  const newTrack = !prev || prev.id !== cur.id;
  if (newTrack && ls.get(LS_HIDDEN) && ls.get(LS_HIDDEN) !== cur.id) ls.del(LS_HIDDEN);
  if (hidden()) return closePlate();

  // тот же трек (пауза / продолжить) — не переоткрываем окно, просто обновляем плашку
  if (!newTrack && shown) return local({ op: "plateSet", id: cur.id, title: cur.title, pl: cur.playlist, p: cur.playing });

  const fresh = ls.get(LS_SEEN) !== cur.id;
  ls.set(LS_SEEN, cur.id);
  await openPlate(fresh && cur.playing ? "big" : "small");
}

function onMeta(md) {
  const m = md ? md[META] : null;
  const raw = m ? JSON.stringify(m) : "";
  if (raw === lastRaw) return;           // менялось что-то другое (инициатива, эффекты…) — нас не касается
  lastRaw = raw;
  run(() => onTrack(m));
}

// ---------- запуск ----------
OBR.onReady(async () => {
  OBR.broadcast.onMessage(CH, ev => {
    const m = ev.data || {};
    switch (m.op) {
      case "compact": if (cur && shown === "big") run(() => openPlate("small")); break;
      case "expand":  if (cur && shown !== "big") run(() => openPlate("big")); break;
      case "close":   if (cur) ls.set(LS_HIDDEN, cur.id); run(closePlate); break;
      case "move":    run(openMove); break;
      case "place":
        if (Number.isFinite(+m.right) && Number.isFinite(+m.bottom)) ls.set(LS_POS, { right: +m.right, bottom: +m.bottom });
        run(closeMove); break;
      case "cancelMove": run(closeMove); break;
      case "reshow":  ls.del(LS_HIDDEN); if (cur) run(() => openPlate("small")); break;
      case "resetPos": ls.del(LS_POS); if (cur && shown) run(() => openPlate(shown)); break;
    }
  });

  OBR.room.onMetadataChange(onMeta);
  try { onMeta(await OBR.room.getMetadata()); } catch (e) {}
});
