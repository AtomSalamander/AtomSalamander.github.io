import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { STATE, CH, PROTO, DMG, EFF, normState } from "./const.js";
import { untilText } from "./turns.js";

const $ = s => document.querySelector(s);
let st = normState(null), sel = [], names = new Map(), res = {}, isGM = false;

function toast(t) { const el = $("#toast"); el.textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => el.textContent = "", 6000); }
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nm = id => names.get(id) || "?";

async function loadNames(ids) {
  const need = ids.filter(Boolean);
  if (!need.length) return;
  try {
    const its = await OBR.scene.items.getItems(need);
    for (const i of its) names.set(i.id, (i.text && i.text.plainText) || i.name || "Токен");
  } catch (e) {}
}
async function send(c, extra = {}) {
  if (!isGM) return;
  const ids = (await OBR.player.getSelection()) || [];
  OBR.broadcast.sendMessage(CH, { op: "cmd", c, ids, ...extra }, { destination: "LOCAL" });
}

function drawSel() {
  const el = $("#sel");
  if (!sel.length) { el.textContent = "—"; return; }
  el.innerHTML = sel.map(id => { const r = res[id] === "ok" ? "s" : "f"; return `<span class="chip ${r}" data-id="${id}">${r === "s" ? "✔" : "✖"} ${esc(nm(id))}</span>`; }).join("");
}
function drawProtos() {
  const box = $("#protos");
  box.innerHTML = Object.entries(PROTO).map(([p, P]) => {
    const kid = st.keys[p], br = st.broken[p], act = st.proto === p;
    const k = kid ? (br ? `💥 ${esc(nm(kid))} — разрушен` : `🔑 ${esc(nm(kid))}`) : "Ключ не назначен";
    return `<div class="card proto ${act ? "act" : ""}" style="--c:${P.glow || P.color}">
      <div class="t">${P.icon}<i>${P.short}</i>${act ? '<span class="tag">АКТИВЕН</span>' : ""}</div>
      <div class="k">${P.key}: ${k}</div>
      <div class="row"><button class="alt" data-c="assignKey" data-p="${p}">Ключ ← выделение</button><button data-c="proto" data-p="${p}" ${br && !act ? "" : ""}>Активировать</button></div>
    </div>`;
  }).join("");
  const c = $("#pctl"), b = [];
  if (st.proto) b.push(`<button class="bad" data-c="protoOff">Выключить протокол</button>`);
  if (st.proto === "div") b.push(`<button class="alt" data-c="wallRedo">Переставить стену</button>`);
  if (st.proto === "perm") b.push(`<button class="alt" data-c="shuffle">Перемешать снова</button>`);
  if (st.proto === "loop") b.push(
    `<button class="alt" data-c="loopSave">Запомнить позиции</button>`,
    `<button class="alt" data-c="loopRewind" ${st.snap ? "" : "disabled"}>Откатить сейчас</button>`,
    `<button class="alt" data-c="loopBreak">Сорвать Петлю</button>`);
  b.push(`<button class="alt ${st.autoLoop ? "on" : ""}" data-c="autoLoop">Автооткат Петли в конце раунда: ${st.autoLoop ? "вкл" : "выкл"}</button>`);
  c.innerHTML = b.join("");
}
function drawEffs() {
  const box = $("#effs");
  if (!st.e.length) { box.innerHTML = `<div class="hint">Нет висящих эффектов</div>`; return; }
  box.innerHTML = st.e.map(e => {
    const E = EFF[e.a] || { name: e.a, icon: "•" };
    let u = ""; try { u = untilText(e) || ""; } catch (x) {}
    if (!u && e.m === "x") u = "до снятия";
    return `<div class="eff">${E.icon}<b>${esc(E.name)} — ${esc(e.tn)}</b><small>${esc(u)}</small><button class="alt" data-c="rm" data-id="${e.id}">✕</button></div>`;
  }).join("");
}
async function drawAll() {
  await loadNames([st.boss, ...Object.values(st.keys || {}), ...sel]);
  $("#boss").textContent = st.boss ? (st.bn || nm(st.boss)) : "— не назначен";
  $("#veinsBtn").classList.toggle("on", !!st.veins);
  $("#veinsBtn").textContent = "Вены Барьера: " + (st.veins ? "вкл" : "выкл");
  drawSel(); drawProtos(); drawEffs();
}
function drawRole() { $("#gmOnly").style.display = isGM ? "none" : "block"; $("#ui").style.display = isGM ? "block" : "none"; }

document.addEventListener("click", ev => {
  const chip = ev.target.closest(".chip[data-id]");
  if (chip) { const id = chip.dataset.id; res[id] = res[id] === "ok" ? "fail" : "ok"; drawSel(); return; }
  const b = ev.target.closest("button[data-c]"); if (!b || b.disabled) return;
  const d = b.dataset, c = d.c, x = {};
  if (d.v) x.v = d.v;
  if (d.p) x.p = d.p;
  if (d.id) x.id = d.id;
  if (d.hit) x.hit = true;
  if (d.fail) x.fail = true;
  if (c === "wave") x.res = { ...res };
  if (c === "strike") { x.fails = Math.max(0, Math.min(6, +$("#fails").value || 0)); x.erased = $("#erased").checked; }
  if (c === "recal") x.dmg = $("#dmg").value;
  if (c === "reset" && !confirm("Сбросить бой? Протоколы, Ключи и эффекты будут очищены (босс останется).")) return;
  send(c, x);
});

$("#dmg").innerHTML = Object.entries(DMG).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join("");

OBR.onReady(async () => {
  try { isGM = (await OBR.player.getRole()) === "GM"; } catch (e) {}
  drawRole();
  OBR.player.onChange(async p => {
    const g = p.role === "GM"; if (g !== isGM) { isGM = g; drawRole(); }
    const s = p.selection || [];
    if (s.join() !== sel.join()) { sel = s; for (const id of Object.keys(res)) if (!sel.includes(id)) delete res[id]; await loadNames(sel); drawSel(); }
  });
  try { sel = (await OBR.player.getSelection()) || []; } catch (e) {}
  OBR.room.onMetadataChange(md => { st = normState(md[STATE]); drawAll(); });
  try { st = normState((await OBR.room.getMetadata())[STATE]); } catch (e) {}
  OBR.broadcast.onMessage(CH, ev => { const m = ev.data || {}; if (m.op === "toast") toast(m.text); });
  drawAll();
});
