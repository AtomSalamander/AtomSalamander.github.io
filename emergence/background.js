// Фоновый скрипт «Эмерджентности»: работает у всех игроков.
// У каждого: проигрывание эффектов, висящие ауры, сигнал тревоги Протокола.
// Только у мастера: команды панели, состояние комнаты, перемещение/скрытие токенов, сроки по инициативе.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS, STATE, CH, INIT, PAL, PROTO, DMG, EFF, normState } from "./const.js";
import { DPI, grid, feetPerCell, V, c01, tokens, token, moveToken, teleportToken, setVisible, shrinkHide, stop, clearAll, wait } from "./engine.js";
import * as FX from "./fx.js";
import { AURA } from "./auras.js";
import { turnEvents, applyEvents, matchChip, sameName, untilText } from "./turns.js";
import { pickPoints } from "./pick.js";

let GM = false, ready = false, st = normState(null), init = null, FT = 5;
const note = m => OBR.notification.show(m).catch(() => {});
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const chips = () => (init && Array.isArray(init.chips) ? init.chips : []);
const round = () => (init && Number(init.r)) || 1;
const cells = ft => ft / FT * DPI;

// ────────── Кэш позиций токенов (для висящих аур) ──────────
const POS = new Map();
const G = id => POS.get(id) || null;
function neededIds() {
  const s = new Set();
  if (st.boss) s.add(st.boss);
  if (st.pk) s.add(st.pk);
  for (const id of Object.values(st.keys || {})) if (id) s.add(id);
  for (const e of st.e) if (e.tok) s.add(e.tok);
  for (const g of st.snap || []) if (g.id) s.add(g.id);
  return [...s];
}
let posT = 0, posBusy = false, posAgain = false;
async function refreshPos() {
  if (posBusy) { posAgain = true; return; }
  posBusy = true;
  try {
    const ids = neededIds(), list = ids.length ? await tokens(ids) : [];
    POS.clear(); for (const t of list) POS.set(t.id, t);
  } catch (e) { console.warn("[emergence] pos", e); }
  posBusy = false;
  if (posAgain) { posAgain = false; return refreshPos(); }
  syncAuras();
}
const posSoon = (ms = 90) => { clearTimeout(posT); posT = setTimeout(refreshPos, ms); };

// ────────── Висящие ауры ──────────
const LIVE = new Map();   // key → {sig, anim}
const isStunned = () => st.e.some(e => e.a === "stun");
function desired() {
  const want = new Map(), stun = isStunned();
  const add = (key, kind, args, need) => { if (need.some(id => !POS.has(id))) return; want.set(key, { kind, args, sig: kind + JSON.stringify(args) }); };
  for (const e of st.e) {
    if (!AURA[e.a]) continue;
    const args = { tok: e.tok };
    if (e.a === "charge" || e.a === "grab" || e.a === "appro") args.boss = st.boss;
    if (e.a === "recal") args.col = e.col || PAL.cy;
    add(e.id, e.a, args, [e.tok]);
  }
  const p = st.proto, P = p && PROTO[p];
  if (P && st.pk) {
    add("pk", "keyGlow", { tok: st.pk, col: P.glow || P.color, dim: stun }, [st.pk]);
    if (p === "div" && st.wall) add("wall", "wall", { a: st.wall.a, b: st.wall.b, tok: st.pk, col: P.glow }, []);
    if (p === "perm") add("perm", "perm", { tok: st.pk, col: P.glow || P.color }, [st.pk]);
    if (p === "loop" && st.snap) add("loop", "loop", { tok: st.pk, col: P.color, snap: st.snap }, [st.pk]);
    if (p === "sil") add("sil", "silence", { tok: st.pk, col: P.color, glow: P.glow }, [st.pk]);
  }
  if (st.veins && st.boss) {
    const keys = Object.entries(st.keys || {}).filter(([k, id]) => id && !st.broken[k] && POS.has(id) && POS.get(id).vis !== false).map(x => x[1]);
    if (keys.length) add("veins", "veins", { boss: st.boss, keys, dim: stun }, [st.boss]);
  }
  return want;
}
const HOLD = new Map();   // key → время, до которого ауру не снимаем (для плавности)
function syncAuras() {
  if (!ready) return;
  const want = desired();
  for (const [k, o] of LIVE) {
    const w = want.get(k);
    if (!w || w.sig !== o.sig) { stop(o.anim); LIVE.delete(k); }
  }
  for (const [k, w] of want) {
    if (LIVE.has(k)) continue;
    try { LIVE.set(k, { sig: w.sig, anim: AURA[w.kind](G, w.args) }); } catch (e) { console.warn("[emergence] aura", w.kind, e); }
  }
}

// ────────── Сигнал тревоги Протокола (края экрана + надпись под рулеткой) ──────────
const EDGE = 14, BANNER = NS + "/banner", MSG = NS + "/msg", SIDES = ["t", "b", "l", "r"];
const edgeId = s => NS + "/edge-" + s;
function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function barPlace(w, h) {
  const off = ls("dndbar_off") === "1";
  let p = null; try { p = JSON.parse(ls("dndbar_pos") || "null"); } catch (e) {}
  const W = Math.max(320, Math.min(1000, w - 200));
  const cx = p && isFinite(p.x) ? Math.min(Math.max(p.x * w, W / 2 + 16), w - W / 2 - 16) : w / 2;
  const top0 = p && isFinite(p.y) ? Math.max(p.y * h, 0) : 12;
  const diving = ls("dndbar_dive") === "1";
  const top = Math.min(top0 + (diving ? 60 : 0), h - 110);
  return off ? { cx: w / 2, y: 18 } : { cx, y: top + 110 + 4 };
}
let alarmSig = "", alarmT = 0;
async function alarm() {
  if (!ready) return;
  const p = st.proto && PROTO[st.proto] ? st.proto : null;
  let w = 0, h = 0;
  try { w = await OBR.viewport.getWidth(); h = await OBR.viewport.getHeight(); } catch (e) { return; }
  const bp = barPlace(w, h);
  const sig = p ? [p, w, h, Math.round(bp.cx), Math.round(bp.y)].join(",") : "";
  if (sig === alarmSig) return;
  const was = alarmSig; alarmSig = sig;
  if (!p) { if (was) for (const id of [...SIDES.map(edgeId), BANNER]) OBR.popover.close(id).catch(() => {}); return; }
  const P = PROTO[p], c = encodeURIComponent(P.glow || P.color), t0 = Date.now();
  const base = { hidePaper: true, disableClickAway: true, marginThreshold: 0, anchorReference: "POSITION" };
  const url = (q) => `/emergence/alert.html?${q}&c=${c}&t0=${t0}`;
  const geo = { t: [0, 0, w, EDGE], b: [0, h - EDGE, w, EDGE], l: [0, 0, EDGE, h], r: [w - EDGE, 0, EDGE, h] };
  for (const s of SIDES) {
    const [x, y, ww, hh] = geo[s];
    OBR.popover.open({ ...base, id: edgeId(s), url: url(`mode=edge&side=${s}`), width: ww, height: hh, anchorPosition: { left: x, top: y }, transformOrigin: { horizontal: "LEFT", vertical: "TOP" } }).catch(() => {});
  }
  const txt = encodeURIComponent(`${P.icon} ВНИМАНИЕ · ПРОТОКОЛ ${P.name.toUpperCase()} АКТИВЕН`);
  OBR.popover.open({ ...base, id: BANNER, url: url(`mode=banner&t=${txt}`), width: Math.min(560, w - 40), height: 44, anchorPosition: { left: bp.cx, top: bp.y }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" } }).catch(() => {});
}
async function bigMsg(text, col) {
  let w = 800, h = 600; try { w = await OBR.viewport.getWidth(); h = await OBR.viewport.getHeight(); } catch (e) {}
  const u = `/emergence/alert.html?mode=msg&c=${encodeURIComponent(col || PAL.cy)}&t=${encodeURIComponent(text)}`;
  OBR.popover.open({ id: MSG, url: u, width: Math.min(620, w - 40), height: 96, hidePaper: true, disableClickAway: true, marginThreshold: 0, anchorReference: "POSITION", anchorPosition: { left: w / 2, top: h * .3 }, transformOrigin: { horizontal: "CENTER", vertical: "CENTER" } }).catch(() => {});
  clearTimeout(bigMsg.t); bigMsg.t = setTimeout(() => OBR.popover.close(MSG).catch(() => {}), 4200);
}

// ────────── Проигрывание разовых эффектов (у всех) ──────────
function playFx(m) {
  try {
    switch (m.k) {
      case "touch": return FX.touch(m.B, m.T, m.v);
      case "weave": return FX.weave(m.B, m.T, m.hit);
      case "wave": return FX.wave(m.B, m.aim, m.L, m.hits);
      case "summon": return FX.summon(m.B, m.pts);
      case "chargeIntro": return FX.chargeIntro(m.B, m.T);
      case "strike": return FX.strike(m.T, m.fails, m.erased);
      case "sphere": return FX.sphere(m.B, m.T, m.fail);
      case "shift": return FX.shift(m.T, m.to, m.fail);
      case "appro": return FX.appro(m.B, m.T, m.fail);
      case "redirect": return FX.redirect(m.A, m.Bp, m.C, m.fail);
      case "protoOn": return FX.protoOn(m.K, m.col, m.B);
      case "protoOff": return FX.protoOff(m.K, m.col);
      case "shuffle": return FX.shuffle(m.moves, m.col);
      case "loopRewind": return FX.loopRewind(m.K, m.moves, m.col);
      case "loopShatter": return FX.loopShatter(m.K, m.ghosts, m.col);
      case "silenceWave": return FX.silenceWave(m.K, m.dark, m.glow);
      case "recal": return FX.recal(m.B, m.col);
      case "lens": return FX.lens(m.H, m.B, m.fail);
      case "veinPulse": return FX.veinPulse(m.B, m.K, 0, m.col);
      case "keyHit": return FX.keyHit(m.B, m.K, m.barrier);
      case "veinFlare": return FX.veinFlare(m.B, m.keys);
      case "keyBreak": return FX.keyBreak(m.B, m.K, m.col);
      case "coreBurst": return FX.coreBurst(m.B);
      case "msg": return bigMsg(m.text, m.col);
      case "clear": clearAll(); LIVE.clear(); return syncAuras();
    }
  } catch (e) { console.warn("[emergence] fx", m.k, e); }
}
function emit(m) {
  OBR.broadcast.sendMessage(CH, { op: "play", ...m }, { destination: "REMOTE" }).catch(e => console.warn("[emergence] send", e));
  return playFx(m);
}

// ────────── Состояние комнаты (пишет только мастер) ──────────
let chain = Promise.resolve();
function mutate(fn) {
  chain = chain.then(async () => {
    try {
      const md = await OBR.room.getMetadata();
      const s = normState(md[STATE]);
      const r = await fn(s, md);
      if (r) { await OBR.room.setMetadata({ [STATE]: normState(r) }); }
    } catch (e) { console.warn("[emergence] mutate", e); }
  });
  return chain;
}
const later = (ms, fn) => setTimeout(() => mutate(fn), ms);
const toast = text => OBR.broadcast.sendMessage(CH, { op: "toast", text }, { destination: "LOCAL" }).catch(() => {});

// Висящий эффект. who — имя того, чей ход отсчитывается; mode "s" — до начала, "e" — до конца, "x" — до снятия
function makeEff(kind, T, whoName, mode, extra = {}) {
  let w = null, m = mode;
  if (m !== "x") { w = matchChip(whoName, chips()); if (!w) { m = "x"; note(`⚠️ «${whoName}» не найден в инициативе — «${EFF[kind].name}» висит до ручного снятия`); } }
  return { id: uid(), a: kind, tok: T.id, tn: T.name || "", w, m, n: 1, k: 0, ...extra };
}
function addEff(ms, kind, T, whoName, mode, extra, replaceSame = true) {
  const e = makeEff(kind, T, whoName, mode, extra);
  later(ms, s => { if (replaceSame) s.e = s.e.filter(x => !(x.a === kind && x.tok === T.id)); s.e.push(e); return s; });
  return e;
}
const dropEff = (pred, ms = 0) => later(ms, s => { const n = s.e.length; s.e = s.e.filter(x => !pred(x)); return n !== s.e.length ? s : null; });

async function bossTok() {
  if (!st.boss) { toast("Сначала назначь босса: выдели токен Эмерджентности → «Босс ← выделение»"); return null; }
  const B = await token(st.boss); if (!B) toast("Токен босса не найден на сцене"); return B;
}
const P2 = t => t && { x: t.x, y: t.y, r: t.r };
async function targets(ids, need = 1) {
  const list = (ids && ids.length ? await tokens(ids) : []).filter(t => t.id !== st.boss);
  if (list.length < need) { toast(need > 1 ? `Выдели минимум ${need} токена` : "Выдели токен цели"); return null; }
  return list;
}
async function heroesSnap() {
  const skip = new Set([st.boss, ...Object.values(st.keys || {})].filter(Boolean));
  let its = []; try { its = await OBR.scene.items.getItems(i => i.layer === "CHARACTER" && i.visible !== false && !skip.has(i.id)); } catch (e) {}
  const ts = await tokens(its.map(i => i.id));
  return ts.filter(t => t.vis !== false).map(t => ({ id: t.id, x: t.x, y: t.y, r: t.r, n: t.name }));
}
function shuffleMap(arr) {   // случайная перестановка без неподвижных точек
  const n = arr.length, idx = arr.map((_, i) => i);
  for (let tries = 0; tries < 50; tries++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    if (idx.every((v, i) => v !== i)) break;
  }
  return idx;
}

// ────────── Команды панели ──────────
async function cmd(m) {
  const c = m.c, ids = m.ids || [];
  if (c === "boss") {
    const t = ids[0] && await token(ids[0]); if (!t) return toast("Выдели токен Эмерджентности");
    await mutate(s => { s.boss = t.id; s.bn = t.name; return s; }); return toast(`👁️ Босс: ${t.name}`);
  }
  if (c === "veins") return mutate(s => { s.veins = !s.veins; return s; });
  if (c === "autoLoop") return mutate(s => { s.autoLoop = !s.autoLoop; return s; });
  if (c === "rm") return dropEff(x => x.id === m.id);
  if (c === "clearEff") { emit({ k: "clear" }); return mutate(s => { s.e = []; return s; }); }
  if (c === "reset") { emit({ k: "clear" }); return mutate(s => normState({ boss: s.boss, bn: s.bn, veins: s.veins, autoLoop: s.autoLoop })); }
  if (c === "assignKey") {
    const t = ids[0] && await token(ids[0]); if (!t) return toast("Выдели токен Ключа");
    await mutate(s => { for (const k of Object.keys(s.keys)) if (s.keys[k] === t.id) delete s.keys[k]; s.keys[m.p] = t.id; delete s.broken[m.p]; return s; });
    return toast(`🔑 Ключ ${PROTO[m.p].key}: ${t.name}`);
  }
  if (c === "protoOff") return protoOff(true);
  if (c === "proto") return protoOn(m.p, ids[0]);
  if (c === "wallRedo") return wallPick();
  if (c === "loopSave") { if (st.proto !== "loop") return toast("Протокол Петли не активен"); const snap = await heroesSnap(); await mutate(s => { s.snap = snap; return s; }); return toast(`⏳ Запомнено позиций: ${snap.length}`); }
  if (c === "loopRewind") return loopRewind();
  if (c === "loopBreak") return loopBreak("Петля разорвана");
  if (c === "shuffle") return shuffle(ids);

  const B = await bossTok(); if (!B) return;
  const BB = P2(B);
  switch (c) {
    case "touch": {
      const ts = await targets(ids); if (!ts) return; const T = ts[0];
      emit({ k: "touch", B: BB, T: P2(T), v: m.v });
      if (m.v === "fail") addEff(1900, "nets", T, T.name, "e");
      return;
    }
    case "weave": {
      const ts = await targets(ids); if (!ts) return; const T = ts[0];
      emit({ k: "weave", B: BB, T: P2(T), hit: !!m.hit });
      if (m.hit) addEff(1500 + Math.min(900, V.dist(B, T) / DPI * 40), "weave", T, T.name, "s");
      return;
    }
    case "wave": {
      let ts = ids.length ? (await tokens(ids)).filter(t => t.id !== st.boss) : [];
      let aim;
      if (ts.length) aim = ts.reduce((a, t) => ({ x: a.x + t.x / ts.length, y: a.y + t.y / ts.length }), { x: 0, y: 0 });
      else { toast("Кликни, куда направлен конус"); const p = await pickPoints({ n: 1, labels: ["Направление конуса"], snap: false }); if (!p) return; aim = p[0]; }
      const L = cells(60), push = cells(20), res = m.res || {};
      const hits = ts.map(t => { const fail = res[t.id] !== "ok"; const dir = V.norm(V.sub(t, B)); return { id: t.id, x: t.x, y: t.y, r: t.r, fail, to: fail ? V.add(t, V.mul(dir, push)) : null }; });
      const T0 = emit({ k: "wave", B: BB, aim, L, hits: hits.map(({ id, ...h }) => h) }) || 650;
      const O = V.pol(B, B.r * .9, V.ang(B, aim));
      for (const h of hits) if (h.fail) setTimeout(() => moveToken(h.id, h.to, 420, 12), T0 + c01(V.dist(O, h) / L) * 1100 + 80);
      return;
    }
    case "summon": {
      let pts = [], show = [];
      if (ids.length) { const ts = (await tokens(ids)).filter(t => t.id !== st.boss); pts = ts.map(P2); show = ts.map(t => t.id); }
      if (!pts.length) { const p = await pickPoints({ n: 2, labels: ["Точка первого стража", "Точка второго стража"] }); if (!p) return; pts = p.map(q => ({ x: q.x, y: q.y, r: DPI * .5 })); show = p.map(q => q.tok).filter(Boolean); }
      const tR = emit({ k: "summon", B: BB, pts }) || 2250;
      for (const id of show) setTimeout(() => setVisible(id, true), tR);
      return;
    }
    case "charge": {
      const ts = await targets(ids); if (!ts) return; const T = ts[0];
      emit({ k: "chargeIntro", B: BB, T: P2(T) });
      dropEff(x => x.a === "charge");
      addEff(1000, "charge", T, T.name, "x");
      return toast(`🎯 Стирание заряжено на «${T.name}» — удар в следующий ход босса`);
    }
    case "strike": {
      const ch = st.e.find(x => x.a === "charge");
      const tid = ch ? ch.tok : ids[0]; const T = tid && await token(tid);
      if (!T) return toast("Нет заряженной цели: выдели токен или сначала «Зарядка»");
      const nf = Math.max(0, Math.min(6, m.fails | 0)), fails = [0, 1, 2, 3, 4, 5].map(i => i < nf);
      for (let i = 5; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [fails[i], fails[j]] = [fails[j], fails[i]]; }
      const erased = nf === 6 || !!m.erased;
      dropEff(x => x.a === "charge", 600);
      const tE = emit({ k: "strike", T: P2(T), fails, erased }) || 3080;
      if (erased) setTimeout(() => shrinkHide(T.id, 700), tE + 600);
      setTimeout(() => emit({ k: "msg", text: erased ? `✖ ${T.name} СТЁРТ(А) ИЗ СИСТЕМЫ` : `Стирание: провалов ${nf} из 6 — ${nf * 3}к8 урона`, col: erased ? "#FF4D6D" : PAL.cy }), tE + 900);
      return;
    }
    case "sphere": {
      const ts = await targets(ids); if (!ts) return; const T = ts[0];
      emit({ k: "sphere", B: BB, T: P2(T), fail: !!m.fail });
      if (m.fail) {
        const gap = V.dist(B, T) - B.r - T.r, d = Math.max(0, Math.min(cells(15), gap));
        if (d > 1) setTimeout(() => moveToken(T.id, V.add(T, V.mul(V.norm(V.sub(B, T)), d)), 500, 12), 900);
        addEff(950, "grab", T, T.name, "x");
      }
      return;
    }
    case "shift": {
      const ts = await targets(ids); if (!ts) return; const T = ts[0];
      if (!m.fail) { emit({ k: "shift", T: P2(T), to: null, fail: false }); return; }
      const p = await pickPoints({ n: 1, labels: [`Куда перенести «${T.name}» (до 30 фт)`], snap: false }); if (!p) return;
      let to = { x: p[0].x, y: p[0].y }; const mx = cells(30);
      if (V.dist(T, to) > mx) { to = V.add(T, V.mul(V.norm(V.sub(to, T)), mx)); toast("Точка дальше 30 фт — перенос ограничен"); }
      const tp = emit({ k: "shift", T: P2(T), to, fail: true }) || 620;
      setTimeout(() => teleportToken(T.id, to), tp);
      return;
    }
    case "appro": {
      const ts = await targets(ids); if (!ts) return; const T = ts[0];
      emit({ k: "appro", B: BB, T: P2(T), fail: !!m.fail });
      if (m.fail) addEff(600, "appro", T, T.name, "e");
      return;
    }
    case "redirect": {
      const labels = ["Атакующий", "Исходная цель", "Новая цель"];
      const p = await pickPoints({ n: m.fail ? 3 : 2, labels }); if (!p) return;
      emit({ k: "redirect", A: p[0], Bp: p[1], C: m.fail ? p[2] : null, fail: !!m.fail });
      return;
    }
    case "lens": {
      const H = ids[0] && ids[0] !== st.boss ? await token(ids[0]) : null;
      if (!H) return toast("Выдели героя, который держит Линзу");
      emit({ k: "lens", H: P2(H), B: BB, fail: !!m.fail });
      if (m.fail) {
        dropEff(x => x.a === "open");
        addEff(950, "stun", B, B.name, "e");
        setTimeout(() => emit({ k: "msg", text: "🔶 СИСТЕМА ОГЛУШЕНА · КД 14 · БАРЬЕР ОТКЛЮЧЁН", col: PAL.lens }), 1100);
        if (st.proto === "loop" && st.snap) setTimeout(() => loopBreak("Петля сорвана: Эмерджентность оглушена"), 1700);
      } else addEff(950, "open", B, B.name, "s");
      return;
    }
    case "recal": {
      const d = DMG[m.dmg] || DMG.force, col = d[1];
      emit({ k: "recal", B: BB, col });
      addEff(1000, "recal", B, B.name, "s", { col, dmg: m.dmg, tn: `${B.name} · ${d[0]}` });
      return;
    }
    case "core": { emit({ k: "coreBurst", B: BB }); addEff(1800, "core", B, B.name, "x"); return; }
    case "keyHit": {
      const K = ids[0] && await token(ids[0]); if (!K) return toast("Выдели токен Ключа");
      emit({ k: "keyHit", B: BB, K: P2(K), barrier: !isStunned() }); return;
    }
    case "veinFlare": {
      const kids = Object.entries(st.keys).filter(([p, id]) => id && !st.broken[p]).map(x => x[1]);
      const ks = (await tokens(kids)).filter(t => t.vis !== false).map(P2);
      if (!ks.length) return toast("Нет назначенных целых Ключей");
      emit({ k: "veinFlare", B: BB, keys: ks }); return;
    }
    case "keyBreak": return keyBreak(B, ids[0]);
  }
}

// ────────── Протоколы ──────────
async function protoOn(p, selId) {
  const P = PROTO[p]; if (!P) return;
  const id = selId || st.keys[p];
  const K = id && await token(id);
  if (!K) return toast(`Выдели токен ${P.key} и нажми ещё раз`);
  if (st.broken[p] && st.keys[p] === id) return toast(`${P.key} разрушен — Протокол ${P.name} недоступен`);
  if (st.last[p] === round() - 1) note(`⚠️ Протокол ${P.name} уже был в прошлом раунде (по правилам — нельзя два раунда подряд)`);
  if (st.proto && st.pk && st.proto !== p) { const O = await token(st.pk); const OP = PROTO[st.proto]; if (O && OP) emit({ k: "protoOff", K: P2(O), col: OP.glow || OP.color }); }
  const B = st.boss ? await token(st.boss) : null;
  emit({ k: "protoOn", K: P2(K), col: P.glow || P.color, B: B ? P2(B) : null });
  await mutate(s => { for (const k of Object.keys(s.keys)) if (s.keys[k] === id && k !== p) delete s.keys[k]; s.keys[p] = id; delete s.broken[p]; s.proto = p; s.pk = id; s.last[p] = round(); s.wall = null; s.snap = null; return s; });
  setTimeout(() => emit({ k: "msg", text: `${P.icon} ПРОТОКОЛ ${P.name.toUpperCase()}`, col: P.glow || P.color }), 500);
  if (p === "div") setTimeout(wallPick, 1000);
  if (p === "perm") setTimeout(() => shuffle(null), 1500);
  if (p === "loop") setTimeout(async () => { const snap = await heroesSnap(); await mutate(s => { if (s.proto !== "loop") return null; s.snap = snap; return s; }); toast(`⏳ Петля запомнила позиций: ${snap.length}`); }, 1300);
  if (p === "sil") setTimeout(() => emit({ k: "silenceWave", K: P2(K), dark: P.color, glow: P.glow }), 700);
}
async function protoOff(fx) {
  if (!st.proto) return toast("Протокол не активен");
  const P = PROTO[st.proto], K = st.pk && await token(st.pk);
  if (fx && K && P) emit({ k: "protoOff", K: P2(K), col: P.glow || P.color });
  return mutate(s => { s.proto = null; s.pk = null; s.wall = null; s.snap = null; return s; });
}
async function wallPick() {
  if (st.proto !== "div") return toast("Протокол Разделения не активен");
  const p = await pickPoints({ n: 2, labels: ["Начало стены", "Конец стены"], snap: false });
  let wall;
  if (p) wall = { a: { x: p[0].x, y: p[0].y }, b: { x: p[1].x, y: p[1].y } };
  else { const K = st.pk && await token(st.pk); if (!K) return; const L = DPI * 12; wall = { a: { x: K.x - L, y: K.y }, b: { x: K.x + L, y: K.y } }; toast("Стена по умолчанию: горизонталь через Ключ («Переставить стену» — выбрать заново)"); }
  return mutate(s => { if (s.proto !== "div") return null; s.wall = wall; return s; });
}
async function shuffle(ids) {
  let hs = ids && ids.length >= 2 ? (await tokens(ids)).filter(t => t.id !== st.boss && !Object.values(st.keys).includes(t.id)) : await heroesSnap();
  if (hs.length < 2) return toast("Для перестановки нужно хотя бы два героя на сцене");
  const idx = shuffleMap(hs);
  const moves = hs.map((h, i) => ({ id: h.id, a: P2(h), b: P2(hs[idx[i]]) }));
  const tp = emit({ k: "shuffle", moves: moves.map(({ a, b }) => ({ a, b })), col: PROTO.perm.glow }) || 650;
  setTimeout(() => { for (const mv of moves) teleportToken(mv.id, { x: mv.b.x, y: mv.b.y }); }, tp);
}
async function loopRewind() {
  if (st.proto !== "loop" || !st.snap || !st.snap.length) return toast("Нет запомненных позиций Петли");
  const snap = st.snap, cur = await tokens(snap.map(g => g.id)), byId = new Map(cur.map(t => [t.id, t]));
  const moves = []; for (const g of snap) { const t = byId.get(g.id); if (t && t.vis !== false && V.dist(t, g) > DPI * .1) moves.push({ id: g.id, a: P2(t), b: { x: g.x, y: g.y, r: g.r }, r: g.r }); }
  const K = st.pk && await token(st.pk);
  const t0 = emit({ k: "loopRewind", K: K ? P2(K) : null, moves: moves.map(({ a, b, r }) => ({ a, b, r })), col: PROTO.loop.color }) || 200;
  setTimeout(() => { for (const mv of moves) moveToken(mv.id, { x: mv.b.x, y: mv.b.y }, 900, 16); }, t0);
  setTimeout(() => emit({ k: "msg", text: "⏳ ПЕТЛЯ · ВРЕМЯ ОТКАТИЛОСЬ", col: PROTO.loop.color }), 300);
}
async function loopBreak(text) {
  if (st.proto !== "loop") return toast("Протокол Петли не активен");
  const K = st.pk && await token(st.pk);
  emit({ k: "loopShatter", K: K ? P2(K) : null, ghosts: (st.snap || []).map(g => ({ x: g.x, y: g.y, r: g.r })), col: PROTO.loop.color });
  setTimeout(() => emit({ k: "msg", text: "⏳ " + text.toUpperCase(), col: PROTO.loop.color }), 400);
  return mutate(s => { s.snap = null; if (s.proto === "loop") { s.proto = null; s.pk = null; } return s; });
}
async function keyBreak(B, id) {
  const K = id && await token(id); if (!K) return toast("Выдели токен Ключа");
  const p = Object.keys(st.keys).find(k => st.keys[k] === id) || null, P = p && PROTO[p];
  const tx = emit({ k: "keyBreak", B: P2(B), K: P2(K), col: P ? (P.glow || P.color) : PAL.cy }) || 1500;
  setTimeout(() => setVisible(id, false), tx + 60);
  later(tx + 100, s => { if (p) s.broken[p] = true; if (s.pk === id) { s.proto = null; s.pk = null; s.wall = null; s.snap = null; } return s; });
  const left = Object.entries(st.keys).filter(([k, v]) => v && !st.broken[k] && v !== id).length;
  setTimeout(() => emit({ k: "msg", text: `💥 ${P ? P.key : "КЛЮЧ"} РАЗРУШЕН · −200 HP · −1 КД · СТИРАНИЕ ПЕРЕЗАРЯЖЕНО`, col: P ? (P.glow || P.color) : PAL.cy }), tx + 400);
  if (p) setTimeout(() => toast(`Осталось целых Ключей: ${left}. Порог HP босса теперь ${left * 200}`), tx + 500);
}

// ────────── Инициатива: сроки эффектов, автооткат Петли, напоминание о заряде ──────────
let turnPos = null;
function onTurns() {
  const { pos, events } = turnEvents(turnPos, init);
  const prev = turnPos; turnPos = pos;
  if (!events.length) return;
  const bossChip = st.bn ? matchChip(st.bn, chips()) : null;
  if (bossChip && events.some(ev => ev.t === "s" && sameName(ev.w, bossChip))) {
    const ch = st.e.find(x => x.a === "charge");
    if (ch) note(`🎯 Ход Эмерджентности: Стирание заряжено на «${ch.tn}» — пора бить`);
  }
  if (prev && pos && pos.r > prev.r && st.proto === "loop" && st.snap && st.autoLoop) setTimeout(loopRewind, 400);
  mutate(s => {
    const { keep, gone, touched } = applyEvents(s.e, events);
    if (!touched) return null;
    for (const g of gone) note(`⌛ Закончилось: ${(EFF[g.a] && EFF[g.a].name) || g.a} — ${g.tn}`);
    s.e = keep; return s;
  });
}

// ────────── Запуск ──────────
let initSig = "";
function onMeta(md) {
  st = normState(md[STATE]);
  init = md[INIT] || null;
  const sig = JSON.stringify(init ? [init.r, (init.chips || []).map(c => [c.n, !!c.on])] : null);
  if (GM && sig !== initSig) { initSig = sig; onTurns(); }
  refreshPos(); alarm();
}
async function sceneReady() {
  await grid(); FT = await feetPerCell();
  ready = true;
  try { onMeta(await OBR.room.getMetadata()); } catch (e) {}
}
OBR.onReady(async () => {
  try { GM = (await OBR.player.getRole()) === "GM"; } catch (e) {}
  OBR.player.onChange(p => { GM = p.role === "GM"; });
  OBR.room.onMetadataChange(md => { if (ready) onMeta(md); });
  OBR.broadcast.onMessage(CH, ev => {
    const m = ev.data || {};
    if (m.op === "play") { if (ready) playFx(m); }
    else if (m.op === "cmd" && GM) { if (!ready) return toast("Сцена не готова"); cmd(m).catch(e => { console.warn("[emergence] cmd", e); toast("Ошибка: " + (e && e.message || e)); }); }
  });
  OBR.scene.items.onChange(() => { if (ready) posSoon(); });
  OBR.scene.onReadyChange(r => { if (r) sceneReady(); else { ready = false; for (const o of LIVE.values()) stop(o.anim, true); LIVE.clear(); } });
  try { if (await OBR.scene.isReady()) sceneReady(); } catch (e) {}
  OBR.viewport && setInterval(alarm, 1500);
  window.addEventListener("storage", () => alarm());
});
