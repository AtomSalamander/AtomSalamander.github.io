// Панель: выбор заклинателя/целей, список способностей, активные эффекты.
// Мастер видит всё и галочками «👥» разрешает способности игрокам; игроки видят только разрешённое.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { STATE, INIT, CH, PANEL, ALLOW, SEL, normState } from "./const.js";
import { ABILITIES, ABIL, ELEMENTS, elOf, aimKind, radOf } from "./abilities.js";
import { untilText } from "./turns.js";
import { addSlot, openBar, closeBar, loadBar } from "./barctl.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pinned = new URLSearchParams(location.search).has("pin");
const SK = SEL, AK = "dndfx_ab", EK = "dndfx_el_", RK = "dndfx_r_", TK = "dndfx_att_";
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
// кнопка «по выделенным целям» — если цели уже выбраны через Alt+2
function drawGoSel() {
  const A = ABIL[cur], b = $("goSel");
  if (!b) return;
  const n = (sel.t || []).length;
  b.hidden = !A || aimKind(A) === "area" || aimKind(A) === "self" || !n;
  b.textContent = `⤷ Сразу по выделенным целям (${n}) · Alt+2`;
}
function drawSel() {
  drawGoSel();
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
    html += `<div class="ab${a.id === cur ? " sel" : ""}" data-id="${esc(a.id)}"><i>${esc(a.icon || "✨")}</i><div><b>${esc(a.name)}${a.aura ? " · ⏳" : ""}</b>${a.desc ? `<small>${esc(a.desc)}</small>` : ""}</div>${isGM ? `<label class="al" title="Разрешить игрокам"><input type="checkbox" data-al="${esc(a.id)}"${allow.has(a.id) ? " checked" : ""}>👥</label>` : ""}</div>`;
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
  $("goSave").hidden = !!A.area || !!A.self || (!A.save && !A.attack);
  const k = aimKind(A), pickT = k === "dir" ? " — выбрать цель/место" : " — выбрать цель";
  $("go").textContent = k === "area" ? "🎯 Прицелиться — клик по карте" : k === "self" ? "✨ Применить на себя" : A.attack ? "🎯 Попадание" + pickT : A.save ? `✨ Провал (${A.save})` + pickT : "✨ Применить" + pickT;
  $("goSave").textContent = A.attack ? "💨 Промах" + pickT : "🛡️ Спасбросок пройден" + pickT;
  drawGoSel();
  drawWho(true); drawEl(); drawRad(); drawAtt();
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
// радиус регулируемой области (Тьма)
function drawRad() {
  const A = ABIL[cur], row = $("rRow");
  if (!row) return;
  if (!A || !A.area || !A.area.adjust) { row.style.display = "none"; return; }
  row.style.display = "";
  const [lo, hi, st] = A.area.adjust, i = $("rad");
  i.min = lo; i.max = hi; i.step = st;
  i.value = radOf(A, localStorage.getItem(RK + A.id));
}
function setRad(v) {
  const A = ABIL[cur]; if (!A || !A.area || !A.area.adjust) return;
  const r = radOf(A, v); $("rad").value = r;
  try { localStorage.setItem(RK + A.id, r); } catch (e) {}
}
const radStep = () => ((ABIL[cur] && ABIL[cur].area && ABIL[cur].area.adjust) || [0, 0, 5])[2];
$("rad").onchange = () => setRad($("rad").value);
$("rDn").onclick = () => setRad(+$("rad").value - radStep());
$("rUp").onclick = () => setRad(+$("rad").value + radStep());
$("rad").onwheel = ev => { ev.preventDefault(); setRad(+$("rad").value + (ev.deltaY > 0 ? -1 : 1) * radStep()); };
// прикрепление зоны к токену (Тьма)
const canAtt = A => !!(A && A.zone && A.attachable);
function drawAtt() {
  const A = ABIL[cur], row = $("aRow");
  if (!row) return;
  row.style.display = canAtt(A) ? "" : "none";
  if (canAtt(A)) $("att").checked = localStorage.getItem(TK + A.id) !== "0";
}
$("att").onchange = () => { try { localStorage.setItem(TK + cur, $("att").checked ? "1" : "0"); } catch (e) {} };
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

// ── применение: фон включает прицел (область / клик по цели или месту) ──
const curEl = A => A.elements ? elOf(A, $("el").value) : undefined;
const curRad = A => A.area && A.area.adjust ? radOf(A, $("rad").value) : undefined;
const curAtt = A => canAtt(A) ? !!$("att").checked : undefined;
const curDur = A => A.aura ? { mode: $("uMode").value, who: $("uWho").value, n: $("uNum").value } : null;
async function cast(saved = false, use) {
  const A = ABIL[cur]; if (!A) return;
  if (!canUse(A)) return toast("🔒 Мастер закрыл эту способность");
  await OBR.broadcast.sendMessage(CH, { op: "cast", a: A.id, v: saved ? "save" : undefined, el: curEl(A), dur: curDur(A), rad: curRad(A), att: curAtt(A), use }, { destination: "LOCAL" });
  const k = aimKind(A);
  if (use === "sel" || k === "self") return toast(`${A.icon || "✨"} ${A.name}`);
  toast(k === "area" ? "🎯 Наведи на карте и кликни · Esc — отмена" : `🎯 Кликни по ${k === "dir" ? "цели или месту" : "токену"} · Shift — несколько · Esc — отмена`);
  if (!pinned) { try { await OBR.action.close(); } catch (e) {} }
}
$("go").onclick = () => cast(false);
$("goSave").onclick = () => cast(true);
$("goSel").onclick = () => cast(false, "sel");
$("fav").onclick = async () => {
  const A = ABIL[cur]; if (!A) return;
  const added = await addSlot({ a: A.id, el: curEl(A), dur: curDur(A), rad: curRad(A), att: curAtt(A) });
  toast(added ? `⭐ ${A.name} — в панели быстрого доступа` : `⭐ ${A.name}: настройки обновлены`);
};
$("barBtn").onclick = async () => { if (loadBar().open) await closeBar(); else await openBar(); };

// ── активные эффекты ──
const rdBtns = (e, A) => {
  const st = ((A.area && A.area.adjust) || [0, 0, 5])[2];
  return `<button class="rd" data-rd="${esc(e.id)}" data-d="${-st}" title="Радиус −${st} фт">−</button><button class="rd" data-rd="${esc(e.id)}" data-d="${st}" title="Радиус +${st} фт">+</button>`;
};
function drawActive() {
  const L = state.e;
  $("act").innerHTML = L.length ? L.map(e => {
    const A = ABIL[e.a] || { name: e.a, icon: "✨" };
    const where = e.pt ? (e.tok ? `📎 ${esc(e.tn)} · сфера ${esc(e.rr)} фт` : "📍 сфера " + esc(e.rr) + " фт") : esc(e.tn);
    const att = isGM && e.pt && A.zone && A.attachable
      ? `<button class="rd" data-at="${esc(e.id)}" data-on="${e.tok ? 1 : 0}" title="${e.tok ? "Открепить — оставить там, где сейчас токен" : "Прикрепить к выделенному токену"}">${e.tok ? "📍" : "📎"}</button>` : "";
    return `<div class="fx"><div><b>${esc(A.icon || "✨")} ${esc(A.name)}${e.el && ELEMENTS[e.el] ? " · " + esc(ELEMENTS[e.el].name) : ""}</b> → ${where}<small>${esc(untilText(e))}</small></div>${isGM && e.pt ? rdBtns(e, A) : ""}${att}${isGM ? `<button data-id="${esc(e.id)}" title="Снять">✕</button>` : ""}</div>`;
  }).join("") : `<div class="empty">Нет активных эффектов</div>`;
  $("act").querySelectorAll("button[data-rd]").forEach(b => b.onclick = () => OBR.broadcast.sendMessage(CH, { op: "rad", id: b.dataset.rd, d: +b.dataset.d }, { destination: "LOCAL" }));
  $("act").querySelectorAll("button[data-at]").forEach(b => b.onclick = async () => {
    let tok = null;
    if (b.dataset.on !== "1") {
      const s = await fromSelection(); if (!s.length) return;
      tok = s[0];
    }
    await OBR.broadcast.sendMessage(CH, { op: "att", id: b.dataset.at, tok }, { destination: "LOCAL" });
    toast(tok ? `📎 Тьма прикреплена к «${tok.name}»` : "📍 Тьма откреплена и осталась на месте");
  });
  $("act").querySelectorAll("button[data-id]").forEach(b => b.onclick = () => OBR.broadcast.sendMessage(CH, { op: "del", ids: [b.dataset.id] }, { destination: "LOCAL" }));
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
