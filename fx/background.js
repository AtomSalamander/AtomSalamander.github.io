// Фон мода эффектов — работает у КАЖДОГО игрока:
//  • проигрывает анимации способностей, которые прислал мастер;
//  • рисует висящие эффекты на токенах;
//  • прицел для заклинаний по области и горячие клавиши Alt+1 / Alt+2;
//  • у мастера — следит за трекером инициативы и снимает эффекты, когда наступает нужный ход.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS, STATE, INIT, CH, ALLOW, SEL, normState } from "./const.js";
import { ABIL, paint } from "./abilities.js";
import { play, startAura, stopAura, stopAll, label } from "./engine.js";
import { turnEvents, applyEvents, samePos, makeEffects } from "./turns.js";
import { startAim } from "./aim.js";

// Горячие клавиши (формат Owlbear: "Alt+1", "Shift+C", "Ctrl+Alt+2"…). На Mac Alt = Option.
const KEY_CASTER = "Alt+1";    // выделенный токен → «Кто»
const KEY_TARGETS = "Alt+2";   // выделенные токены → «Цели»
const ICON = "/fx/icon.svg";

let state = normState(null), ready = false, isGM = false, initSig = "", allow = new Set(), myConn = "", chips = [];
const roles = new Map();     // connectionId → роль (GM / PLAYER) других участников
const fromPlayer = ev => ev.connectionId && ev.connectionId !== myConn && roles.get(ev.connectionId) !== "GM";
const rendered = new Map();   // id эффекта → нарисованная аура
const hold = new Map();       // id эффекта → не показывать до (ждём попадания снаряда)
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const tokName = it => (it.text && it.text.plainText || "").trim() || it.name || "без имени";
const note = msg => OBR.notification.show(msg).catch(() => {});

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
    try { rendered.set(e.id, await startAura(paint(ABIL[e.a], e.el).aura, e.tok)); } catch (err) { console.warn("[fx] aura", err); }
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
    if (gone.length) note("⌛ Закончилось: " + gone.map(e => `${(ABIL[e.a] || {}).name || e.a} (${e.tn})`).join(", "));
  }
  s.p = pos;
  return changed ? s : null;
}

function onMeta(md) {
  allow = new Set(Array.isArray(md[ALLOW]) ? md[ALLOW] : []);
  state = normState(md[STATE]);
  const P = md[INIT];
  chips = P && Array.isArray(P.chips) ? P.chips : [];
  sync();
  if (isGM) {
    const sg = JSON.stringify(P && P.chips ? [P.r, P.chips.map(c => [c.n, c.on ? 1 : 0])] : null);
    if (sg !== initSig) { initSig = sg; mutate(onTurns); }
  }
}

// ── проиграть анимацию (сообщение op:"play") ──
async function onPlay(m) {
  const ids = Object.values(m.e || {});
  ids.forEach(id => hold.set(id, Date.now() + 8000));          // пока не знаем время попадания
  let hits = {};
  const A = ABIL[m.a] ? paint(ABIL[m.a], m.el) : null;
  if (ready && A) { try {
    hits = await play(m.v === "save" && A.castSave ? { ...A, cast: A.castSave } : A, m.c, m.t || [], { pt: m.pt });
  } catch (e) { console.warn("[fx] play", e); } }
  for (const [tid, eid] of Object.entries(m.e || {})) hold.set(eid, Date.now() + (hits[tid] || 0) + ((A && A.auraDelay) || 0) + 150);
  sync();
}

// ── прицел (op:"aim" из своей панели) ──
async function onAim(m) {
  const A = ABIL[m.a];
  if (!A || !A.area || !m.c) return;
  if (!isGM && !allow.has(A.id)) return note("🔒 Мастер закрыл эту способность");
  const P = paint(A, m.el);
  const color = (P.cast || []).map(s => s.color).find(c => typeof c === "string" && c[0] === "#") || "#ff7a1a";
  const caster = { id: m.c, name: m.cn || "заклинатель" };
  try {
    await startAim({ A, cId: m.c, color, isGM, onFire: async ({ pt, targets }) => {
      const { e, list, lost } = makeEffects({ A, c: caster, targets, dur: m.dur, chips, uid, el: m.el });
      const msg = { op: "play", a: A.id, c: m.c, t: targets.map(t => t.id), pt, el: m.el, e };
      await OBR.broadcast.sendMessage(CH, msg, { destination: "REMOTE" });
      onPlay(msg);
      if (list.length) {
        if (isGM) mutate(s => { s.e.push(...list); return s; });
        else await OBR.broadcast.sendMessage(CH, { op: "add", list }, { destination: "REMOTE" });
      }
      const who = targets.length ? "в области: " + targets.map(t => t.name).join(", ") : "в области никого";
      note(`${A.icon || "✨"} ${A.name} — ${who}` + (lost.length ? `. Не нашёл в инициативе: ${[...new Set(lost)].join(", ")}` : ""));
    } });
    note(`🎯 ${A.name}: наведи и кликни по карте · Esc — отмена`);
  } catch (e) {
    console.warn("[fx] aim", e);
    note("Не нашёл токен «Кто» на карте — выдели его и нажми " + KEY_CASTER);
  }
}

// ── горячие клавиши: выделение → «Кто» / «Цели» ──
function loadSel() { try { const s = JSON.parse(localStorage.getItem(SEL)); return s && typeof s === "object" ? { c: s.c || null, t: Array.isArray(s.t) ? s.t : [] } : { c: null, t: [] }; } catch (e) { return { c: null, t: [] }; } }
async function pickSel(kind, items) {
  const list = (items || []).map(i => ({ id: i.id, name: tokName(i) }));
  if (!list.length) return;
  const sel = loadSel();
  if (kind === "c") sel.c = list[0]; else sel.t = list;
  try { localStorage.setItem(SEL, JSON.stringify(sel)); } catch (e) {}
  try {
    if (kind === "c") await label([list[0].id], "Заклинатель", { color: "#f3d58a" });
    else await label(list.map(x => x.id), "Цель", { color: "#ff9a9a" });
  } catch (e) { console.warn("[fx] label", e); }
}
const onlyTokens = { every: [{ key: "layer", value: "CHARACTER", coordinator: "||" }, { key: "layer", value: "MOUNT" }] };

OBR.onReady(async () => {
  isGM = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(p => { isGM = p.role === "GM"; });
  try { myConn = await OBR.player.getConnectionId(); } catch (e) {}
  const setParty = ps => { roles.clear(); for (const p of ps || []) roles.set(p.connectionId, p.role); };
  try { setParty(await OBR.party.getPlayers()); OBR.party.onChange(setParty); } catch (e) {}
  ready = await OBR.scene.isReady();
  OBR.scene.onReadyChange(r => { ready = r; sync(); });

  OBR.broadcast.onMessage(CH, async ev => {
    const m = ev.data || {};
    if (fromPlayer(ev) && (m.op === "del" || m.op === "clear")) return;                 // снимает только мастер
    if (fromPlayer(ev) && m.op === "play" && !allow.has(m.a)) return;                  // игрокам — только разрешённое
    if (m.op === "play") onPlay(m);
    else if (m.op === "aim") { if (!ev.connectionId || !myConn || ev.connectionId === myConn) onAim(m); }   // только свой прицел
    else if (isGM && m.op === "add" && Array.isArray(m.list)) {
      const list = fromPlayer(ev) ? m.list.filter(x => x && allow.has(x.a)) : m.list;
      if (list.length) mutate(s => { s.e.push(...list); return s; });
    } else if (isGM && m.op === "del" && Array.isArray(m.ids)) {
      mutate(s => { s.e = s.e.filter(e => !m.ids.includes(e.id)); return s; });
    } else if (isGM && m.op === "clear") {
      mutate(s => { s.e = []; return s; });
    }
  });

  // пункты правого клика по токену + горячие клавиши
  try {
    await OBR.contextMenu.create({
      id: NS + "/sel-caster", shortcut: KEY_CASTER,
      icons: [{ icon: ICON, label: `FX: заклинатель «Кто» (${KEY_CASTER})`, filter: { min: 1, ...onlyTokens } }],
      onClick: ctx => pickSel("c", ctx.items),
    });
    await OBR.contextMenu.create({
      id: NS + "/sel-targets", shortcut: KEY_TARGETS,
      icons: [{ icon: ICON, label: `FX: цели (${KEY_TARGETS})`, filter: { min: 1, ...onlyTokens } }],
      onClick: ctx => pickSel("t", ctx.items),
    });
  } catch (e) { console.warn("[fx] contextMenu", e); }

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
