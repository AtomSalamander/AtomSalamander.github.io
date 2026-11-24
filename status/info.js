// Окошко с описанием эффектов токена (открывается кликом по кругляшку или через правый клик)
import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { INFO, PALETTE, esc, readFx, glyph, ink, sameFx } from "./const.js";
import { libGroups, upsertLib, editFx, addFx, removeFxById, toaster } from "./lib.js";

const q = new URLSearchParams(location.search);
const TOK = q.get("tok");
let open = new Set(q.get("fx") ? [q.get("fx")] : []);
let isGM = false, item = null, editing = null, picker = false, search = "";
const $ = id => document.getElementById(id);
const toast = toaster($("toast"));

const dotHtml = f => `<span class="dot" style="background:${f.color};color:${ink(f.color)}">${esc(glyph(f))}</span>`;

function render() {
  const list = item ? readFx(item) : [];
  $("title").textContent = item ? (item.text?.plainText || item.name || "Токен") : "Токен не найден";
  if (list.length <= 2) list.forEach(f => open.add(f.id));
  let h = "";
  if (!list.length) h = `<div class="empty">${isGM ? "На токене нет эффектов. Нажми «+ Добавить»." : "На токене нет эффектов."}</div>`;
  for (const f of list) {
    if (isGM && editing === f.id) { h += editForm(f); continue; }
    const on = open.has(f.id);
    h += `<div class="card${on ? " on" : ""}" style="--c:${f.color}" data-id="${esc(f.id)}">
      <div class="row" data-act="toggle">${dotHtml(f)}<b>${esc(f.name)}</b>${f.n != null ? `<span class="n">${esc(f.n)}</span>` : ""}
        ${isGM ? `<span class="tools">
          ${f.n != null ? `<button data-act="dec" title="− 1">−</button><button data-act="inc" title="+ 1">+</button>` : ""}
          <button data-act="edit" title="Изменить">✎</button><button data-act="save" title="Сохранить в библиотеку">★</button><button data-act="del" class="x" title="Снять">×</button></span>` : `<span class="chev">${on ? "▴" : "▾"}</span>`}
      </div>
      ${on ? `<div class="desc">${f.desc ? esc(f.desc) : "<i>Без описания</i>"}</div>` : ""}
    </div>`;
  }
  if (isGM) {
    h += `<button class="add" data-act="picker">${picker ? "− Скрыть библиотеку" : "+ Добавить эффект"}</button>`;
    if (picker) h += pickerHtml(list);
  }
  $("list").innerHTML = h;
  const s = $("search"); if (s) { s.value = search; if (picker) s.focus(); s.setSelectionRange(search.length, search.length); }
}

function editForm(f) {
  return `<div class="card edit" data-id="${esc(f.id)}" style="--c:${f.color}">
    <div class="inrow"><input id="eName" type="text" maxlength="60" value="${esc(f.name)}" placeholder="Название">
      <input id="eIcon" class="sm" type="text" maxlength="4" value="${esc(f.icon)}" placeholder="Значок" title="1–2 символа или эмодзи">
      <input id="eN" class="sm" type="number" value="${f.n ?? ""}" placeholder="№" title="Счётчик (необязательно)"></div>
    <div class="sw">${PALETTE.map(c => `<button data-act="col" data-c="${c}" class="${c === f.color ? "on" : ""}" style="--c:${c}"></button>`).join("")}<input id="eColor" type="color" value="${f.color}"></div>
    <textarea id="eDesc" rows="4" placeholder="Описание">${esc(f.desc)}</textarea>
    <div class="inrow"><button class="main" data-act="apply">Готово</button><button class="alt" data-act="cancel">Отмена</button></div>
  </div>`;
}

function pickerHtml(list) {
  const s = search.trim().toLowerCase();
  let h = `<input id="search" type="text" placeholder="Поиск…" autocomplete="off">`;
  for (const g of libGroups()) {
    const xs = g.list.filter(f => !s || f.name.toLowerCase().includes(s));
    if (!xs.length) continue;
    h += `<div class="gh">${esc(g.name)}</div><div class="chips">` + xs.map(f =>
      `<button class="chip${list.some(x => sameFx(x, f)) ? " on" : ""}" data-act="pick" data-g="${g.id}" data-id="${esc(f.id)}" title="${esc(f.desc)}">${dotHtml(f)}${esc(f.name)}</button>`).join("") + `</div>`;
  }
  return h;
}

const findLib = (g, id) => libGroups().find(x => x.id === g)?.list.find(f => f.id === id);

$("list").addEventListener("click", async e => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, card = b.closest(".card"), id = card?.dataset.id;
  const f = item && id ? readFx(item).find(x => x.id === id) : null;
  try {
    if (act === "toggle") { if (open.has(id)) open.delete(id); else open.add(id); return render(); }
    if (!isGM) return;
    e.stopPropagation();
    if (act === "inc" || act === "dec") await editFx([TOK], l => l.map(x => x.id === id ? { ...x, n: (x.n ?? 0) + (act === "inc" ? 1 : -1) } : x));
    else if (act === "del") { await removeFxById(TOK, id); toast(`Снято: ${f?.name || ""}`); }
    else if (act === "save" && f) { upsertLib(f); toast(`★ «${f.name}» сохранён в библиотеку`); }
    else if (act === "edit") { editing = id; render(); $("eName")?.focus(); }
    else if (act === "cancel") { editing = null; render(); }
    else if (act === "col") { $("eColor").value = b.dataset.c; card.style.setProperty("--c", b.dataset.c); card.querySelectorAll(".sw button").forEach(x => x.classList.toggle("on", x === b)); }
    else if (act === "apply") {
      const name = $("eName").value.trim(); if (!name) return toast("Нужно название");
      const upd = { name, icon: $("eIcon").value, n: $("eN").value, color: $("eColor").value, desc: $("eDesc").value };
      editing = null;
      await editFx([TOK], l => l.map(x => x.id === id ? { ...x, ...upd } : x));
    }
    else if (act === "picker") { picker = !picker; render(); }
    else if (act === "pick") {
      const lf = findLib(b.dataset.g, b.dataset.id); if (!lf) return;
      const has = readFx(item).find(x => sameFx(x, lf));
      if (has) await removeFxById(TOK, has.id); else await addFx([TOK], lf);
    }
  } catch (err) { console.warn(err); toast("Не получилось: " + (err?.message || err)); }
});
$("list").addEventListener("input", e => {
  if (e.target.id === "search") { search = e.target.value; render(); }
  if (e.target.id === "eColor") e.target.closest(".card").style.setProperty("--c", e.target.value);
});
$("list").addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "search") { const c = document.querySelector('.chip[data-act="pick"]'); if (c) c.click(); }
});
$("close").onclick = () => OBR.popover.close(INFO);

function fit() { try { OBR.popover.setHeight(INFO, Math.min(560, Math.max(120, document.body.scrollHeight + 2))); } catch (e) {} }
new ResizeObserver(fit).observe(document.body);

OBR.onReady(async () => {
  isGM = (await OBR.player.getRole()) === "GM";
  document.body.classList.toggle("gm", isGM);
  [item] = await OBR.scene.items.getItems([TOK]);
  render();
  const cur = document.querySelector(".card.on"); if (cur && open.size === 1) cur.scrollIntoView({ block: "nearest" });
  OBR.scene.items.onChange(items => {
    const next = items.find(i => i.id === TOK) || null;
    if (JSON.stringify(next?.metadata) === JSON.stringify(item?.metadata) && next?.name === item?.name) return;
    item = next;
    if (editing && document.activeElement && document.activeElement.closest(".edit")) return;   // не перебиваем ввод
    render();
  });
});
