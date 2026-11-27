// Общие ключи мода эффектов
export const NS = "com.dnd-fx";
export const STATE = NS + "/state";          // активные эффекты (метаданные комнаты)
export const CH = NS + "/msg";               // канал сообщений
export const PANEL = NS + "/panel";
export const ALLOW = NS + "/allow";        // id способностей, разрешённых игрокам          // id закреплённой панели
export const INIT = "com.dnd-tracker/initiative"; // данные трекера инициативы

export function normState(s) {
  if (!s || !Array.isArray(s.e)) return { v: 1, e: [], p: null };
  return JSON.parse(JSON.stringify({ v: 1, e: s.e, p: s.p || null }));
}
export const SEL = "dndfx_sel";                 // localStorage: выбранные «Кто» и «Цели» (общий для панели и горячих клавиш)
export const LOOP = NS + "/loop";                 // метаданные сцены: снимок позиций токенов для «Петли времени»

// Может ли участник снять активный эффект: мастер — любой, игрок — только эффект разрешённой ему способности (галочка).
export const canEnd = (e, allow, gm) => !!gm || !!(e && allow && allow.has(e.a));
