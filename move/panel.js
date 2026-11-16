// 🏃 Панель передвижения: свой токен, скорость, доп. скорость, ускорение, рывок, отмена шага.
// Мастер дополнительно видит всех участников боя и может включить жёсткий лимит.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  KEY, CFG, INIT, LS_TOK, LS_DIFF, LAYERS, COL, curTurn, isTurnOf, matchChip, tokName, getM, blank,
  perTurn, maxMove, leftOf, fmt, gridInfo, saveM, undoMove, resetMove,
} from "./lib.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let isGM = false, T = null, cfg = {}, items = [], G = { unit: "фт" }, ready = false;

let tt = 0;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 3200); }
const bound = () => { try { return JSON.parse(localStorage.getItem(LS_TOK) || "null"); } catch (e) { return null; } };
function cur() {
  const b = bound(), it = b && items.find(i => i.id === b.id);
  return { b, it, m: it ? getM(it) : null };
}

async function bindSel() {
  const ids = (await OBR.player.getSelection()) || [];
  if (!ids.length) return toast("Сначала выдели свой токен на карте");
  const [it] = await OBR.scene.items.getItems([ids[0]]);
  if (!it || !LAYERS.includes(it.layer)) return toast("Это не токен персонажа");
  try { localStorage.setItem(LS_TOK, JSON.stringify({ id: it.id, name: tokName(it) })); } catch (e) {}
  if (!getM(it)) {
    const ok = await saveM(it.id, { ...blank(), pos: { x: it.position.x, y: it.position.y }, key: T && isTurnOf(tokName(it), T) ? T.key : "" });
    if (!ok) toast("Нет прав на токен — данные запишет мастер");
  }
  draw();
}
async function patch(fn) {
  const { it, m } = cur();
  if (!it) return toast("Сначала привяжи свой токен");
  const o = m || { ...blank(), pos: { x: it.position.x, y: it.position.y } };
  const ok = await saveM(it.id, { ...o, ...fn(o) });
  if (!ok) toast("Нет прав на токен — изменения передал мастеру");
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+v || 0)));
const roundTo5 = v => Math.round(v / 5) * 5;

function meter(m, active) {
  const used = active ? +m.used || 0 : 0, per = perTurn(m), mx = maxMove(m);
  const S = Math.max(mx, used, per, 1);
  const col = used > mx + 0.01 ? COL.over : used > per + 0.01 ? COL.dash : COL.ok;
  let ticks = "";
  for (let k = 1; k <= (m.dash || 0); k++) ticks += `<i class="tick" style="left:${(per * k / S) * 100}%"></i>`;
  const fill = `<b class="fill" style="width:${Math.min(100, used / S * 100)}%;background:${col}"></b>`;
  const dashZone = m.dash ? `<b class="dz" style="left:${per / S * 100}%;width:${(mx - per) / S * 100}%"></b>` : "";
  const left = mx - used;
  $("bar").innerHTML = dashZone + fill + ticks;
  $("nums").innerHTML = active
    ? `Пройдено <b>${fmt(used)}</b> из <b>${fmt(mx)}</b> ${esc(G.unit)} · ${left >= -0.01 ? `осталось <b style="color:${col}">${fmt(left)}</b>` : `<b style="color:${COL.over}">превышение ${fmt(-left)}</b>`}`
    : `За ход: <b>${fmt(mx)}</b> ${esc(G.unit)}${m.dash ? ` (с рывком)` : ""}`;
}

function draw() {
  if (!ready) return;
  const { b, it, m } = cur();
  $("tok").textContent = b ? (it ? tokName(it) : `${b.name} (нет на сцене)`) : "— не выбран";
  const has = !!(it && m);
  $("body").hidden = !has;
  $("noTok").hidden = has;
  const active = !!(has && T && m.key === T.key);
  // чей ход
  let st;
  if (!T) st = "⚪ Бой не идёт — расстояние не считается";
  else if (active) st = "🟢 <b>Твой ход!</b> Двигай токен — расстояние считается";
  else if (it && !matchChip(tokName(it), T.chips)) st = `⚠️ Имени «${esc(tokName(it))}» нет в инициативе`;
  else st = `⏳ Сейчас ходит: <b>${esc(T.w)}</b>`;
  $("turn").innerHTML = st;
  $("turn").className = "turn" + (active ? " on" : "");
  if (has) {
    meter(m, active);
    $("sp").value = m.sp;
    $("ex").value = m.ex || 0;
    $("x2").checked = !!m.x2;
    $("dashN").textContent = m.dash ? `×${m.dash}` : "";
    $("dashDn").disabled = !m.dash;
    $("undo").disabled = !active || !m.tr.length;
    $("reset").disabled = !active || !(+m.used);
  }
  $("diff").checked = localStorage.getItem(LS_DIFF) === "1";
  drawGM();
}

function drawGM() {
  $("gm").hidden = !isGM;
  if (!isGM) return;
  $("hard").checked = !!cfg.hard;
  const order = T ? T.chips.map(c => String(c.n)) : [];
  const L = items.filter(i => LAYERS.includes(i.layer) && getM(i)).map(i => ({ it: i, m: getM(i), w: T ? matchChip(tokName(i), T.chips) : null }));
  L.sort((a, b) => (a.w ? order.indexOf(a.w) : 999) - (b.w ? order.indexOf(b.w) : 999));
  $("all").innerHTML = L.length ? L.map(({ it, m }) => {
    const on = !!(T && m.key === T.key), used = on ? +m.used || 0 : 0, mx = maxMove(m);
    const col = used > mx + 0.01 ? COL.over : used > perTurn(m) + 0.01 ? COL.dash : COL.ok;
    return `<div class="row${on ? " on" : ""}"><span class="nm" title="${esc(tokName(it))}">${on ? "▶ " : ""}${esc(tokName(it))}</span>` +
      `<span class="v" style="color:${on ? col : "inherit"}">${fmt(used)}/${fmt(mx)}</span>` +
      `<button data-pick="${esc(it.id)}" title="Настроить этот токен">✎</button>` +
      `<button data-undo="${esc(it.id)}" title="Отменить шаг"${on && m.tr.length ? "" : " disabled"}>↶</button>` +
      `<button data-reset="${esc(it.id)}" title="Сбросить ход"${on && +m.used ? "" : " disabled"}>⟲</button></div>`;
  }).join("") : `<div class="empty">Пока никто не привязан. Игроки привязывают свои токены сами.</div>`;
  $("all").querySelectorAll("[data-undo]").forEach(b => b.onclick = () => undoMove(b.dataset.undo));
  $("all").querySelectorAll("[data-reset]").forEach(b => b.onclick = () => resetMove(b.dataset.reset));
  $("all").querySelectorAll("[data-pick]").forEach(b => b.onclick = () => {
    const it = items.find(i => i.id === b.dataset.pick); if (!it) return;
    try { localStorage.setItem(LS_TOK, JSON.stringify({ id: it.id, name: tokName(it) })); } catch (e) {}
    draw(); toast(`✎ Настраиваешь: ${tokName(it)}`);
  });
}

// ── управление ──
$("bind").onclick = bindSel;
$("bind2").onclick = bindSel;
$("sp").onchange = () => patch(() => ({ sp: clamp($("sp").value, 0, 999) }));
$("spDn").onclick = () => patch(m => ({ sp: clamp(roundTo5(+m.sp - 5), 0, 999) }));
$("spUp").onclick = () => patch(m => ({ sp: clamp(roundTo5(+m.sp + 5), 0, 999) }));
$("ex").onchange = () => patch(() => ({ ex: clamp($("ex").value, -999, 999) }));
$("exDn").onclick = () => patch(m => ({ ex: clamp((+m.ex || 0) - 5, -999, 999) }));
$("exUp").onclick = () => patch(m => ({ ex: clamp((+m.ex || 0) + 5, -999, 999) }));
$("x2").onchange = () => patch(() => ({ x2: $("x2").checked }));
$("dashUp").onclick = () => patch(m => ({ dash: Math.min(3, (+m.dash || 0) + 1) }));
$("dashDn").onclick = () => patch(m => ({ dash: Math.max(0, (+m.dash || 0) - 1) }));
$("diff").onchange = () => { try { localStorage.setItem(LS_DIFF, $("diff").checked ? "1" : "0"); } catch (e) {} };
$("undo").onclick = () => { const { it } = cur(); if (it) undoMove(it.id); };
$("reset").onclick = () => { const { it } = cur(); if (it) resetMove(it.id); };
$("hard").onchange = () => { if (isGM) OBR.room.setMetadata({ [CFG]: { ...cfg, hard: $("hard").checked } }); };
addEventListener("storage", ev => { if (ev.key === LS_TOK || ev.key === LS_DIFF) draw(); });

async function loadScene() {
  try {
    if (!(await OBR.scene.isReady())) { items = []; return draw(); }
    G = await gridInfo();
    items = await OBR.scene.items.getItems();
  } catch (e) { items = []; }
  draw();
}

OBR.onReady(async () => {
  try {
    const th = await OBR.theme.getTheme();
    document.body.classList.toggle("light", th.mode === "LIGHT");
    if (th.text) document.body.style.color = th.text.primary;
  } catch (e) {}
  isGM = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(p => { const g = p.role === "GM"; if (g !== isGM) { isGM = g; draw(); } });
  const md = await OBR.room.getMetadata();
  T = curTurn(md[INIT]); cfg = md[CFG] || {};
  OBR.room.onMetadataChange(md => { T = curTurn(md[INIT]); cfg = md[CFG] || {}; draw(); });
  OBR.scene.onReadyChange(loadScene);
  OBR.scene.items.onChange(list => { items = list; draw(); });
  ready = true;
  await loadScene();
});
