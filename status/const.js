// Общие константы расширения «Статус-эффекты»
export const NS = "status-fx";
export const KEY = `${NS}/list`;          // метаданные токена: массив эффектов
export const CFG = `${NS}/cfg`;           // метаданные комнаты: настройки (размер кругляшков)
export const LIB = `${NS}.lib.v1`;        // localStorage мастера: сохранённые эффекты
export const INFO = `${NS}/info`;         // id всплывающего окошка с описанием
export const TAG = `${NS}/dot`;           // метка локальных кругляшков
export const ICON = "/status/icon.svg";

// Палитра для быстрого выбора цвета
export const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#facc15", "#22c55e", "#14b8a6",
  "#0ea5e9", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#e2e8f0",
  "#94a3b8", "#78716c", "#1f2937",
];

// Размер кругляшка в долях клетки
export const SIZES = { s: { name: "S", k: 0.15 }, m: { name: "M", k: 0.2 }, l: { name: "L", k: 0.26 } };

// Слои, на которых живут токены
export const TOKEN_LAYERS = ["CHARACTER", "MOUNT", "PROP"];

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Нормализация эффекта (всё, что пришло из метаданных или формы)
export function normFx(x) {
  if (!x || typeof x !== "object") return null;
  const name = String(x.name || "").trim().slice(0, 60);
  if (!name) return null;
  const color = /^#[0-9a-f]{6}$/i.test(x.color || "") ? x.color : "#a855f7";
  const n = x.n === "" || x.n == null || isNaN(+x.n) ? null : Math.max(-99, Math.min(999, Math.round(+x.n)));
  return {
    id: String(x.id || uid()),
    name,
    desc: String(x.desc || "").slice(0, 2000),
    color,
    icon: [...String(x.icon || "").trim()].slice(0, 2).join(""),
    n,
  };
}
export const readFx = item => (Array.isArray(item?.metadata?.[KEY]) ? item.metadata[KEY].map(normFx).filter(Boolean) : []);
export const sameFx = (a, b) => a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
// Что рисовать внутри кругляшка: счётчик → значок → первая буква
export const glyph = f => (f.n != null ? String(f.n) : f.icon || [...f.name][0].toUpperCase());

// Цвет текста под фон
export function ink(hex) {
  const v = parseInt(hex.slice(1), 16), r = v >> 16, g = (v >> 8) & 255, b = v & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#111827" : "#ffffff";
}
