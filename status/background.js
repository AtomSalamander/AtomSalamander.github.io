// Фон: у каждого игрока рисует локальные кругляшки под токенами по метаданным токена
// (сами кругляшки не синхронизируются — не засоряют сцену и историю Ctrl+Z).
// Клик по кругляшку → окошко с описанием. Запасной путь — правый клик по токену → «Статус-эффекты».
import OBR, { buildShape, buildText } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { NS, KEY, CFG, INFO, TAG, ICON, SIZES, TOKEN_LAYERS, readFx, glyph, ink } from "./const.js";

let isGM = false, DPI = 150, size = "m", ready = false;
const dots = new Map();   // id кругляшка → { tok, fx, x, y, d }

const dotId = (tok, fx) => `${NS}-${tok}-${fx}`;
const near = (a, b) => Math.abs(a - b) < 0.5;

// Границы токена без учёта поворота (чтобы кругляшки всегда были снизу)
async function boundsOf(it) {
  if (it.type === "IMAGE" && it.image && it.grid && it.grid.dpi) {
    const sx = Math.abs((it.scale?.x ?? 1) * DPI / it.grid.dpi), sy = Math.abs((it.scale?.y ?? 1) * DPI / it.grid.dpi);
    const left = it.position.x - (it.grid.offset?.x ?? 0) * sx, top = it.position.y - (it.grid.offset?.y ?? 0) * sy;
    return { left, top, w: it.image.width * sx, h: it.image.height * sy };
  }
  try {
    const b = await OBR.scene.items.getItemBounds([it.id]);
    return { left: b.min.x, top: b.min.y, w: b.width, h: b.height };
  } catch (e) { return { left: it.position.x - DPI / 2, top: it.position.y - DPI / 2, w: DPI, h: DPI }; }
}

// Раскладка: ряд по центру под токеном, если не помещается — следующий ряд ниже
function layout(b, n) {
  const d = DPI * (SIZES[size] || SIZES.m).k, gap = d * 0.2, step = d + gap;
  const per = Math.max(3, Math.floor((b.w + gap) / step));
  const out = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / per), inRow = Math.min(per, n - row * per), col = i - row * per;
    const x = b.left + b.w / 2 + (col - (inRow - 1) / 2) * step;
    const y = b.top + b.h + d * 0.3 + row * (d + gap * 0.6);
    out.push({ x, y, d });
  }
  return out;
}

function makeDot(tok, f, p, z) {
  const id = dotId(tok.id, f.id), g = glyph(f);
  const sig = [f.color, g, p.d.toFixed(2), f.name].join("|");
  const dot = buildShape().shapeType("CIRCLE").width(p.d).height(p.d).position({ x: p.x, y: p.y })
    .fillColor(f.color).fillOpacity(1).strokeColor("#0b0d1a").strokeOpacity(0.85).strokeWidth(Math.max(1, p.d * 0.09))
    .layer("ATTACHMENT").attachedTo(tok.id).disableAttachmentBehavior(["ROTATION", "SCALE", "LOCKED"])
    .name(`● ${f.name}`).zIndex(z).metadata({ [TAG]: { tok: tok.id, fx: f.id, sig, part: "dot" } }).build();
  dot.id = id;
  const fs = p.d * ([...g].length > 2 ? 0.42 : [...g].length > 1 ? 0.5 : 0.62), w = p.d * 1.6, h = p.d;
  const txt = buildText().textType("PLAIN").plainText(g).width(w).height(h).position({ x: p.x - w / 2, y: p.y - h / 2 })
    .fontSize(fs).fontWeight(800).fontFamily("Roboto").fillColor(ink(f.color)).fillOpacity(1)
    .strokeColor("#000000").strokeOpacity(0).strokeWidth(0).textAlign("CENTER").textAlignVertical("MIDDLE")
    .padding(0).lineHeight(1).layer("ATTACHMENT").attachedTo(tok.id).disableAttachmentBehavior(["ROTATION", "SCALE", "LOCKED"])
    .disableHit(true).locked(true).name(`● ${f.name}`).zIndex(z + 1).metadata({ [TAG]: { tok: tok.id, fx: f.id, sig, part: "txt" } }).build();
  txt.id = id + "-t";
  return { dot, txt, sig, w, h };
}

let busy = false, again = false;
async function render() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do { again = false; await renderOnce(); } while (again);
  } catch (e) { console.warn("[status-fx]", e); }
  busy = false;
}

async function renderOnce() {
  const have = ready ? await OBR.scene.local.getItems(i => !!i.metadata?.[TAG]) : [];
  const tokens = ready ? await OBR.scene.items.getItems(i => TOKEN_LAYERS.includes(i.layer) && Array.isArray(i.metadata?.[KEY]) && i.metadata[KEY].length) : [];
  const want = new Map(), z0 = Date.now();
  dots.clear();
  for (const tok of tokens) {
    if (!isGM && tok.visible === false) continue;           // скрытый токен — игрокам не показываем
    const list = readFx(tok); if (!list.length) continue;
    const b = await boundsOf(tok), pos = layout(b, list.length);
    list.forEach((f, i) => {
      const m = makeDot(tok, f, pos[i], z0 + i * 2);
      want.set(m.dot.id, m.dot); want.set(m.txt.id, m.txt);
      dots.set(m.dot.id, { tok: tok.id, fx: f.id, ...pos[i] });
    });
  }
  const del = [], move = new Map(), haveIds = new Set();
  for (const it of have) {
    const w = want.get(it.id);
    if (!w || w.metadata[TAG].sig !== it.metadata[TAG].sig || w.attachedTo !== it.attachedTo) { del.push(it.id); continue; }
    haveIds.add(it.id);
    if (!near(w.position.x, it.position.x) || !near(w.position.y, it.position.y)) move.set(it.id, w.position);
  }
  const add = [...want.values()].filter(w => !haveIds.has(w.id));
  if (del.length) await OBR.scene.local.deleteItems(del);
  if (add.length) await OBR.scene.local.addItems(add);
  if (move.size) await OBR.scene.local.updateItems([...move.keys()], its => { for (const it of its) it.position = { ...move.get(it.id) }; });
}

let rt = 0;
const soon = (ms = 60) => { clearTimeout(rt); rt = setTimeout(render, ms); };

// ── окошко с описанием ──
async function openInfo(tok, fx, anchor) {
  const [it] = await OBR.scene.items.getItems([tok]);
  const n = it ? readFx(it).length : 1;
  const height = Math.min(520, Math.max(isGM ? 240 : 170, 92 + n * 52 + (isGM ? 60 : 0)));
  const url = `/status/info.html?tok=${encodeURIComponent(tok)}${fx ? "&fx=" + encodeURIComponent(fx) : ""}`;
  try { await OBR.popover.close(INFO); } catch (e) {}
  const base = { id: INFO, url, width: 340, height, marginThreshold: 8 };
  if (anchor && anchor.elementId) {
    await OBR.popover.open({ ...base, anchorElementId: anchor.elementId, anchorReference: "ELEMENT",
      anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" } });
  } else if (anchor && anchor.pos) {
    await OBR.popover.open({ ...base, anchorReference: "POSITION", anchorPosition: anchor.pos,
      anchorOrigin: { horizontal: "CENTER", vertical: "BOTTOM" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" } });
  } else await OBR.popover.open(base);
}

async function onSelection(sel) {
  if (!sel || sel.length !== 1) return;
  const hit = dots.get(sel[0]) || dots.get(String(sel[0]).replace(/-t$/, ""));
  if (!hit) return;
  try { await OBR.player.deselect([sel[0]]); } catch (e) {}
  let pos = null;
  try {
    const s = await OBR.viewport.inverseTransformPoint({ x: hit.x, y: hit.y + hit.d / 2 });
    pos = { left: Math.round(s.x), top: Math.round(s.y + 4) };
  } catch (e) {}
  await openInfo(hit.tok, hit.fx, pos ? { pos } : null);
}

OBR.onReady(async () => {
  try { isGM = (await OBR.player.getRole()) === "GM"; } catch (e) {}
  OBR.player.onChange(p => {
    const gm = p.role === "GM";
    if (gm !== isGM) { isGM = gm; soon(); }
    onSelection(p.selection).catch(e => console.warn("[status-fx] info", e));
  });

  const onCfg = m => { const s = m?.[CFG]?.size; if (s && SIZES[s] && s !== size) { size = s; soon(); } };
  onCfg(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(onCfg);

  const onScene = async r => {
    ready = r;
    if (r) { try { DPI = (await OBR.scene.grid.getDpi()) || DPI; } catch (e) {} }
    soon(0);
  };
  OBR.scene.onReadyChange(onScene);
  await onScene(await OBR.scene.isReady());
  OBR.scene.grid.onChange(g => { if (g?.dpi && g.dpi !== DPI) { DPI = g.dpi; soon(); } });
  OBR.scene.items.onChange(() => soon());
  OBR.scene.local.onChange(() => soon(150));   // кругляшок случайно сдвинули — вернём на место

  // правый клик по токену: мастеру — всегда, игрокам — если на токене есть эффекты
  const layers = { key: "layer", value: "CHARACTER", coordinator: "||" };
  try {
    await OBR.contextMenu.create({
      id: NS + "/open",
      icons: [
        { icon: ICON, label: "Статус-эффекты", filter: { max: 1, roles: ["GM"], every: [layers, { key: "layer", value: "MOUNT", coordinator: "||" }, { key: "layer", value: "PROP" }] } },
        { icon: ICON, label: "Статус-эффекты", filter: { max: 1, roles: ["PLAYER"], every: [{ key: ["metadata", KEY], operator: "!=", value: undefined }] } },
      ],
      onClick: (ctx, elementId) => { const it = ctx.items[0]; if (it) openInfo(it.id, null, { elementId }).catch(e => console.warn("[status-fx]", e)); },
    });
  } catch (e) { console.warn("[status-fx] contextMenu", e); }

  // открыть окошко по просьбе панели
  OBR.broadcast.onMessage(NS + "/open", ev => { const m = ev.data || {}; if (m.tok) openInfo(m.tok, m.fx || null, null).catch(() => {}); });
});
