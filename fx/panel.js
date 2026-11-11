// Панель: выбор заклинателя/целей, список способностей, активные эффекты.
// Мастер видит всё и галочками «👥» разрешает способности игрокам; игроки видят только разрешённое.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { STATE, INIT, CH, PANEL, ALLOW, SEL, normState } from "./const.js";
import { ABILITIES, ABIL, ELEMENTS, elOf } from "./abilities.js";
import { makeEffects, untilText } from "./turns.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pinned = new URLSearchParams(location.search).has("pin");
const SK = SEL, AK = "dndfx_ab", EK = "dndfx_el_";
let chips = [], state = normState(null), isGM = false, allow = new Set(), roleKnown = false;
const canUse = a => isGM || allow.has(a.id);
let sel = load(SK) || { c: null, t: [] };
let cur = localStorage.getItem(AK) || "";

function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function saveSel() { try { localStorage.setItem(SK, JSON.stringify(sel)); } catch (e) {} }
let tt = 0;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 3500); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const tokName = it => (it.text && it.text.plainText || "").trim() || it.name || "без имени";

// ── заклинатель и цели ──
async function fromSelection() {
  const ids = (await OBR.player.getSelection()) || [];
  if (!ids.length) { toast("Сначала выдели токен(ы) на карте"); return []; }
  const items = await OBR.scene.items.getItems(ids);
  return items.map(i => ({ id: i.id, name: tokName(i) }));
}
function drawSel() {
  $("cN").textContent = sel.c ? sel.c.name : "—";
  $("tN").textContent = sel.t.length ? sel.t.map(t => t.name).join(", ") : "—";
  $("tN").title = $("tN").textContent;
  drawWho(); drawEl();
}
$("cSet").onclick = async () => { const s = await fromSelection(); if (s.length) { sel.c = s[0]; saveSel(); drawSel(); } };
$("tSet").onclick = async () => { const s = await fromSelection(); if (s.length) { sel.t = s; saveSel(); drawSel(); } };
$("cClr").onclick = () => { sel.c = null; saveSel(); drawSel(); };
$("tClr").onclick = () => { sel.t = []; saveSel(); drawSel(); };

// ── список способностей ──
function drawList() {
  const q = $("q").value.trim().toLowerCase();
  let html = "", g = null;
  for (const a of ABILITIES) {
    if (!canUse(a)) continue;
    if (q && !(a.name + " " + (a.group || "") + " " + (a.desc || "")).toLowerCase().includes(q)) continue;
    if ((a.group || "") !== g) { g = a.group || ""; if (g) html += `<div class="grp">${esc(g)}</div>`; }
    html += `<div class="ab${a.id === cur ? " sel" : ""}" data-id="${esc(a.id)}"><i>${esc(a.icon || "✨")}</i><div><b>${esc(a.name)}${a.aura ? " · ⏳" : ""}</b><small>${esc(a.desc || "")}</small></div>${isGM ? `<label class="al" title="Разрешить игрокам"><input type="checkbox" data-al="${esc(a.id)}"${allow.has(a.id) ? " checked" : ""}>👥</label>` : ""}</div>`;
  }
  $("list").innerHTML = html || `<div class="empty">Ничего не найдено</div>`;
  $("list").querySelectorAll(".al").forEach(l => { l.onclick = ev => ev.stopPropagation(); l.ondblclick = ev => ev.stopPropagation(); });
  $("list").querySelectorAll("input[data-al]").forEach(cb => cb.onchange = () => setAllow(cb.dataset.al, cb.checked));
  $("list").querySelectorAll(".ab").forEach(el => {
    el.onclick = () => pick(el.dataset.id);
    el.ondblclick = () => { pick(el.dataset.id); cast(); };
  });
}
$("q").oninput = drawList;

// галочки «👥 игрокам» — хранятся в метаданных комнаты
async function setAllow(id, on) {
  if (!isGM) return;
  const md = await OBR.room.getMetadata();
  const s = new Set(Array.isArray(md[ALLOW]) ? md[ALLOW] : []);
  on ? s.add(id) : s.delete(id);
  allow = s;
  await OBR.room.setMetadata({ [ALLOW]: [...s].filter(x => ABIL[x]) });
  toast(on ? `👥 Игрокам доступно: ${ABIL[id].name}` : `🔒 Только мастеру: ${ABIL[id].name}`);
}
function drawRole() {
  if (!roleKnown) return;
  const any = isGM || ABILITIES.some(canUse);
  $("gm").hidden = !any; $("pl").hidden = any;
  $("pin").hidden = !any && !pinned;
  $("glH").hidden = !isGM;
  if (!isGM && cur && ABIL[cur] && !canUse(ABIL[cur])) { cur = ""; $("opts").hidden = true; }
  drawList();
}

function pick(id) {
  cur = id; try { localStorage.setItem(AK, id); } catch (e) {}
  const A = ABIL[id];
  $("opts").hidden = !A;
  if (!A) return drawList();
  const u = A.until || { who: "target", when: "x" };
  const n = u.n ?? 1;
  $("uMode").value = u.when === "x" ? "x" : u.when === "e" && n === 0 ? "e0" : n === 1 ? u.when + "1" : u.when + "N";
  $("uNum").value = n > 1 ? n : 10;
  $("uWho").dataset.def = u.who === "caster" ? "@c" : "@t";
  $("goSave").hidden = !!A.area || (!A.save && !A.attack);
  $("go").textContent = A.area ? "🎯 Прицелиться — клик по карте" : A.attack ? "🎯 Попадание" : A.save ? `✨ Провал (${A.save}) — эффект` : "✨ Применить";
  $("goSave").textContent = A.attack ? "💨 Промах" : `🛡️ Спасбросок пройден — без эффекта`;
  drawWho(true); drawEl();
  drawList();
}
// выбор стихии (чародейский выброс, дыхание дракона…)
function drawEl() {
  const A = ABIL[cur], row = $("elRow");
  if (!row) return;
  if (!A || !A.elements) { row.style.display = "none"; return; }
  row.style.display = "";
  let v = localStorage.getItem(EK + A.id);
  if (A.id === "dragons-breath" && sel.c) {   // стихия из «наделения» на этом токене
    const b = state.e.find(e => e.a === "dragons-breath-buff" && e.tok === sel.c.id && e.el);
    if (b) v = b.el;
  }
  const s = $("el");
  s.innerHTML = A.elements.map(k => `<option value="${esc(k)}">${esc((ELEMENTS[k] || {}).name || k)}</option>`).join("");
  s.value = elOf(A, v);
}
$("el").onchange = () => { try { localStorage.setItem(EK + cur, $("el").value); } catch (e) {} };
function drawWho(reset) {
  const A = ABIL[cur], w = $("uWho");
  $("uRow").style.display = $("uRow2").style.display = A && A.aura ? "" : "none";
  const prev = reset ? w.dataset.def : w.value || w.dataset.def;
  const names = [...new Set(chips.map(c => String(c.n)))];
  const tg = A && A.auraOn === "caster" ? "тот, на ком эффект" : "сама цель (у каждой свой)";
  w.innerHTML = `<option value="@t">🎯 ${tg}</option><option value="@c">🪄 заклинатель${sel.c ? " — " + esc(sel.c.name) : ""}</option>` +
    names.map(n => `<option value="=${esc(n)}">${esc(n)}</option>`).join("");
  w.value = [...w.options].some(o => o.value === prev) ? prev : "@t";
  const m = $("uMode").value;
  $("uNum").style.display = m.endsWith("N") ? "" : "none";
  w.disabled = m === "x";
}
$("uMode").onchange = () => drawWho();

// ── применение ──
async function cast(saved = false) {
  const A = ABIL[cur]; if (!A) return;
  if (!canUse(A)) return toast("🔒 Мастер закрыл эту способность");
  // токены могли удалить — пр��верим
  const exist = new Set((await OBR.scene.items.getItems([sel.c && sel.c.id, ...sel.t.map(t => t.id)].filter(Boolean))).map(i => i.id));
  const c = sel.c && exist.has(sel.c.id) ? sel.c : null;
  const t = sel.t.filter(x => exist.has(x.id));
  const el = A.elements ? elOf(A, $("el").value) : undefined;
  const dur = saved ? null : { mode: $("uMode").value, who: $("uWho").value, n: $("uNum").value };
  if (A.area) {   // по области — нужен только «Кто», точку выбирают на карте
    if (!c) return toast("Нужен заклинатель: выдели токен и нажми Alt+1");
    await OBR.broadcast.sendMessage(CH, { op: "aim", a: A.id, c: c.id, cn: c.name, el, dur: A.aura ? dur : null }, { destination: "LOCAL" });
    toast("🎯 Наведи на карте и кликни · Esc — отмена");
    if (!pinned) { try { await OBR.action.close(); } catch (e) {} }
    return;
  }
  const needsCaster = (A.cast || []).some(s => s.fx === "projectile" || s.fx === "beam" || s.fx === "cone" || (s.fx === "bolt" && s.from !== "sky")) || A.auraOn === "caster";
  if (needsCaster && !c) return toast("Нужен заклинатель: выдели его и нажми Alt+1 (или «← выделение» у «Кто»)");
  if (!t.length && !c) return toast("Выбери цели");
  const targets = t.length ? t : [c];
  const { e, list, lost } = makeEffects({ A, c, targets, dur: A.aura ? dur : null, chips, uid, el });
  await OBR.broadcast.sendMessage(CH, { op: "play", a: A.id, v: saved ? "save" : undefined, c: c ? c.id : null, t: targets.map(x => x.id), el, e }, { destination: "ALL" });
  // мастер записывает сам; игрок отправляет мастеру (он держит список активных эффектов)
  if (list.length) await OBR.broadcast.sendMessage(CH, { op: "add", list }, { destination: isGM ? "LOCAL" : "REMOTE" });
  if (lost.length) toast(`Не нашёл в инициативе: ${[...new Set(lost)].join(", ")}. Эффект будет висеть, пока не снимешь.`);
  else toast(`${A.icon || "✨"} ${A.name}`);
}
$("go").onclick = () => cast(false);
$("goSave").onclick = () => cast(true);

// ── активные эффекты ──
function drawActive() {
  const L = state.e;
  $("act").innerHTML = L.length ? L.map(e => {
    const A = ABIL[e.a] || { name: e.a, icon: "✨" };
    return `<div class="fx"><div><b>${esc(A.icon || "✨")} ${esc(A.name)}${e.el && ELEMENTS[e.el] ? " · " + esc(ELEMENTS[e.el].name) : ""}</b> → ${esc(e.tn)}<small>${esc(untilText(e))}</small></div>${isGM ? `<button data-id="${esc(e.id)}" title="Снять">✕</button>` : ""}</div>`;
  }).join("") : `<div class="empty">Нет активных эффектов</div>`;
  $("act").querySelectorAll("button").forEach(b => b.onclick = () => OBR.broadcast.sendMessage(CH, { op: "del", ids: [b.dataset.id] }, { destination: "LOCAL" }));
  $("clr").hidden = !isGM || L.length < 2;
}
$("clr").onclick = () => { if (confirm("Снять все эффекты?")) OBR.broadcast.sendMessage(CH, { op: "clear" }, { destination: "LOCAL" }); };

function onMeta(md) {
  const al = JSON.stringify(Array.isArray(md[ALLOW]) ? [...md[ALLOW]].sort() : []);
  if (al !== JSON.stringify([...allow].sort())) { allow = new Set(JSON.parse(al)); drawRole(); }
  state = normState(md[STATE]);
  const P = md[INIT];
  chips = P && Array.isArray(P.chips) ? P.chips : [];
  drawActive(); drawWho(); drawEl();
}

// ── закрепить панель сбоку (не закрывается при кликах по карте) ──
if (pinned) { $("pin").textContent = "✕"; $("pin").title = "Закрыть панель"; }
$("pin").onclick = async () => {
  if (pinned) { await OBR.popover.close(PANEL); return; }
  const w = await OBR.viewport.getWidth(), h = await OBR.viewport.getHeight();
  await OBR.popover.open({ id: PANEL, url: "/fx/panel.html?pin=1", width: 340, height: Math.max(360, h - 140),
    anchorReference: "POSITION", anchorPosition: { left: Math.max(12, w - 352), top: 70 },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" }, disableClickAway: true });
  try { await OBR.action.close(); } catch (e) {}
};

addEventListener("storage", ev => { if (ev.key === SK) { sel = load(SK) || { c: null, t: [] }; drawSel(); } });

OBR.onReady(async () => {
  isGM = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(p => { const g = p.role === "GM"; if (g !== isGM) { isGM = g; drawRole(); drawActive(); } });
  const md = await OBR.room.getMetadata();
  allow = new Set(Array.isArray(md[ALLOW]) ? md[ALLOW] : []);
  roleKnown = true; drawRole();
  drawSel(); if (ABIL[cur] && canUse(ABIL[cur])) pick(cur);
  onMeta(md);
  OBR.room.onMetadataChange(onMeta);
});
