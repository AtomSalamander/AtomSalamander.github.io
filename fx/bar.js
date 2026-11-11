// Панель быстрого доступа: сохранённые заклинания, клик — прицел на карте.
// Двигается за «⠿», сворачивается «▾», «✎» — порядок и удаление.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { CH, ALLOW, SEL } from "./const.js";
import { ABIL, ELEMENTS, aimKind } from "./abilities.js";
import { label } from "./engine.js";
import { BK, loadBar, saveBar, openBar, closeBar, barSize } from "./barctl.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tokName = it => (it.text && it.text.plainText || "").trim() || it.name || "без имени";
let b = loadBar(), edit = false, isGM = false, allow = new Set(), ready = false;
const canUse = a => isGM || allow.has(a);
function loadSel() { try { const s = JSON.parse(localStorage.getItem(SEL)); return s && typeof s === "object" ? s : {}; } catch (e) { return {}; } }

function short(A, el) {
  let n = A.name.replace(/\s*[—–-]\s*наделение/i, " ★");
  if (el && ELEMENTS[el]) n += " · " + ELEMENTS[el].name.toLowerCase();
  return n;
}
function drawWho() {
  const c = loadSel().c;
  $("whoN").textContent = c ? c.name : "не выбран — Alt+1";
  $("who").classList.toggle("none", !c);
}
function draw() {
  document.body.classList.toggle("min", b.min);
  document.body.classList.toggle("edit", edit);
  $("min").textContent = b.min ? "▸" : "▾"; $("min").title = b.min ? "Развернуть" : "Свернуть";
  $("edit").classList.toggle("on", edit); $("edit").hidden = b.min;
  drawWho();
  const S = b.slots.map((s, i) => ({ s, i, A: ABIL[s.a] })).filter(x => x.A);
  $("grid").innerHTML = S.length ? S.map(({ s, i, A }) => {
    const E = s.el && ELEMENTS[s.el], c = E ? E.c1 : "#b48cff";
    const two = !A.area && (A.attack || A.save);
    const tip = `${A.name}${E ? " (" + E.name + ")" : ""}\n${two ? (A.attack ? "ЛКМ — попадание, ПКМ — промах" : "ЛКМ — провал, ПКМ — спасбросок пройден") : A.area ? "Клик — прицелиться областью" : "Клик — выбрать цель на карте"}`;
    return `<div class="t${canUse(A.id) ? "" : " off"}" data-i="${i}" style="--c:${esc(c)}" title="${esc(tip)}" draggable="${edit}">` +
      `${E ? "<em></em>" : ""}${A.aura ? "<u>⏳</u>" : ""}<i>${esc(A.icon || "✨")}</i><span>${esc(short(A, s.el))}</span>` +
      `<button class="x" data-x="${i}" title="Убрать">✕</button></div>`;
  }).join("") : `<div class="empty" style="grid-column:1/-1">Пока пусто.<br>Выбери заклинание в панели ✨ Эффекты и нажми ⭐</div>`;
  $("foot").hidden = !S.length;
  $("foot").textContent = edit ? "Перетаскивай плитки · ✕ — убрать · ✎ — готово" : "ЛКМ — попадание / провал · ПКМ — промах / спасбросок";
  wire();
}

async function cast(i, alt) {
  const s = b.slots[i], A = s && ABIL[s.a]; if (!A) return;
  if (!canUse(A.id)) return OBR.notification.show("🔒 Мастер закрыл эту способность").catch(() => {});
  const v = alt && !A.area && (A.attack || A.save) ? "save" : undefined;
  if (alt && !v) return;
  const el = document.querySelector(`.t[data-i="${i}"]`);
  if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  await OBR.broadcast.sendMessage(CH, { op: "cast", a: A.id, v, el: s.el, dur: s.dur || null }, { destination: "LOCAL" });
}

let dragI = null;
function wire() {
  document.querySelectorAll(".t").forEach(t => {
    const i = +t.dataset.i;
    t.onclick = ev => { if (ev.target.dataset.x !== undefined || edit) return; cast(i, false); };
    t.oncontextmenu = ev => { ev.preventDefault(); if (!edit) cast(i, true); };
    t.ondragstart = ev => { if (!edit) return ev.preventDefault(); dragI = i; ev.dataTransfer.effectAllowed = "move"; };
    t.ondragover = ev => { if (dragI === null) return; ev.preventDefault(); t.classList.add("over"); };
    t.ondragleave = () => t.classList.remove("over");
    t.ondrop = ev => {
      ev.preventDefault(); t.classList.remove("over");
      if (dragI === null || dragI === i) return;
      const [m] = b.slots.splice(dragI, 1); b.slots.splice(i, 0, m); dragI = null;
      saveBar(b); draw();
    };
    t.ondragend = () => { dragI = null; };
  });
  document.querySelectorAll("[data-x]").forEach(x => x.onclick = ev => {
    ev.stopPropagation();
    b.slots.splice(+x.dataset.x, 1); saveBar(b); resize();
  });
}

// переоткрыть поповер под новый размер / место
let lastSize = JSON.stringify(barSize(b));
async function resize(force) {
  draw();
  const sz = JSON.stringify(barSize(b));
  if (!force && sz === lastSize) return;
  lastSize = sz; saveBar(b);
  if (ready) await openBar(b);
}

$("min").onclick = () => { b.min = !b.min; if (b.min) edit = false; resize(); };
$("edit").onclick = () => { edit = !edit; draw(); };
$("close").onclick = () => closeBar();
$("who").onclick = async () => {
  const ids = (await OBR.player.getSelection()) || [];
  if (!ids.length) return OBR.notification.show("Выдели свой токен на карте и нажми сюда (или Alt+1)").catch(() => {});
  const [it] = await OBR.scene.items.getItems([ids[0]]);
  if (!it) return;
  const s = loadSel(); s.c = { id: it.id, name: tokName(it) }; if (!Array.isArray(s.t)) s.t = [];
  try { localStorage.setItem(SEL, JSON.stringify(s)); } catch (e) {}
  drawWho();
  label([it.id], "Заклинатель", { color: "#f3d58a" }).catch(() => {});
};

// перетаскивание панели за «⠿»: считаем смещение и переносим при отпускании
let drag = null;
$("grip").addEventListener("pointerdown", ev => {
  if (ev.button !== 0) return;
  drag = { x: ev.screenX, y: ev.screenY, moved: false };
  try { $("grip").setPointerCapture(ev.pointerId); } catch (e) {}
  ev.preventDefault();
});
$("grip").addEventListener("pointermove", ev => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(ev.screenX - drag.x, ev.screenY - drag.y) > 4) { drag.moved = true; document.body.classList.add("drag"); }
});
const endDrag = async ev => {
  if (!drag) return;
  const d = drag; drag = null; document.body.classList.remove("drag");
  if (!d.moved || !ev) return;
  const p = b.pos || { left: 0, top: 0 };
  b.pos = { left: p.left + (ev.screenX - d.x), top: p.top + (ev.screenY - d.y) };
  await resize(true);
};
$("grip").addEventListener("pointerup", endDrag);
$("grip").addEventListener("pointercancel", () => { drag = null; document.body.classList.remove("drag"); });

addEventListener("storage", ev => {
  if (ev.key === SEL) drawWho();
  if (ev.key === BK) { const n = loadBar(); n.pos = b.pos || n.pos; b = n; resize(); }
});

OBR.onReady(async () => {
  ready = true;
  isGM = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(p => { const g = p.role === "GM"; if (g !== isGM) { isGM = g; draw(); } });
  const onMeta = md => { allow = new Set(Array.isArray(md[ALLOW]) ? md[ALLOW] : []); draw(); };
  onMeta(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(onMeta);
});
draw();
