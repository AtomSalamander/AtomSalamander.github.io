// Чтение состояния плейлиста из Kenku FM (Settings → Remote).

const EXT = /\.(mp3|ogg|oga|wav|flac|m4a|aac|webm|opus)$/i;

export function cleanTitle(s) {
  s = String(s ?? "").trim();
  if (/^(https?|file):/i.test(s) || /[\\/]/.test(s)) {
    try { s = decodeURIComponent(s); } catch (e) {}
    s = s.split(/[\\/]/).pop() || s;
  }
  s = s.replace(EXT, "");
  if (!/\s/.test(s)) s = s.replace(/_+/g, " ");
  return s.trim().slice(0, 160);
}

// Ответ Kenku: { playing, track: { id, title, url, ... }, playlist: { id, title } }
export function parsePlayback(j) {
  const t = j && (j.track || j.currentTrack);
  if (!t) return null;
  const title = cleanTitle(t.title || t.name || t.url);
  if (!title) return null;
  const pl = j.playlist && (j.playlist.title || j.playlist.name);
  return {
    id: String(t.id || t.url || title),
    title,
    playlist: pl ? String(pl).slice(0, 80) : "",
    playing: !!j.playing,
  };
}

export async function readKenku(base, timeoutMs = 2500) {
  const root = String(base || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(root)) throw new Error("Адрес должен начинаться с http://");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${root}/v1/playlist/playback`, { cache: "no-store", signal: ctl.signal });
    if (!r.ok) throw new Error(`Kenku ответил ошибкой ${r.status}`);
    return parsePlayback(await r.json());
  } finally {
    clearTimeout(timer);
  }
}

export function explain(e) {
  if (e && e.name === "AbortError") return "Kenku не ответил вовремя";
  const m = String((e && e.message) || e || "");
  if (/Failed to fetch|NetworkError|Load failed|fetch/i.test(m))
    return "Нет связи: Kenku не запущен, Remote выключен или браузер блокирует доступ к 127.0.0.1";
  return m || "Неизвестная ошибка";
}
