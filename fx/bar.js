// Панель быстрого доступа: сохранённые заклинания, клик — прицел на карте.
// Двигается за «⠿», сворачивается «▾», «✎» — порядок и удаление.
// 🎯 / 💨 — какой вариант по ЛКМ: попадание / провал спаса или промах / спасбросок пройден (ПКМ — наоборот).
// У заклинаний с видами (чародейский выброс, дыхание дракона…) одна плитка: кружок слева сверху или колесо мыши — сменить вид.
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { CH, ALLOW, SEL } from "./const.js";
import { ABIL, ELEMENTS } from "./abilities.js";
import { label } from "./engine.js";
import { BK, loadBar, saveBar, openBar, closeBar, barSize } from "./barctl.js";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tokName = it => (it.text && it.text.plainText || "").trim() || it.name || "без имени";
const EMO = { fire: "🔥", cold: "❄️", acid: "🧪", lightning: "⚡", poison: "☠️", thunder: "🔊", psychic: "🧠", force: "✴️", radiant: "☀️", necrotic: "💀" };
let b = loadBar(), edit = false, isGM = false, allow = new Set(), ready = false, pick = null;
const canUse = a => isGM || allow.has(a);
const two = A => !A.area && !A.self && (A.attack || A.save);   // есть два варианта
const slotEl = (A, s) => A.elements ? (A.elements.includes(s.el) ? s.el : A.elements[0]) : undefined;
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
  document.body.classList.toggle("alt", !!b.alt);
  $("min").textContent = b.min ? "▸" : "▾"; $("min").title = b.min ? "Развернуть" : "Свернуть";
  $("edit").classList.toggle("on", edit); $("edit").hidden = b.min;
  const md = $("mode");
  md.hidden = b.min; md.classList.toggle("on", !!b.alt); md.textContent = b.alt ? "💨" : "🎯";
  md.title = b.alt
    ? "Сейчас ЛКМ: промах / спасбросок пройден\nНажми — вернуть попадание / провал спаса"
    : "Сейчас ЛКМ: попадание / провал спаса\nНажми — переключить на промах / спасбросок пройден";
  drawWho();
  const S = b.slots.map((s, i) => ({ s, i, A: ABIL[s.a] })).filter(x => x.A);
  $("grid").innerHTML = S.length ? S.map(({ s, i, A }) => {
    const el = slotEl(A, s), E = el && ELEMENTS[el], c = E ? E.c1 : "#b48cff", tw = two(A);
    const v1 = A.attack ? "попадание" : "провал спаса", v2 = A.attack ? "промах" : "спасбросок пройден";
    const how = tw ? `ЛКМ — ${b.alt ? v2 : v1}, ПКМ — ${b.alt ? v1 : v2}` : A.self ? "ЛКМ — применить на себя" : A.area ? "ЛКМ — прицелиться областью" : "ЛКМ — выбрать цель на карте";
    const tip = `${A.name}${E ? " (" + E.name + ")" : ""}\n${how}${A.elements ? "\nКружок слева или колесо мыши — сменить вид" : ""}\nПКМ во время наведения — отмена`;
    const pk = pick === i && A.elements ? `<div class="pk">${A.elements.map(k => {
      const X = ELEMENTS[k] || {};
      return `<b data-pe="${esc(k)}" class="${k === el ? "on" : ""}" style="--e:${esc(X.c1 || "#b48cff")}" title="${esc(X.name || k)}">${EMO[k] || "●"}</b>`;
    }).join("")}</div>` : "";
    return `<div class="t${canUse(A.id) ? "" : " off"}${tw ? " two" : ""}" data-i="${i}" style="--c:${esc(c)}" title="${esc(tip)}" draggable="${edit}">` +
      (A.elements ? `<b class="ev" data-ev="${i}" title="Сменить вид">${EMO[el] || "●"}</b>` : "") +
      (A.aura ? "<u>⏳</u>" : "") + (tw ? `<s>${A.attack ? "💨" : "🛡️"}</s>` : "") +
      `<i>${esc(A.icon || "✨")}</i><span>${esc(short(A, el))}</span>` +
      `<button class="x" data-x="${i}" title="Убрать">✕</button>${pk}</div>`;
  }).join("") : `<div class="empty" style="grid-column:1/-1">Пока пусто.<br>Выбери заклинание в панели ✨ Эффекты и нажми ⭐</div>`;
  $("foot").hidden = !S.length;
  $("foot").textContent = edit ? "Перетаскивай плитки · ✕ — убрать · ✎ — готово"
    : b.alt ? "💨 ЛКМ: промах / спас пройден · ПКМ — наоборот" : "🎯 ЛКМ: попадание / провал · ПКМ — наоборот";
  wire();
}

function setEl(i, k) {
  const s = b.slots[i]; if (!s) return;
  b.slots[i] = { ...s, el: k };
  saveBar(b); draw();
}
let wheelT = 0;
function cycle(i, d) {
  const s = b.slots[i], A = s && ABIL[s.a]; if (!A || !A.elements) return;
  const L = A.elements, j = L.indexOf(slotEl(A, s));
  setEl(i, L[(j + d + L.length) % L.length]);
}

// ЛКМ — вариант из переключателя 🎯/💨; ПКМ — фон отменит наведение, а если его нет — сыграет другой вариант
async function cast(i, rmb) {
  const s = b.slots[i], A = s && ABIL[s.a]; if (!A) return;
  const second = two(A) && (!!b.alt !== !!rmb);
  const msg = { op: rmb ? "rmb" : "cast", a: A.id, v: second ? "save" : undefined, el: slotEl(A, s), dur: s.dur || null };
  if (!canUse(A.id)) {
    if (!rmb) return OBR.notification.show("🔒 Мастер закрыл эту способность").catch(() => {});
    msg.a = "";   // закрытую способность ПКМ не применит, но наведение отменит
  }
  const el = document.querySelector(`.t[data-i="${i}"]`);
  if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  await OBR.broadcast.sendMessage(CH, msg, { destination: "LOCAL" });
}

let dragI = null;
function wire() {
  document.querySelectorAll(".t").forEach(t => {
    const i = +t.dataset.i;
    t.onclick = ev => {
      if (ev.target.closest("[data-x]") || edit) return;
      const pe = ev.target.closest("[data-pe]");
      if (pe) { ev.stopPropagation(); pick = null; return setEl(i, pe.dataset.pe); }
      if (ev.target.closest(".pk")) return;
      if (ev.target.closest("[data-ev]")) { ev.stopPropagation(); pick = pick === i ? null : i; return draw(); }
      if (pick !== null) { pick = null; draw(); }
      cast(i, false);
    };
    t.oncontextmenu = ev => {
      ev.preventDefault();
      if (pick !== null) { pick = null; return draw(); }
      if (!edit) cast(i, true);
    };
    t.onwheel = ev => {
      const s = b.slots[i], A = s && ABIL[s.a];
      if (!A || !A.elements || edit) return;
      ev.preventDefault();
      const n = Date.now(); if (n - wheelT < 140) return; wheelT = n;
      cycle(i, ev.deltaY > 0 ? 1 : -1);
    };
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
    b.slots.splice(+x.dataset.x, 1); pick = null; saveBar(b); resize();
  });
}
document.addEventListener("click", ev => { if (pick !== null && !ev.target.closest(".t")) { pick = null; draw(); } });
document.addEventListener("keydown", ev => { if (ev.key === "Escape" && pick !== null) { pick = null; draw(); } });

// переоткрыть поповер под новый размер / место
let lastSize = JSON.stringify(barSize(b));
async function resize(force) {
  draw();
  const sz = JSON.stringify(barSize(b));
  if (!force && sz === lastSize) return;
  lastSize = sz; saveBar(b);
  if (ready) await openBar(b);
}

$("mode").onclick = () => { b.alt = !b.alt; saveBar(b); draw(); };
$("min").onclick = () => { b.min = !b.min; if (b.min) { edit = false; pick = null; } resize(); };
$("edit").onclick = () => { edit = !edit; pick = null; draw(); };
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
