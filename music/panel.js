import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { META, CH, LS_CFG, LS_HIST, DEF_CFG, BIG_CHOICES, HIST_MAX } from "./const.js";

const $ = s => document.querySelector(s);
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let cfg = { ...DEF_CFG, ...(ls.get(LS_CFG, {}) || {}) };
const saveCfg = () => ls.set(LS_CFG, cfg);
let now = null;   // то, что сейчас в комнате
let ready = false;

function toast(t) { const el = $("#toast"); el.textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => el.textContent = "", 3500); }
const local = op => ready && OBR.broadcast.sendMessage(CH, { op }, { destination: "LOCAL" }).catch(() => {});
const setNow = v => OBR.room.setMetadata({ [META]: v });

// ---------- недавние треки ----------
const hist = () => (ls.get(LS_HIST, []) || []).filter(h => h && h.title);
function remember(title, sub) {
  const list = hist().filter(h => h.title.toLowerCase() !== title.toLowerCase());
  list.unshift({ title, sub });
  ls.set(LS_HIST, list.slice(0, HIST_MAX));
  drawHist();
}
function drawHist() {
  $("#hist").innerHTML = hist().map((h, i) =>
    `<div class="h${now && now.title === h.title ? " cur" : ""}" data-i="${i}" title="Включить"><span>${esc(h.title)}${h.sub ? ` <small style="color:#8d7c63;font-style:normal">· ${esc(h.sub)}</small>` : ""}</span><button type="button" data-del="${i}" title="Убрать из списка">✕</button></div>`).join("");
}
$("#hist").onclick = e => {
  const d = e.target.closest("[data-del]");
  if (d) { const l = hist(); l.splice(+d.dataset.del, 1); ls.set(LS_HIST, l); drawHist(); return; }
  const r = e.target.closest(".h");
  if (r) { const h = hist()[+r.dataset.i]; if (h) play(h.title, h.sub || ""); }
};

// ---------- включить / пауза / убрать ----------
async function play(title, sub) {
  title = String(title || "").trim().slice(0, 160); sub = String(sub || "").trim().slice(0, 80);
  if (!title) { toast("Впиши название трека"); $("#title").focus(); return; }
  if (!ready) return toast("Owlbear ещё загружается…");
  try {
    await setNow({ id: "t:" + Date.now().toString(36), title, playlist: sub, playing: true, big: cfg.big, t: Date.now() });
    remember(title, sub);
    $("#title").value = ""; $("#sub").value = "";
    toast(`▶ Включено у всех: «${title}»`);
  } catch (e) { toast("Не удалось отправить"); }
}
$("#play").onclick = () => play($("#title").value, $("#sub").value);
for (const id of ["#title", "#sub"]) $(id).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#play").click(); } });

$("#pause").onclick = () => {
  if (!now) return;
  setNow({ ...now, playing: now.playing === false, t: Date.now() }).catch(() => toast("Не удалось"));
};
$("#clear").onclick = () => setNow(null).then(() => toast("Плашка убрана у всех")).catch(() => toast("Не удалось"));

function drawSeg(box, items, cur, onPick) {
  box.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? "on" : ""}">${l}</button>`).join("");
  box.onclick = e => { const b = e.target.closest("button"); if (b) onPick(b.dataset.v); };
}
function drawCfg() { drawSeg($("#big"), BIG_CHOICES.map(s => [s, s + " с"]), cfg.big, v => { cfg.big = +v; saveCfg(); drawCfg(); }); }

function drawNow(m) {
  now = m && m.id && m.title ? m : null;
  $("#now").classList.toggle("empty", !now);
  $("#nowK").textContent = now && now.playing === false ? "Пауза" : "Сейчас звучит";
  $("#nowT").textContent = now ? now.title : "Ничего не играет";
  $("#nowT").title = now ? now.title : "";
  $("#nowP").textContent = now && now.playlist ? now.playlist : "";
  $("#pause").disabled = $("#clear").disabled = !now;
  $("#pause").textContent = now && now.playing === false ? "▶ Продолжить" : "⏸ Пауза";
  drawHist();
}

// ---------- плашка у меня ----------
$("#reshow").onclick = () => { local("reshow"); toast("Плашка снова показана"); };
$("#move").onclick = () => local("move");
$("#resetPos").onclick = () => { local("resetPos"); toast("Плашка возвращена к правому нижнему углу"); };

drawCfg();
drawHist();

OBR.onReady(async () => {
  ready = true;
  const role = r => document.body.classList.toggle("isgm", r === "GM");
  try { role(await OBR.player.getRole()); } catch (e) {}
  OBR.player.onChange(p => role(p.role));
  let last = "";
  const onMeta = md => { const m = md[META] || null, raw = JSON.stringify(m); if (raw !== last) { last = raw; drawNow(m); } };
  try { onMeta(await OBR.room.getMetadata()); } catch (e) {}
  OBR.room.onMetadataChange(onMeta);
  if (document.body.classList.contains("isgm")) $("#title").focus();
});
