// 🏃 Передвижение в бою: общие ключи, правила расчёта и запись данных токена.
// Используется и фоном (background.js), и панелью (panel.js).
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";

export const NS = "com.dnd-move";
export const KEY = NS + "/m";                        // метаданные токена: скорость и пройденное за ход
export const CFG = NS + "/cfg";                      // метаданные комнаты: настройки мастера {hard, snap}
export const CH = NS + "/msg";                       // канал: игрок → мастер (если у игрока нет прав на токен)
export const INIT = "com.dnd-tracker/initiative";    // данные трекера инициативы {r, chips:[{n, on}]}
export const LS_TOK = "dndmove_tok";                 // localStorage: «мой токен» {id, name}
export const LS_DIFF = "dndmove_diff";               // localStorage: трудная местность для следующих перемещений
export const LS_LBL = "dndmove_lbl";                 // localStorage: "0" — не показывать подпись под токеном
export const snapOn = cfg => !cfg || cfg.snap !== false;   // прилипание к клеткам (настройка мастера, по умолчанию вкл.)
export const LAYERS = ["CHARACTER", "MOUNT"];
export const DEF_SPEED = 30;
export const COL = { ok: "#4ade80", dash: "#facc15", over: "#f87171", free: "#93c5fd", trail: "#cbd5e1" };

// ── имена и инициатива (как в моде эффектов: «Гоблин 2» = «Гоблин») ──
export function norm(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е")
    .replace(/\s*[×x]\s*\d+\s*$/u, "")
    .replace(/[\s#№]*\d+\s*$/u, "")
    .replace(/\s+/g, " ").trim();
}
export function matchChip(name, chips) {
  const x = norm(name); if (!x || !Array.isArray(chips)) return null;
  let c = chips.find(c => norm(c.n) === x);
  if (!c) c = chips.find(c => { const y = norm(c.n); return y && (x.startsWith(y) || y.startsWith(x)); });
  return c ? String(c.n) : null;
}
// Текущий ход: {r, i, w — имя в трекере, key — уникальный ключ хода, chips} или null, если боя нет
export function curTurn(P) {
  const chips = P && Array.isArray(P.chips) ? P.chips : [];
  const i = chips.findIndex(c => c && c.on);
  if (i < 0) return null;
  const r = Number(P.r) || 1, w = String(chips[i].n);
  return { r, i, w, key: `${r}:${i}:${w}`, chips };
}
export const isTurnOf = (name, T) => !!T && matchChip(name, T.chips) === T.w;
export const tokName = it => ((it && it.text && it.text.plainText) || "").trim() || (it && it.name) || "без имени";

// ── данные токена ──
// sp — скорость, ex — доп. скорость на этот ход, x2 — удвоение (Ускорение), dash — сколько рывков,
// used — пройдено за ход, key — ключ хода, tr — перемещения хода [{p:[точки], d: фт, g: диагоналей до}],
// pos — последняя учтённая позиция, dg — диагоналей за ход (для правила 5-10-5)
export function blank(sp) { return { sp: sp || DEF_SPEED, ex: 0, x2: false, dash: 0, used: 0, key: "", tr: [], pos: null, dg: 0 }; }
export function getM(it) {
  const m = it && it.metadata && it.metadata[KEY];
  if (!m || typeof m !== "object") return null;
  const o = { ...blank(), ...m };
  o.tr = Array.isArray(m.tr) ? m.tr.map(t => ({ ...t, p: (t.p || []).map(q => ({ x: q.x, y: q.y })) })) : [];
  return o;
}
export const perTurn = m => Math.max(0, ((+m.sp || 0) + (+m.ex || 0)) * (m.x2 ? 2 : 1));
export const maxMove = m => perTurn(m) * (1 + (+m.dash || 0));
export const leftOf = m => maxMove(m) - (+m.used || 0);
export const fmt = v => String(Math.round((+v || 0) * 10) / 10).replace(".", ",");
export function pushMove(tr, mv) { const t = [...(tr || []), mv]; return t.length > 30 ? t.slice(-30) : t; }

// ── стоимость шага по квадратной сетке (в клетках) ──
// meas — правило диагоналей Owlbear: CHEBYSHEV (5 фт), ALTERNATING (5-10-5), EUCLIDEAN, MANHATTAN
// dg — сколько диагоналей уже пройдено за ход (для 5-10-5)
export function stepCells(dx, dy, meas, dg = 0) {
  const ax = Math.abs(dx), ay = Math.abs(dy), diag = Math.min(ax, ay), str = Math.max(ax, ay) - diag;
  if (meas === "EUCLIDEAN") return { c: Math.hypot(ax, ay), dg };
  if (meas === "MANHATTAN") return { c: ax + ay, dg };
  if (meas === "ALTERNATING") return { c: str + diag + Math.floor(((dg % 2) + diag) / 2), dg: dg + diag };
  return { c: str + diag, dg };
}

// ── без прилипания: расстояние в клетках (дробное) по тому же правилу диагоналей ──
export function freeCells(dx, dy, meas) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (meas === "EUCLIDEAN") return Math.hypot(ax, ay);
  if (meas === "MANHATTAN") return ax + ay;
  if (meas === "ALTERNATING") return Math.max(ax, ay) + Math.min(ax, ay) / 2;
  return Math.max(ax, ay);
}

// ── настройки сетки сцены ──
export async function gridInfo() {
  const G = { dpi: 150, mul: 5, unit: "фт", meas: "CHEBYSHEV", sq: true };
  try {
    const [dpi, sc, meas, type] = await Promise.all([
      OBR.scene.grid.getDpi(), OBR.scene.grid.getScale(), OBR.scene.grid.getMeasurement(), OBR.scene.grid.getType(),
    ]);
    const p = (sc && sc.parsed) || {};
    G.dpi = dpi || 150; G.mul = p.multiplier || 5; G.meas = meas || "CHEBYSHEV"; G.sq = !type || type === "SQUARE";
    G.unit = !p.unit || /^(ft|feet|фт)$/i.test(p.unit) ? "фт" : p.unit;
  } catch (e) {}
  return G;
}

// Записать данные токена. Если у игрока нет прав на токен — просим фон мастера записать за нас.
export async function saveM(id, m, pos) {
  try {
    await OBR.scene.items.updateItems([id], ds => {
      for (const d of ds) { d.metadata[KEY] = m; if (pos) d.position = { x: pos.x, y: pos.y }; }
    });
    return true;
  } catch (e) {
    try { await OBR.broadcast.sendMessage(CH, { op: "set", id, m, pos: pos || null }); } catch (e2) {}
    return false;
  }
}

// Отменить последнее перемещение за ход: токен возвращается в начало шага, расстояние вычитается
export async function undoMove(id) {
  const [it] = await OBR.scene.items.getItems([id]);
  const m = getM(it); if (!m || !m.tr.length) return false;
  const mv = m.tr.pop(), p = mv.p[0] || m.pos;
  m.used = Math.max(0, (+m.used || 0) - (+mv.d || 0));
  m.dg = mv.g || 0;
  m.pos = { x: p.x, y: p.y };
  return saveM(id, m, p);
}

// Сбросить пройденное за ход (токен остаётся на месте)
export async function resetMove(id) {
  const [it] = await OBR.scene.items.getItems([id]);
  const m = getM(it); if (!m) return false;
  return saveM(id, { ...m, used: 0, dg: 0, tr: [], pos: { x: it.position.x, y: it.position.y } });
}
