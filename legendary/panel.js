import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { CH, STORE, THEMES, DURATIONS } from "./const.js";

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- состояние (хранится в браузере мастера) ----------
const DEF = { boss: "", act: "", cost: 0, dur: 5, theme: "gold", lib: {} };
let st = load();
function load() {
  try { return { ...DEF, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; } catch (e) { return { ...DEF }; }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {} }

function toast(t) { const el = $("#toast"); el.textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => el.textContent = "", 4000); }

// ---------- отрисовка ----------
function drawSeg(box, items, cur, key) {
  box.innerHTML = items.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(cur) ? "on" : ""}">${l}</button>`).join("");
  box.onclick = e => { const b = e.target.closest("button"); if (!b) return; st[key] = +b.dataset.v; save(); drawControls(); };
}
function drawControls() {
  drawSeg($("#cost"), [[0, "—"], [1, "1"], [2, "2"], [3, "3"]], st.cost, "cost");
  drawSeg($("#dur"), DURATIONS.map(d => [d, d + "с"]), st.dur, "dur");
  const tb = $("#theme");
  tb.innerHTML = Object.entries(THEMES).map(([k, t]) =>
    `<button data-k="${k}" title="${t.name}" aria-label="${t.name}" class="${k === st.theme ? "on" : ""}" style="--c:${t.g}"></button>`).join("");
  tb.onclick = e => { const b = e.target.closest("button"); if (!b) return; st.theme = b.dataset.k; save(); drawControls(); };
  drawPreview();
}
function drawPreview() {
  $("#pB").textContent = st.boss.trim() || "Имя босса";
  $("#pA").textContent = "«" + (st.act.trim() || "Название действия") + "»";
  $("#preview").style.setProperty("--pc", (THEMES[st.theme] || THEMES.gold).a);
}
function drawLib() {
  const boss = st.boss.trim();
  $("#libTitle").textContent = boss ? `Действия: ${boss}` : "Действия босса";
  const list = st.lib[boss] || [];
  $("#lib").innerHTML = list.length
    ? list.map((x, i) => `<span class="chip"><button class="go" data-i="${i}" title="Показать всем">${esc(x.act)}${x.cost ? `<small>${"◆".repeat(x.cost)}</small>` : ""}</button><button class="x" data-del="${i}" title="Удалить" aria-label="Удалить">×</button></span>`).join("")
    : `<div class="empty">Пока пусто.</div>`;
}

// ---------- отправка ----------
async function announce(dest, item) {
  const boss = st.boss.trim();
  const act = (item ? item.act : st.act).trim();
  const cost = item ? item.cost : st.cost;
  if (!boss) { toast("Введи имя босса"); $("#boss").focus(); return; }
  if (!act) { toast("Введи название действия"); $("#act").focus(); return; }
  const msg = { op: "show", boss, act, cost, theme: st.theme, dur: st.dur * 1000, t: Date.now() };
  try {
    await OBR.broadcast.sendMessage(CH, msg, { destination: dest });
  } catch (e) { toast("Не удалось отправить"); console.warn("[legendary]", e); return; }
  if (dest === "ALL") {
    const list = (st.lib[boss] ||= []);
    const i = list.findIndex(x => x.act.toLowerCase() === act.toLowerCase());
    if (i >= 0) list.splice(i, 1);
    list.unshift({ act, cost });
    list.length = Math.min(list.length, 16);
    save(); drawLib();
    toast(`Показано всем: «${act}»`);
  } else toast("Предпросмотр — видишь только ты");
}

async function bossFromSelection() {
  try {
    const ids = (await OBR.player.getSelection()) || [];
    if (!ids.length) { toast("Сначала выдели токен босса"); return; }
    const [it] = await OBR.scene.items.getItems([ids[0]]);
    const name = (it && ((it.text && it.text.plainText) || it.name) || "").trim();
    if (!name) { toast("У токена нет имени"); return; }
    st.boss = name; $("#boss").value = name; save(); drawPreview(); drawLib();
  } catch (e) { toast("Не удалось прочитать токен"); }
}

// ---------- события ----------
$("#boss").value = st.boss;
$("#act").value = st.act;
$("#boss").addEventListener("input", e => { st.boss = e.target.value; save(); drawPreview(); drawLib(); });
$("#act").addEventListener("input", e => { st.act = e.target.value; save(); drawPreview(); });
$("#act").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); announce("ALL"); } });
$("#announce").onclick = () => announce("ALL");
$("#preview1").onclick = () => announce("LOCAL");
$("#hide").onclick = () => OBR.broadcast.sendMessage(CH, { op: "hide" }, { destination: "ALL" }).catch(() => {});
$("#fromSel").onclick = bossFromSelection;
$("#lib").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  const list = st.lib[st.boss.trim()] || [];
  if (b.dataset.del != null) { list.splice(+b.dataset.del, 1); save(); drawLib(); return; }
  const it = list[+b.dataset.i]; if (!it) return;
  st.act = it.act; st.cost = it.cost; $("#act").value = it.act; save(); drawControls();
  announce("ALL", it);
};

drawControls();
drawLib();

OBR.onReady(async () => {
  let gm = false;
  try { gm = (await OBR.player.getRole()) === "GM"; } catch (e) {}
  if (!gm) { $("#ui").style.display = "none"; $("#gmOnly").style.display = "block"; }
});
