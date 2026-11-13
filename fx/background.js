// Фон мода эффектов — работает у КАЖДОГО игрока:
//  • проигрывает анимации способностей, которые прислал мастер;
//  • рисует висящие эффекты на токенах;
//  • прицел: областью или кликом по цели / месту (op:"cast" из панели или панели быстрого доступа);
//  • горячие клавиши Alt+1 / Alt+2;
//  • у мастера — следит за трекером инициативы и снимает эффекты, когда наступает нужный ход.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS, STATE, INIT, CH, ALLOW, SEL, normState } from "./const.js";
import { ABIL, paint, aimKind, radOf, sized } from "./abilities.js";
import { play, startAura, startZone, stopAura, stopAll, label, tokens, grid } from "./engine.js";
import { turnEvents, applyEvents, samePos, makeEffects } from "./turns.js";
import { startAim, startPick, cancelAim, aiming, feetPerCell } from "./aim.js";
import { loadBar, openBar } from "./barctl.js";

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
  const quick = new Set();
  for (const [id, r] of rendered) {
    const w = want.get(id);
    if (!w || w.tok !== r.tok || (r.pt && w.rr !== r.rr)) { if (w && r.pt) quick.add(id); stopAura(r); rendered.delete(id); }
  }
  // зоны (Тьма) — в точке или прикреплённые к токену (e.tok), висят до снятия
  for (const e of state.e) {
    if (!e.pt || rendered.has(e.id) || !ABIL[e.a] || !ABIL[e.a].zone) continue;
    const h = hold.get(e.id);
    if (h && h > Date.now()) { setTimeout(sync, h - Date.now() + 20); continue; }
    hold.delete(e.id);
    try {
      let at = e.pt;
      if (e.tok) {   // прикреплена к токену: рисуем от его текущего центра; токена нет на сцене — не рисуем
        const T = (await tokens([e.tok]))[e.tok];
        if (!T) continue;
        at = T;
      }
      const r = await startZone(ABIL[e.a].zone, at, (+e.rr || 15) / (await feetPerCell()), quick.has(e.id), e.tok || null);
      r.rr = e.rr; rendered.set(e.id, r);
    } catch (err) { console.warn("[fx] zone", err); }
  }
  const need = state.e.filter(e => !e.pt && !rendered.has(e.id) && ABIL[e.a] && ABIL[e.a].aura);
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
  const ids = [...Object.values(m.e || {}), ...(m.z ? [m.z] : [])];
  ids.forEach(id => hold.set(id, Date.now() + 8000));          // пока не знаем время попадания
  let hits = {};
  const A = ABIL[m.a] ? sized(paint(ABIL[m.a], m.el), m.rad) : null;
  if (ready && A) { try {
    hits = await play(m.v === "save" && A.castSave ? { ...A, cast: A.castSave } : A, m.c, m.t || [], { pt: m.pt, asTarget: !!m.pa });
  } catch (e) { console.warn("[fx] play", e); } }
  for (const [tid, eid] of Object.entries(m.e || {})) hold.set(eid, Date.now() + (hits[tid] || 0) + ((A && A.auraDelay) || 0) + 150);
  if (m.z) hold.set(m.z, Date.now() + ((A && A.zoneDelay) || 0));
  sync();
  return hits;
}

// ── подтянуть цели к заклинателю (A.pull — футы): двигаем настоящие токены по клеткам до «вплотную» ──
// Делает только тот, кто применил способность (нужны права на токен — у мастера есть всегда).
async function pullTokens(cId, tIds, feet, hits, delay) {
  const DPI = await grid(), fpc = await feetPerCell(), steps = Math.max(1, Math.round(feet / fpc));
  let square = true;
  try { square = (await OBR.scene.grid.getType()) === "SQUARE"; } catch (e) {}
  const info = await tokens([cId, ...tIds]), C = info[cId];
  if (!C) return;
  for (const id of tIds) {
    const T = info[id];
    if (!T || id === cId) continue;
    const near = Math.round((C.r + T.r) / DPI * 2) / 2;   // «вплотную», в клетках между центрами
    let x = T.x, y = T.y;
    for (let s = 0; s < steps; s++) {
      const cx = (C.x - x) / DPI, cy = (C.y - y) / DPI;
      if (square) {   // шаг на соседнюю клетку (в т.ч. по диагонали), как движение в D&D
        const m = Math.max(Math.abs(cx), Math.abs(cy));
        if (m - near < 0.99) break;
        x += Math.round(cx / m) * DPI; y += Math.round(cy / m) * DPI;
      } else {
        const d = Math.hypot(cx, cy);
        if (d - near < 0.99) break;
        x += cx / d * DPI; y += cy / d * DPI;
      }
    }
    const dx = x - T.x, dy = y - T.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) continue;
    setTimeout(() => slide(id, dx, dy), Math.max(0, (hits[id] || 0) + (delay || 0)));
  }
}
async function slide(id, dx, dy) {
  let base;
  try { const [it] = await OBR.scene.items.getItems([id]); if (!it) return; base = { x: it.position.x, y: it.position.y }; } catch (e) { return; }
  const N = 8;
  try {
    for (let k = 1; k <= N; k++) {
      const e = 1 - Math.pow(1 - k / N, 3);
      await OBR.scene.items.updateItems([id], ds => { for (const d of ds) d.position = { x: base.x + dx * e, y: base.y + dy * e }; });
      if (k < N) await new Promise(r => setTimeout(r, 35));
    }
  } catch (e) { console.warn("[fx] pull", e); note("🕸️ Не смог подтянуть токен — передвинь его вручную"); }
}

// ── телепорт заклинателя (A.teleport): токен «тает», переносится в точку и проявляется ──
// Делает только тот, кто применил способность. Точку прибытия прижимаем к сетке.
async function snapFor(id, pt) {
  try {
    const DPI = await grid(), b = await OBR.scene.items.getItemBounds([id]);
    const cells = Math.max(1, Math.round(Math.max(b.width, b.height) / DPI)), even = cells % 2 === 0;
    const q = await OBR.scene.grid.snapPosition({ x: pt.x, y: pt.y }, 1, even, !even);
    if (q && isFinite(q.x) && isFinite(q.y)) return { x: q.x, y: q.y };
  } catch (e) {}
  return pt;
}
async function teleportTo(id, pt, delay) {
  await new Promise(r => setTimeout(r, Math.max(0, delay || 0)));
  let it, b;
  try { [it] = await OBR.scene.items.getItems([id]); if (!it) return; b = await OBR.scene.items.getItemBounds([id]); } catch (e) { return; }
  const s0 = { ...it.scale }, p0 = { ...it.position }, dx = pt.x - b.center.x, dy = pt.y - b.center.y;
  const scale = k => OBR.scene.items.updateItems([id], ds => { for (const d of ds) d.scale = { x: s0.x * k, y: s0.y * k }; });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  try {
    for (const k of [0.75, 0.45, 0.2, 0.05]) { await scale(k); await wait(30); }
    await OBR.scene.items.updateItems([id], ds => { for (const d of ds) d.position = { x: p0.x + dx, y: p0.y + dy }; });
    await wait(120);
    for (const k of [0.3, 0.6, 0.85, 1.04]) { await scale(k); await wait(35); }
  } catch (e) { console.warn("[fx] teleport", e); note("🐦‍⬛ Не смог перенести токен — передвинь его вручную"); }
  finally { try { await scale(1); } catch (e) {} }
}

// ── заклинатель: по id, иначе по имени (другая сцена), иначе единственный свой токен игрока ──
async function resolveCaster(c) {
  const sel = loadSel();
  if (c && c.id) {
    const [it] = await OBR.scene.items.getItems([c.id]);
    if (it) return { id: it.id, name: tokName(it) };
  }
  const all = await OBR.scene.items.getItems(i => i.layer === "CHARACTER" || i.layer === "MOUNT");
  let found = null;
  if (c && c.name) {
    const same = all.filter(i => tokName(i).toLowerCase() === String(c.name).toLowerCase());
    if (same.length === 1) found = same[0];
  }
  let auto = false;
  if (!found && !isGM) {
    const mine = all.filter(i => i.layer === "CHARACTER" && i.createdUserId === OBR.player.id);
    if (mine.length === 1) { found = mine[0]; auto = true; }
  }
  if (!found) return null;
  sel.c = { id: found.id, name: tokName(found) };
  try { localStorage.setItem(SEL, JSON.stringify(sel)); } catch (e) {}
  if (auto) note(`🪄 Твой токен: ${sel.c.name} (${KEY_CASTER} — сменить)`);
  return sel.c;
}

// ── применение (op:"cast" из своей панели / панели быстрого доступа) ──
// m = { a, v?, el?, dur?, use? }: use:"sel" — по целям из Alt+2 без прицела
async function onCast(m) {
  const A = ABIL[m.a];
  if (!A) return;
  if (!isGM && !allow.has(A.id)) return note("🔒 Мастер закрыл эту способность");
  if (!ready) return note("Сцена ещё не загружена");
  const kind = aimKind(A), sel = loadSel();
  const c = await resolveCaster(sel.c);
  if (A.id === "dragons-breath" && c) {   // стихия из «наделения» на этом токене
    const b = state.e.find(e => e.a === "dragons-breath-buff" && e.tok === c.id && e.el);
    if (b) m = { ...m, el: b.el };
  }
  const P = paint(A, m.el);
  const color = (P.cast || []).map(x => x.color).find(x => typeof x === "string" && x[0] === "#") || "#b48cff";
  const save = m.v === "save";

  const fireWith = async ({ pt, targets, asPoint, tok }) => {
    if (A.teleport && pt && c && !save) pt = await snapFor(c.id, pt);
    const { e, list, lost } = makeEffects({ A, c, targets, dur: save ? null : m.dur, chips, uid, el: m.el });
    const rad = radOf(A, m.rad);
    let z;
    if (A.zone && pt) {   // Тьма: зона в точке или на токене (tok), висит до снятия
      z = uid();
      const on = A.attachable && tok && tok.id ? tok : null;
      list.push({ id: z, a: A.id, tok: on ? on.id : null, pt: { x: pt.x, y: pt.y }, rr: rad || A.area.radius, tn: on ? on.name : "точка", w: null, m: "x", n: 1, k: 0 });
    }
    const msg = { op: "play", a: A.id, v: m.v, c: c ? c.id : null, t: targets.map(t => t.id), pt: pt || undefined, pa: asPoint ? 1 : undefined, el: m.el, e, rad: rad || undefined, z };
    await OBR.broadcast.sendMessage(CH, msg, { destination: "REMOTE" });
    const played = onPlay(msg);
    if (A.teleport && pt && c && !save) teleportTo(c.id, pt, A.teleportDelay || 0).catch(e => console.warn("[fx] teleport", e));
    if (A.pull && c && !save) played.then(h => pullTokens(c.id, targets.map(t => t.id), A.pull, h || {}, A.pullDelay || 0)).catch(e => console.warn("[fx] pull", e));
    if (list.length) {
      if (isGM) mutate(s => { s.e.push(...list); return s; });
      else await OBR.broadcast.sendMessage(CH, { op: "add", list }, { destination: "REMOTE" });
    }
    if (lost.length) note(`${A.icon || "✨"} ${A.name}: не нашёл в инициативе ${[...new Set(lost)].join(", ")}`);
  };

  try {
    if (kind === "self") {
      if (!c) return note(`Сначала выбери заклинателя: выдели свой токен и нажми ${KEY_CASTER}`);
      return fireWith({ targets: [c] });
    }
    if (kind === "area") {
      if (!c) return note(`Сначала выбери заклинателя: выдели свой токен и нажми ${KEY_CASTER}`);
      const attach = !!(A.zone && A.attachable) && m.att !== false;   // клик по токену — прикрепить зону к нему
      await startAim({ A: sized(A, m.rad), cId: c.id, color, isGM, attach, onFire: ({ pt, targets, tok }) => fireWith({ pt, targets, tok: attach ? tok : null }) });
      return;
    }
    if (m.use === "sel") {
      let t = sel.t || [];
      if (t.length) {
        const have = new Set((await OBR.scene.items.getItems(t.map(x => x.id))).map(i => i.id));
        t = t.filter(x => have.has(x.id));
      }
      if (!t.length && kind === "tok" && c) t = [c];
      if (!t.length) return note(`Выдели цели и нажми ${KEY_TARGETS}`);
      return fireWith({ targets: t });
    }
    if (kind === "dir" && !c) return note(`Сначала выбери заклинателя: выдели свой токен и нажми ${KEY_CASTER}`);
    await startPick({
      A, cId: c ? c.id : undefined, color, isGM, allowPoint: kind === "dir",
      onFire: ({ pt, targets }) => fireWith({ pt, targets, asPoint: !targets.length && !!pt }),
    });
  } catch (e) {
    console.warn("[fx] cast", e);
    note(`Не нашёл заклинателя на карте — выдели свой токен и нажми ${KEY_CASTER}`);
  }
}

// ── ПКМ по плитке панели быстрого доступа ──
// идёт наведение → отменить его; иначе — вариант «промах / спасбросок пройден» (если он есть у способности)
async function onRmb(m) {
  if (aiming()) return cancelAim();
  const A = ABIL[m.a];
  if (A && !A.area && !A.self && (A.attack || A.save)) return onCast(m);   // вариант (v) присылает панель с учётом переключателя
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
    if (fromPlayer(ev) && (m.op === "del" || m.op === "clear" || m.op === "rad" || m.op === "att")) return;                 // снимает только мастер
    if (fromPlayer(ev) && m.op === "play" && !allow.has(m.a)) return;                  // игрокам — только разрешённое
    if (m.op === "play") onPlay(m);
    else if (m.op === "cast") { if (!ev.connectionId || !myConn || ev.connectionId === myConn) onCast(m); }   // только свой прицел
    else if (m.op === "rmb") { if (!ev.connectionId || !myConn || ev.connectionId === myConn) onRmb(m); }
    else if (isGM && m.op === "add" && Array.isArray(m.list)) {
      const list = fromPlayer(ev) ? m.list.filter(x => x && allow.has(x.a)) : m.list;
      if (list.length) mutate(s => { s.e.push(...list); return s; });
    } else if (isGM && m.op === "del" && Array.isArray(m.ids)) {
      mutate(s => { s.e = s.e.filter(e => !m.ids.includes(e.id)); return s; });
    } else if (isGM && m.op === "rad" && m.id) {   // изменить радиус зоны (Тьма)
      mutate(s => {
        const e = s.e.find(x => x.id === m.id); if (!e || !e.pt) return null;
        const v = radOf(ABIL[e.a], (+e.rr || 15) + (+m.d || 0));
        if (!v || v === e.rr) return null;
        e.rr = v; return s;
      });
    } else if (isGM && m.op === "att" && m.id) {   // прикрепить зону к токену (m.tok = {id, name}) / открепить (m.tok = null)
      const cur = state.e.find(x => x.id === m.id);
      const tid = m.tok && m.tok.id ? m.tok.id : cur && cur.tok;
      const T = tid ? (await tokens([tid]))[tid] : null;
      if (m.tok && !T) return note("Не нашёл этот токен на сцене");
      mutate(s => {
        const e = s.e.find(x => x.id === m.id);
        if (!e || !e.pt || !ABIL[e.a] || !ABIL[e.a].zone || !ABIL[e.a].attachable) return null;
        if (m.tok && m.tok.id) {
          if (e.tok === m.tok.id) return null;
          e.tok = m.tok.id; e.tn = m.tok.name || "токен"; e.pt = { x: T.x, y: T.y };
        } else {
          if (!e.tok) return null;
          if (T) e.pt = { x: T.x, y: T.y };   // остаётся там, где сейчас стоит токен
          e.tok = null; e.tn = "точка";
        }
        return s;
      });
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
      for (const [id, r] of rendered) if (r.tok && !ids.has(r.tok)) { stopAura(r); rendered.delete(id); }   // ауры и прикреплённые зоны
      sync();
    }, 400);
  });

  onMeta(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(onMeta);

  // панель быстрого доступа — вернуть, если была открыта
  try { if (loadBar().open) await openBar(); } catch (e) { console.warn("[fx] bar", e); }
});
