// Фон мода эффектов — работает у КАЖДОГО игрока:
//  • проигрывает анимации способностей, которые прислал мастер;
//  • рисует висящие эффекты на токенах;
//  • у мастера — следит за трекером инициативы и снимает эффекты, когда наступает нужный ход.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { STATE, INIT, CH, normState } from "./const.js";
import { ABIL } from "./abilities.js";
import { play, startAura, stopAura, stopAll } from "./engine.js";
import { turnEvents, applyEvents, samePos } from "./turns.js";

let state = normState(null), ready = false, isGM = false, initSig = "";
const rendered = new Map();   // id эффекта → нарисованная аура
const hold = new Map();       // id эффекта → не показывать до (ждём попадания снаряда)

// ── синхронизация аур с состоянием ──
let syncing = false, again = false;
async function sync() {
  if (syncing) { again = true; return; }
  syncing = true;
  try { do { again = false; await doSync(); } while (again); }
  catch (e) { console.warn("[fx]", e); }
  finally { syncing = false; }
}
async function doSync() {
  if (!ready) { rendered.clear(); stopAll(); return; }
  const want = new Map(state.e.map(e => [e.id, e]));
  for (const [id, r] of rendered) if (!want.has(id) || want.get(id).tok !== r.tok) { stopAura(r); rendered.delete(id); }
  const need = state.e.filter(e => !rendered.has(e.id) && ABIL[e.a] && ABIL[e.a].aura);
  if (!need.length) return;
  const have = new Set((await OBR.scene.items.getItems(need.map(e => e.tok))).map(i => i.id));
  for (const e of need) {
    if (!have.has(e.tok)) continue;
    const h = hold.get(e.id);
    if (h && h > Date.now()) { setTimeout(sync, h - Date.now() + 20); continue; }
    hold.delete(e.id);
    try { rendered.set(e.id, await startAura(ABIL[e.a].aura, e.tok)); } catch (err) { console.warn("[fx] aura", err); }
  }
}

// ── запись состояния (только мастер, строго по очереди) ──
let queue = Promise.resolve();
function mutate(fn) {
  queue = queue.then(async () => {
    const md = await OBR.room.getMetadata();
    const ns = fn(normState(md[STATE]), md);
    if (ns) await OBR.room.setMetadata({ [STATE]: ns });
  }).catch(e => console.warn("[fx] write", e));
  return queue;
}
function onTurns(s, md) {
  const { pos, events } = turnEvents(s.p, md[INIT]);
  let changed = !samePos(s.p, pos);
  if (events.length) {
    const { keep, gone, touched } = applyEvents(s.e, events);
    if (touched) { changed = true; s.e = keep; }
    if (gone.length) OBR.notification.show("⌛ Закончилось: " + gone.map(e => `${(ABIL[e.a] || {}).name || e.a} (${e.tn})`).join(", ")).catch(() => {});
  }
  s.p = pos;
  return changed ? s : null;
}

function onMeta(md) {
  state = normState(md[STATE]);
  sync();
  if (isGM) {
    const P = md[INIT];
    const sg = JSON.stringify(P && P.chips ? [P.r, P.chips.map(c => [c.n, c.on ? 1 : 0])] : null);
    if (sg !== initSig) { initSig = sg; mutate(onTurns); }
  }
}

OBR.onReady(async () => {
  isGM = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(p => { isGM = p.role === "GM"; });
  ready = await OBR.scene.isReady();
  OBR.scene.onReadyChange(r => { ready = r; sync(); });

  OBR.broadcast.onMessage(CH, async ev => {
    const m = ev.data || {};
    if (m.op === "play") {
      const ids = Object.values(m.e || {});
      ids.forEach(id => hold.set(id, Date.now() + 8000));          // пока не знаем время попадания
      let hits = {};
      const A = ABIL[m.a];
      if (ready) { try {
        hits = await play(m.v === "save" && A && A.castSave ? { ...A, cast: A.castSave } : A, m.c, m.t || []); } catch (e) { console.warn("[fx] play", e); } }
      for (const [tid, eid] of Object.entries(m.e || {})) hold.set(eid, Date.now() + (hits[tid] || 0) + ((A && A.auraDelay) || 0) + 150);
      sync();
    } else if (isGM && m.op === "add" && Array.isArray(m.list)) {
      mutate(s => { s.e.push(...m.list); return s; });
    } else if (isGM && m.op === "del" && Array.isArray(m.ids)) {
      mutate(s => { s.e = s.e.filter(e => !m.ids.includes(e.id)); return s; });
    } else if (isGM && m.op === "clear") {
      mutate(s => { s.e = []; return s; });
    }
  });

  // токен удалили / вернули — пересинхронизируем ауры
  let tm = 0;
  OBR.scene.items.onChange(items => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      const ids = new Set(items.map(i => i.id));
      for (const [id, r] of rendered) if (!ids.has(r.tok)) { stopAura(r); rendered.delete(id); }
      sync();
    }, 400);
  });

  onMeta(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(onMeta);
});
