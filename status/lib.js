// Общие функции для панели и окошка: библиотека мастера и правка эффектов на токенах
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { KEY, LIB, TOKEN_LAYERS, normFx, readFx, sameFx, uid } from "./const.js";
import { GROUPS } from "./conditions.js";

// ── библиотека мастера (localStorage браузера мастера) ──
export function loadLib() {
  try { const v = JSON.parse(localStorage.getItem(LIB) || "[]"); return Array.isArray(v) ? v.map(normFx).filter(Boolean) : []; }
  catch (e) { return []; }
}
export function saveLib(list) { localStorage.setItem(LIB, JSON.stringify(list.map(normFx).filter(Boolean))); }
// Сохранить (или обновить по id / по имени) эффект в библиотеке
export function upsertLib(fx, libId) {
  const list = loadLib(), f = normFx({ ...fx, id: libId || fx.id || uid() });
  if (!f) return null;
  let i = libId ? list.findIndex(x => x.id === libId) : -1;
  if (i < 0) i = list.findIndex(x => sameFx(x, f));
  if (i >= 0) { f.id = list[i].id; list[i] = f; } else list.unshift(f);
  saveLib(list); return f;
}
export function removeLib(id) { saveLib(loadLib().filter(x => x.id !== id)); }
// Все группы: «Мои» + встроенные
export function libGroups() {
  return [{ id: "my", name: "★ Мои сохранённые", list: loadLib(), mine: true },
    ...GROUPS.map(g => ({ ...g, list: g.list.map(x => normFx({ ...x, id: "b-" + x.key })) }))];
}

// ── эффекты на токенах (метаданные предмета сцены → видят все игроки) ──
export const isToken = it => it && TOKEN_LAYERS.includes(it.layer);

export async function editFx(ids, fn) {
  if (!ids.length) return;
  await OBR.scene.items.updateItems(ids, items => {
    for (const it of items) {
      const next = (fn(readFx(it), it) || []).map(normFx).filter(Boolean);
      if (next.length) it.metadata[KEY] = next; else delete it.metadata[KEY];
    }
  });
}
// Добавить эффект (если такой по имени уже есть — обновить его)
export const addFx = (ids, fx) => editFx(ids, list => {
  const f = normFx({ ...fx, id: uid() }), i = list.findIndex(x => sameFx(x, f));
  if (i >= 0) list[i] = { ...f, id: list[i].id }; else list.push(f);
  return list;
});
export const removeFxByName = (ids, name) => editFx(ids, list => list.filter(x => !sameFx(x, { name })));
export const removeFxById = (id, fxId) => editFx([id], list => list.filter(x => x.id !== fxId));
// Включить/выключить: если есть на всех — снять, иначе повесить недостающим
export async function toggleFx(ids, fx, items) {
  const all = items.length && items.every(it => readFx(it).some(x => sameFx(x, fx)));
  if (all) await removeFxByName(ids, fx.name); else await addFx(ids, fx);
  return !all;
}

// Подсказка внизу окна
export function toaster(el) {
  let t = 0;
  return msg => { el.textContent = msg; clearTimeout(t); t = setTimeout(() => (el.textContent = ""), 2600); };
}
