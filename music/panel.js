import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { META, CH, LS_CFG, LS_STATUS, DEF_CFG, BIG_CHOICES } from "./const.js";
import { readKenku, explain } from "./kenku.js";

const $ = s => document.querySelector(s);
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
};

let cfg = { ...DEF_CFG, ...(ls.get(LS_CFG, {}) || {}) };
const saveCfg = () => ls.set(LS_CFG, cfg);

function toast(t) { const el = $("#toast"); el.textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => el.textContent = "", 4000); }
const local = op => OBR.broadcast.sendMessage(CH, { op }, { destination: "LOCAL" }).catch(() => {});

// ---------- настройки мастера ----------
function drawSeg(box, items, cur, onPick) {
  box.innerHTML = items.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(v) === String(cur) ? "on" : ""}">${l}</button>`).join("");
  box.onclick = e => { const b = e.target.closest("button"); if (b) onPick(b.dataset.v); };
}
function drawCfg() {
  drawSeg($("#on"), [["1", "Вкл"], ["0", "Выкл"]], cfg.on ? "1" : "0", v => {
    cfg.on = v === "1"; saveCfg(); drawCfg(); local("poll");
    toast(cfg.on ? "Трансляция из Kenku включена" : "Трансляция выключена, плашка убрана");
  });
  drawSeg($("#big"), BIG_CHOICES.map(s => [s, s + "с"]), cfg.big, v => { cfg.big = +v; saveCfg(); drawCfg(); });
}

function drawStatus() {
  const s = ls.get(LS_STATUS, null);
  const box = $("#status");
  box.className = "";
  if (!s) { $("#stText").textContent = "Проверяю связь…"; return; }
  const stale = Date.now() - (s.at || 0) > 10000;
  if (s.state === "off") { $("#stText").textContent = "Трансляция из Kenku выключена"; return; }
  if (stale) { $("#stText").textContent = "Нет свежих данных — перезагрузи страницу Owlbear"; return; }
  if (s.state === "ok") { box.className = "ok"; $("#stText").textContent = "Kenku FM подключён"; }
  else { box.className = "err"; $("#stText").textContent = s.err || "Нет связи с Kenku"; }
}

function drawNow(m) {
  const ok = m && m.id && m.title;
  $("#now").classList.toggle("empty", !ok);
  $("#nowK").textContent = ok && m.playing === false ? "Пауза" : "Сейчас звучит";
  $("#nowT").textContent = ok ? m.title : "Ничего не играет";
  $("#nowT").title = ok ? m.title : "";
  $("#nowP").textContent = ok && m.playlist ? "Плейлист: " + m.playlist : "";
}

// ---------- события ----------
$("#url").value = cfg.url;
$("#url").addEventListener("change", e => { cfg.url = e.target.value.trim() || DEF_CFG.url; e.target.value = cfg.url; saveCfg(); local("poll"); });
$("#test").onclick = async () => {
  cfg.url = $("#url").value.trim() || DEF_CFG.url; saveCfg();
  toast("Проверяю…");
  try {
    const t = await readKenku(cfg.url);
    ls.set(LS_STATUS, { state: "ok", at: Date.now(), track: t });
    toast(t ? `Связь есть. Сейчас: «${t.title}»` : "Связь есть, но в плейлисте ничего не выбрано");
  } catch (e) {
    ls.set(LS_STATUS, { state: "err", at: Date.now(), err: explain(e) });
    toast(explain(e));
  }
  drawStatus(); local("poll");
};
$("#sendManual").onclick = async () => {
  const title = $("#manual").value.trim();
  if (!title) { toast("Впиши название"); $("#manual").focus(); return; }
  try {
    await OBR.room.setMetadata({ [META]: { id: "manual:" + Date.now(), title: title.slice(0, 160), playlist: "", playing: true, big: cfg.big, manual: true, t: Date.now() } });
    toast(`Показано всем: «${title}»`);
  } catch (e) { toast("Не удалось отправить"); }
};
$("#manual").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("#sendManual").click(); } });
$("#clear").onclick = () => OBR.room.setMetadata({ [META]: null }).then(() => toast("Плашка убрана у всех")).catch(() => toast("Не удалось"));
$("#reshow").onclick = () => { local("reshow"); toast("Плашка снова показана"); };
$("#move").onclick = () => local("move");
$("#resetPos").onclick = () => { local("resetPos"); toast("Плашка возвращена к правому нижнему углу"); };
addEventListener("storage", e => { if (e.key === LS_STATUS) drawStatus(); });

drawCfg();
drawStatus();
setInterval(drawStatus, 3000);

OBR.onReady(async () => {
  try { if ((await OBR.player.getRole()) === "GM") document.body.classList.add("isgm"); } catch (e) {}
  try { drawNow((await OBR.room.getMetadata())[META]); } catch (e) {}
  OBR.room.onMetadataChange(md => drawNow(md[META]));
});
