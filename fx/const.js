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
