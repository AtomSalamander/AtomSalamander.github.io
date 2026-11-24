// Панель расширения: мастер вешает/снимает эффекты и ведёт библиотеку, игроки читают описания
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS, CFG, PALETTE, SIZES, esc, readFx, glyph, ink, sameFx, normFx } from "./const.js";
import { libGroups, loadLib, saveLib, upsertLib, removeLib, isToken, editFx, addFx, removeFxByName, toggleFx, toaster } from "./lib.js";

const $ = id => document.getElementById(id);
const toast = toaster($("toast"));
let isGM = false, items = [], search = "", size = "m";
let form = { name: "", icon: "", n: "", color: PALETTE[9], desc: "" };
let mode = null;   // null | { type: "lib", id } | { type: "tok", name }

const dotHtml = f => `<span class="dot" style="--c:${f.color};background:${f.color};color:${ink(f.color)}">${esc(glyph(f))}</span>`;
const ids = () => items.map(i => i.id);
const tokName = it => it.text?.plainText || it.name || "токен";

// ── выделение ──
async function refreshSel(sel) {
  const list = sel && sel.length ? await OBR.scene.items.getItems(sel) : [];
  items = list.filter(isToken);
  renderSel();
  if (isGM) renderLib();
}

function renderSel() {
  const box = $("sel");
  if (!items.length) {
    box.innerHTML = `<div class="empty">${isGM ? "Выдели токен(ы) на карте — и нажимай на эффекты из библиотеки." : "Выдели токен, чтобы прочитать его эффекты. Или просто нажми на кругляшок под токеном."}</div>`;
    return;
  }
  const names = items.map(tokName);
  let h = `<div class="who">🎯 ${esc(names.slice(0, 3).join(", "))}${names.length > 3 ? ` и ещё ${names.length - 3}` : ""}</div>`;
  // объединение эффектов выделенных токенов (по имени)
  const uni = [];
  for (const it of items) for (const f of readFx(it)) {
    const u = uni.find(x => sameFx(x.f, f)); if (u) u.c++; else uni.push({ f, c: 1 });
  }
  if (!uni.length) h += `<div class="empty">Эффектов нет.</div>`;
  else if (isGM) {
    h += `<div class="chips">` + uni.map(({ f, c }) => `<span class="chip on" title="${esc(f.desc)}">
      <button data-act="tedit" data-name="${esc(f.name)}">${dotHtml(f)}${esc(f.name)}${items.length > 1 ? ` <small>${c}/${items.length}</small>` : ""}</button>
      ${f.n != null ? `<button class="x" data-act="tdec" data-name="${esc(f.name)}" title="− 1">−</button><button class="x" data-act="tinc" data-name="${esc(f.name)}" title="+ 1">+</button>` : ""}
      <button class="x" data-act="tdel" data-name="${esc(f.name)}" title="Снять">×</button></span>`).join("") + `</div>
      <div class="hint">Клик по эффекту — редактировать его на токене. <a href="#" data-act="clear">Снять все</a></div>`;
  } else {
    h += uni.map(({ f }) => `<div class="card" style="--c:${f.color}"><div class="row">${dotHtml(f)}<b>${esc(f.name)}</b>${f.n != null ? `<span class="n">${esc(f.n)}</span>` : ""}</div>
      <div class="desc">${f.desc ? esc(f.desc) : "<i>Без описания</i>"}</div></div>`).join("");
  }
  box.innerHTML = h;
}

// ── библиотека ──
function renderLib() {
  const s = search.trim().toLowerCase();
  let h = "";
  for (const g of libGroups()) {
    const xs = g.list.filter(f => !s || f.name.toLowerCase().includes(s) || f.desc.toLowerCase().includes(s));
    if (g.mine && !xs.length && !s) { h += `<div class="gh">${esc(g.name)}</div><div class="empty">Пока пусто. Создай эффект ниже и нажми «★ В библиотеку».</div>`; continue; }
    if (!xs.length) continue;
    h += `<div class="gh">${esc(g.name)}</div><div class="chips">` + xs.map(f => {
      const on = items.length && items.every(it => readFx(it).some(x => sameFx(x, f)));
      return `<span class="chip${on ? " on" : ""}" title="${esc(f.desc)}">
        <button data-act="pick" data-g="${g.id}" data-id="${esc(f.id)}">${dotHtml(f)}${esc(f.name)}</button>
        <button class="x" data-act="ledit" data-g="${g.id}" data-id="${esc(f.id)}" title="${g.mine ? "Изменить" : "Скопировать в форму"}">✎</button>
        ${g.mine ? `<button class="x" data-act="ldel" data-id="${esc(f.id)}" title="Удалить из библиотеки">×</button>` : ""}</span>`;
    }).join("") + `</div>`;
  }
  $("lib").innerHTML = h || `<div class="empty">Ничего не нашлось.</div>`;
}
const findLib = (g, id) => libGroups().find(x => x.id === g)?.list.find(f => f.id === id);

// ── форма ──
function fillForm(f, m) {
  form = { name: f.name || "", icon: f.icon || "", n: f.n ?? "", color: f.color || PALETTE[9], desc: f.desc || "" };
  mode = m || null;
  $("fName").value = form.name; $("fIcon").value = form.icon; $("fN").value = form.n;
  $("fColor").value = form.color; $("fDesc").value = form.desc;
  $("form").open = true;
  renderForm();
}
function readForm() {
  form = { name: $("fName").value, icon: $("fIcon").value, n: $("fN").value, color: $("fColor").value, desc: $("fDesc").value };
  return normFx(form);
}
function renderForm() {
  $("sw").innerHTML = PALETTE.map(c => `<button type="button" data-c="${c}" class="${c === form.color ? "on" : ""}" style="--c:${c}"></button>`).join("");
  const f = normFx({ ...form, name: form.name || "?" });
  $("pv").innerHTML = `${dotHtml(f)}<b>${esc(form.name || "Название")}</b>`;
  $("fTitle").textContent = mode?.type === "lib" ? "✎ Редактирование (библиотека)" : mode?.type === "tok" ? "✎ Редактирование на токене" : "＋ Свой эффект";
  $("apply").textContent = mode?.type === "tok" ? "Обновить на выделенных" : "Повесить на выделенные";
}

async function act(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  e.preventDefault();
  const a = b.dataset.act, name = b.dataset.name;
  try {
    if (a === "pick") {
      const f = findLib(b.dataset.g, b.dataset.id); if (!f) return;
      if (!items.length) return toast("Сначала выдели токен(ы) на карте");
      toast((await toggleFx(ids(), f, items)) ? `Повешено: ${f.name}` : `Снято: ${f.name}`);
    } else if (a === "ledit") {
      const f = findLib(b.dataset.g, b.dataset.id); if (!f) return;
      fillForm(f, b.dataset.g === "my" ? { type: "lib", id: f.id } : null);
      $("fName").focus();
    } else if (a === "ldel") {
      const f = loadLib().find(x => x.id === b.dataset.id);
      if (f && confirm(`Удалить «${f.name}» из библиотеки?`)) { removeLib(f.id); if (mode?.id === f.id) mode = null; renderLib(); renderForm(); }
    } else if (a === "tedit") {
      const f = items.map(readFx).flat().find(x => sameFx(x, { name })); if (f) { fillForm(f, { type: "tok", name: f.name }); $("fName").focus(); }
    } else if (a === "tdel") { await removeFxByName(ids(), name); toast(`Снято: ${name}`); }
    else if (a === "tinc" || a === "tdec") {
      await editFx(ids(), l => l.map(x => sameFx(x, { name }) && x.n != null ? { ...x, n: x.n + (a === "tinc" ? 1 : -1) } : x));
    } else if (a === "clear") {
      if (items.length && confirm("Снять все эффекты с выделенных токенов?")) await editFx(ids(), () => []);
    }
  } catch (err) { console.warn(err); toast("Не получилось: " + (err?.message || err)); }
}

function wireGM() {
  $("sel").addEventListener("click", act);
  $("lib").addEventListener("click", act);
  $("search").addEventListener("input", e => { search = e.target.value; renderLib(); });
  for (const id of ["fName", "fIcon", "fN", "fDesc"]) $(id).addEventListener("input", () => { readForm(); renderForm(); });
  $("fColor").addEventListener("input", () => { readForm(); renderForm(); });
  $("sw").addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; $("fColor").value = b.dataset.c; readForm(); renderForm(); });

  $("apply").onclick = async () => {
    const f = readForm(); if (!f) return toast("Укажи название эффекта");
    if (!items.length) return toast("Сначала выдели токен(ы) на карте");
    try {
      if (mode?.type === "tok") {
        const old = mode.name;
        await editFx(ids(), l => l.map(x => sameFx(x, { name: old }) ? { ...f, id: x.id } : x));
        mode = { type: "tok", name: f.name }; toast("Обновлено на токенах");
      } else { await addFx(ids(), f); toast(`Повешено: ${f.name}`); }
    } catch (err) { toast("Не получилось: " + (err?.message || err)); }
  };
  $("save").onclick = () => {
    const f = readForm(); if (!f) return toast("Укажи название эффекта");
    const saved = upsertLib(f, mode?.type === "lib" ? mode.id : null);
    if (mode?.type !== "tok") mode = { type: "lib", id: saved.id };
    renderLib(); renderForm(); toast(`★ «${f.name}» в библиотеке`);
  };
  $("reset").onclick = () => fillForm({}, null);

  // размер кругляшков — общий для всей комнаты
  $("size").innerHTML = Object.entries(SIZES).map(([k, v]) => `<button data-s="${k}">${v.name}</button>`).join("");
  $("size").addEventListener("click", async e => {
    const b = e.target.closest("[data-s]"); if (!b) return;
    size = b.dataset.s; paintSize();
    await OBR.room.setMetadata({ [CFG]: { size } });
  });

  // резервная копия библиотеки
  $("exp").onclick = () => { $("json").value = JSON.stringify(loadLib(), null, 1); $("json").select(); toast("Скопируй текст из поля (Ctrl+C)"); };
  $("imp").onclick = () => {
    try {
      const arr = JSON.parse($("json").value); if (!Array.isArray(arr)) throw new Error("нужен массив");
      const list = loadLib(); let n = 0;
      for (const x of arr.map(normFx).filter(Boolean)) { const i = list.findIndex(y => sameFx(y, x)); if (i >= 0) list[i] = { ...x, id: list[i].id }; else list.push(x); n++; }
      saveLib(list); renderLib(); toast(`Загружено эффектов: ${n}`);
    } catch (err) { toast("Не получилось разобрать JSON"); }
  };
  window.addEventListener("storage", e => { if (e.key && e.key.startsWith(NS)) renderLib(); });   // сохранили из окошка ★
}
const paintSize = () => $("size").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.s === size));

OBR.onReady(async () => {
  isGM = (await OBR.player.getRole()) === "GM";
  document.body.classList.toggle("gm", isGM);
  if (isGM) {
    wireGM(); fillForm({}, null); $("form").open = false;
    const m = await OBR.room.getMetadata(); size = m?.[CFG]?.size || "m"; paintSize();
    OBR.room.onMetadataChange(m => { const s = m?.[CFG]?.size; if (s && s !== size) { size = s; paintSize(); } });
  }
  let sel = await OBR.player.getSelection();
  await refreshSel(sel);
  OBR.player.onChange(p => { const s = p.selection || []; if (JSON.stringify(s) !== JSON.stringify(sel)) { sel = s; refreshSel(sel); } });
  OBR.scene.items.onChange(() => refreshSel(sel));
});
