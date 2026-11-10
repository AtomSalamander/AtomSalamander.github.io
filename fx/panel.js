// Панель мастера: выбор заклинателя/целей, список способностей, активные эффекты.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { STATE, INIT, CH, PANEL, normState } from "./const.js";
import { ABILITIES, ABIL } from "./abilities.js";
import { matchChip, untilText } from "./turns.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pinned = new URLSearchParams(location.search).has("pin");
const SK = "dndfx_sel", AK = "dndfx_ab";
let chips = [], state = normState(null), isGM = false;
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
  drawWho();
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
    if (q && !(a.name + " " + (a.group || "") + " " + (a.desc || "")).toLowerCase().includes(q)) continue;
    if ((a.group || "") !== g) { g = a.group || ""; if (g) html += `<div class="grp">${esc(g)}</div>`; }
    html += `<div class="ab${a.id === cur ? " sel" : ""}" data-id="${esc(a.id)}"><i>${esc(a.icon || "✨")}</i><div><b>${esc(a.name)}${a.aura ? " · ⏳" : ""}</b><small>${esc(a.desc || "")}</small></div></div>`;
  }
  $("list").innerHTML = html || `<div class="empty">Ничего не найдено</div>`;
  $("list").querySelectorAll(".ab").forEach(el => {
    el.onclick = () => pick(el.dataset.id);
    el.ondblclick = () => { pick(el.dataset.id); cast(); };
  });
}
$("q").oninput = drawList;

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
  $("goSave").hidden = !A.save;
  $("go").textContent = A.save ? `✨ Провал (${A.save}) — эффект` : "✨ Применить";
  $("goSave").textContent = `🛡️ Спасбросок пройден — без эффекта`;
  drawWho(true);
  drawList();
}
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
  // токены могли удалить — пр��верим
  const exist = new Set((await OBR.scene.items.getItems([sel.c && sel.c.id, ...sel.t.map(t => t.id)].filter(Boolean))).map(i => i.id));
  const c = sel.c && exist.has(sel.c.id) ? sel.c : null;
  const t = sel.t.filter(x => exist.has(x.id));
  const needsCaster = (A.cast || []).some(s => s.fx === "projectile" || s.fx === "beam") || A.auraOn === "caster";
  if (needsCaster && !c) return toast("Нужен заклинатель: выдели его и нажми «← выделение» у «Кто»");
  if (!t.length && !c) return toast("Выбери цели");
  const targets = t.length ? t : [c];
  const e = {}, list = [], lost = [];
  if (A.aura && !saved) {
    const mode = $("uMode").value, who = $("uWho").value;
    const m = mode === "x" ? "x" : mode[0];
    const n = mode.endsWith("N") ? Math.max(1, Math.min(100, +$("uNum").value || 1)) : mode === "e0" ? 0 : 1;
    for (const o of A.auraOn === "caster" ? [c] : targets) {
      let w = null, mm = m;
      if (m !== "x") {
        w = who === "@c" ? (c && matchChip(c.name, chips)) : who === "@t" ? matchChip(o.name, chips) : who.slice(1);
        if (!w) { mm = "x"; lost.push(who === "@c" && c ? c.name : o.name); }
      }
      const id = uid(); e[o.id] = id;
      list.push({ id, a: A.id, tok: o.id, tn: o.name, w, m: mm, n, k: 0 });
    }
  }
  await OBR.broadcast.sendMessage(CH, { op: "play", a: A.id, v: saved ? "save" : undefined, c: c ? c.id : null, t: targets.map(x => x.id), e }, { destination: "ALL" });
  if (list.length) await OBR.broadcast.sendMessage(CH, { op: "add", list }, { destination: "LOCAL" });
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
    return `<div class="fx"><div><b>${esc(A.icon || "✨")} ${esc(A.name)}</b> → ${esc(e.tn)}<small>${esc(untilText(e))}</small></div>${isGM ? `<button data-id="${esc(e.id)}" title="Снять">✕</button>` : ""}</div>`;
  }).join("") : `<div class="empty">Нет активных эффектов</div>`;
  $("act").querySelectorAll("button").forEach(b => b.onclick = () => OBR.broadcast.sendMessage(CH, { op: "del", ids: [b.dataset.id] }, { destination: "LOCAL" }));
  $("clr").hidden = !isGM || L.length < 2;
}
$("clr").onclick = () => { if (confirm("Снять все эффекты?")) OBR.broadcast.sendMessage(CH, { op: "clear" }, { destination: "LOCAL" }); };

function onMeta(md) {
  state = normState(md[STATE]);
  const P = md[INIT];
  chips = P && Array.isArray(P.chips) ? P.chips : [];
  drawActive(); drawWho();
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
  $("gm").hidden = !isGM; $("pl").hidden = isGM; $("pin").hidden = !isGM && !pinned;
  drawSel(); drawList(); if (ABIL[cur]) pick(cur);
  onMeta(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(onMeta);
});
