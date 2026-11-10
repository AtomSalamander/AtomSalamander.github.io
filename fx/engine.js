// Движок анимаций: рисует локальные объекты на карте у каждого игрока
// (не синхронизируются по сети — поэтому анимация плавная и не нагружает комнату).
import OBR, { buildCurve, buildLine, buildImage, buildText } from "https://esm.sh/@owlbear-rodeo/sdk@3";

let DPI = 150;
export async function grid() { try { DPI = (await OBR.scene.grid.getDpi()) || DPI; } catch (e) {} return DPI; }

const now = () => performance.now();
const c01 = p => Math.min(1, Math.max(0, p));
const out3 = p => 1 - Math.pow(1 - c01(p), 3);
const TAU = Math.PI * 2;

// ── цикл анимации (setTimeout, т.к. фоновое окно скрыто и requestAnimationFrame там не идёт) ──
const anims = new Set();
let running = false;
function kick() { if (!running) { running = true; setTimeout(tick, 0); } }
async function tick() {
  const t = now(), P = new Map(), dead = [];
  for (const a of anims) {
    if (a.loop) { try { a.f((t - a.t0) / 1000, P); } catch (e) {} continue; }
    const p = (t - a.t0) / a.dur;
    if (p >= 1) { anims.delete(a); dead.push(...a.ids); continue; }
    try { a.f(p, P); } catch (e) {}
  }
  for (const id of dead) P.delete(id);
  try { if (dead.length) await OBR.scene.local.deleteItems(dead); } catch (e) {}
  try {
    if (P.size) await OBR.scene.local.updateItems([...P.keys()], ds => {
      for (const d of ds) { const q = P.get(d.id); if (q) apply(d, q); }
    });
  } catch (e) {}
  if (anims.size) setTimeout(tick, Math.max(5, 33 - (now() - t)));
  else running = false;
}
function apply(d, q) {
  if (q.x != null) d.position = { x: q.x, y: q.y };
  if (q.s != null) d.scale = { x: q.s, y: q.s };
  if (q.r != null) d.rotation = q.r;
  const st = d.style || (d.text && d.text.style);
  if (st) {
    if (q.fo != null) st.fillOpacity = c01(q.fo);
    if (q.so != null) st.strokeOpacity = c01(q.so);
  }
}
function spawn(delay, items, anim) {
  setTimeout(async () => {
    try { await OBR.scene.local.addItems(items); } catch (e) { console.warn("[fx]", e); return; }
    anim.ids = items.map(i => i.id); anim.t0 = now(); anims.add(anim); kick();
  }, Math.max(0, delay || 0));
}

// ── примитивы ──
function base(it, o) {
  it.layer = o.layer || "ATTACHMENT";
  it.zIndex = o.z ?? Date.now();
  it.locked = true; it.disableHit = true; it.name = "✨ fx";
  if (o.s != null) it.scale = { x: o.s, y: o.s };
  if (o.rot != null) it.rotation = o.rot;
  if (o.attach) { it.attachedTo = o.attach; it.disableAttachmentBehavior = ["SCALE", "ROTATION", "LOCKED"]; }
  return it;
}
// Круг как замкнутая кривая; точки задаются относительно position (cx — сдвиг для орбит)
function circle(o) {
  const n = o.n || 24, pts = [];
  for (let k = 0; k < n; k++) { const a = k / n * TAU; pts.push({ x: (o.cx || 0) + Math.cos(a) * o.r, y: Math.sin(a) * o.r }); }
  const it = buildCurve().points(pts).build();
  it.points = pts;
  it.position = { x: o.x, y: o.y };
  it.style = {
    fillColor: o.fill || "#ffffff", fillOpacity: o.fo ?? 0,
    strokeColor: o.stroke || o.fill || "#ffffff", strokeOpacity: o.so ?? 0,
    strokeWidth: o.sw || 0, strokeDash: o.dash || [], tension: 0, closed: true,
  };
  return base(it, o);
}
function line(o) {
  const it = buildLine().build();
  it.position = { x: 0, y: 0 };
  it.startPosition = { x: o.p1.x, y: o.p1.y };
  it.endPosition = { x: o.p2.x, y: o.p2.y };
  it.style = { strokeColor: o.color, strokeOpacity: o.so ?? 1, strokeWidth: o.w, strokeDash: [] };
  return base(it, o);
}
// Одна буква (текстовый объект). Позиция текста — его левый верхний угол, поэтому центр считаем сами (place).
function glyph(o) {
  const fs = o.fs, box = Math.round(fs * 1.5);
  const it = buildText().plainText(o.ch).textType("PLAIN").build();
  it.text = it.text || {};
  it.text.type = "PLAIN"; it.text.plainText = o.ch;
  it.text.width = box; it.text.height = box;
  it.text.style = {
    fillColor: o.color || "#ffffff", fillOpacity: 0,
    strokeColor: o.stroke || "#000000", strokeOpacity: 0, strokeWidth: o.sw ?? Math.max(1, fs * 0.06),
    textAlign: "CENTER", textAlignVertical: "MIDDLE",
    fontFamily: o.font || "Georgia", fontSize: fs, fontWeight: o.weight || 700, lineHeight: 1, padding: 0,
  };
  it.position = { x: o.x - box / 2, y: o.y - box / 2 };
  it.box = box;
  return base(it, o);
}
// позиция левого верхнего угла, чтобы центр буквы был в (x,y) при масштабе s и повороте r (градусы)
function place(box, x, y, s, r) {
  const a = r * Math.PI / 180, h = box / 2 * s;
  return { x: x - (h * Math.cos(a) - h * Math.sin(a)), y: y - (h * Math.sin(a) + h * Math.cos(a)), s, r };
}
function mimeOf(url) {
  const m = String(url).toLowerCase().split("?")[0].match(/\.(\w+)$/);
  return ({ gif: "image/gif", webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    svg: "image/svg+xml", webm: "video/webm", mp4: "video/mp4" })[m && m[1]] || "image/png";
}
function picture(o) { // o: {url, cells, px, pxh, x, y}
  const w = o.px || 512, h = o.pxh || w;
  const it = buildImage({ width: w, height: h, url: o.url, mime: o.mime || mimeOf(o.url) },
    { dpi: w / (o.cells || 2), offset: { x: w / 2, y: h / 2 } }).build();
  it.position = { x: o.x, y: o.y };
  return base(it, o);
}

// ── эффекты применения (каждая функция возвращает «время попадания» в мс) ──
const FX = {
  projectile(A, B, o, delay) {
    const dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy) || 1;
    const dur = Math.max(180, dist / DPI / (o.speed || 14) * 1000);
    const r = (o.size || 0.3) * DPI / 2, n = o.trail ?? 6, col = o.color || "#ff7a1a", core = o.core || "#fff3c4";
    const arc = (o.arc || 0) * DPI, nx = -dy / dist, ny = dx / dist;
    const at = p => { const q = c01(p), h = Math.sin(Math.PI * q) * arc; return { x: A.x + dx * q + nx * h, y: A.y + dy * q + ny * h }; };
    const z = Date.now(), s = at(0);
    const glow = circle({ ...s, r: r * 2.2, fill: col, fo: 0.22, z: z + 1 });
    const head = circle({ ...s, r, fill: col, fo: 1, z: z + 2 });
    const hot = circle({ ...s, r: r * 0.5, fill: core, fo: 0.95, z: z + 3 });
    const trail = [];
    for (let k = 1; k <= n; k++) trail.push(circle({ ...s, r: r * (1 - k / (n + 1) * 0.7), fill: col, fo: 0.6 * (1 - k / (n + 1)), z: z - k }));
    const total = dur + 60;
    spawn(delay, [glow, head, hot, ...trail], { dur: total, f: (p, P) => {
      const t = p * total / dur, c = at(t);
      for (const it of [glow, head, hot]) P.set(it.id, { x: c.x, y: c.y, fo: t > 1 ? 0 : undefined });
      trail.forEach((it, k) => { const c2 = at(t - (k + 1) * 0.045); P.set(it.id, { x: c2.x, y: c2.y }); });
    } });
    return dur;
  },
  beam(A, B, o, delay) {
    const dur = o.duration || 650, w = (o.width || 0.12) * DPI, col = o.color || "#b48cff";
    const outer = line({ p1: A, p2: B, color: col, w: w * 3, so: 0 });
    const inner = line({ p1: A, p2: B, color: o.core || "#ffffff", w, so: 0 });
    spawn(delay, [outer, inner], { dur, f: (p, P) => {
      const env = p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1, fl = 0.75 + 0.25 * Math.sin(p * dur * 0.06);
      P.set(outer.id, { so: 0.4 * env * fl }); P.set(inner.id, { so: env * fl });
    } });
    return o.hitAt ?? 120;
  },
  burst(c, o, delay) {
    const R = (o.radius || 1) * DPI, col = o.color || "#ffb347", core = o.core || "#fff3c4", dur = o.duration || 700, z = Date.now() + 10;
    const flash = circle({ x: c.x, y: c.y, r: R, fill: core, fo: 0, s: 0.2, z });
    const ring = circle({ x: c.x, y: c.y, r: R, fill: col, stroke: col, so: 0, sw: DPI * 0.07, s: 0.3, z: z + 1 });
    const sp = [];
    for (let k = 0; k < (o.sparks ?? 10); k++) {
      const a = Math.random() * TAU, d = R * (0.7 + Math.random() * 0.7);
      sp.push({ it: circle({ x: c.x, y: c.y, r: DPI * (0.035 + Math.random() * 0.04), fill: k % 2 ? col : core, fo: 0, n: 8, z: z + 2 }), dx: Math.cos(a) * d, dy: Math.sin(a) * d });
    }
    spawn(delay, [flash, ring, ...sp.map(s => s.it)], { dur, f: (p, P) => {
      const e = out3(p);
      P.set(flash.id, { s: 0.2 + 0.8 * e, fo: 0.75 * (1 - p) * (o.flash ?? 1) });
      P.set(ring.id, { s: 0.3 + 0.9 * e, so: 1 - p });
      for (const s of sp) P.set(s.it.id, { x: c.x + s.dx * e, y: c.y + s.dy * e, fo: 1 - p });
    } });
    return 0;
  },
  area(c, o, delay) {
    const R = (o.radius || 3) * DPI, col = o.color || "#ff7a1a", op = o.opacity ?? 0.3, dur = o.duration || 1400, z = Date.now() - 5;
    const fill = circle({ x: c.x, y: c.y, r: R, fill: col, fo: 0, s: 0.01, n: 40, layer: o.layer, z });
    const edge = circle({ x: c.x, y: c.y, r: R, fill: col, stroke: o.edge || col, so: 0, sw: DPI * 0.08, s: 0.01, n: 40, layer: o.layer, z: z + 1 });
    spawn(delay, [fill, edge], { dur, f: (p, P) => {
      const g = 0.01 + 0.99 * out3(p / 0.25), fade = p > 0.65 ? 1 - (p - 0.65) / 0.35 : 1;
      P.set(fill.id, { s: g, fo: op * fade * (0.85 + 0.15 * Math.sin(p * 25)) });
      P.set(edge.id, { s: g, so: 0.9 * fade });
    } });
    return 0;
  },
  rise(c, o, delay) {
    const H = (o.height || 1.4) * DPI, dur = o.duration || 1400, spread = (c.r || DPI / 2) * 0.8, col = o.color || "#7be3b9", z = Date.now() + 20;
    const ms = [];
    for (let k = 0; k < (o.count || 12); k++) {
      const x = c.x + (Math.random() * 2 - 1) * spread, y = c.y + Math.random() * spread * 0.6;
      ms.push({ it: circle({ x, y, r: DPI * (0.04 + Math.random() * 0.05), fill: k % 3 ? col : (o.core || "#ffffff"), fo: 0, n: 8, z: z + k }), x, y, q0: Math.random() * 0.4 });
    }
    spawn(delay, ms.map(m => m.it), { dur, f: (p, P) => {
      for (const m of ms) { const lp = c01((p - m.q0) / 0.6); P.set(m.it.id, { x: m.x, y: m.y - H * out3(lp), fo: Math.sin(Math.PI * lp) }); }
    } });
    return 0;
  },
  // «Буквы имени»: буквы вырываются из цели, складываются в слово над ней, дрожат и по одной
  // улетают по спирали к заклинателю (A — цель, B — заклинатель). Возвращает время прилёта последней буквы.
  letters(A, B, o, delay) {
    const word = [...String(o.text || A.name || "ИМЯ").toUpperCase()].filter(ch => /\p{L}/u.test(ch)).slice(0, o.max || 10);
    if (!word.length) word.push(..."ИМЯ");
    const n = word.length, fs = Math.round((o.size || 0.38) * DPI), gap = fs * 0.78;
    const tUp = o.up || 650, tHold = o.hold || 450, stag = o.stagger ?? 110;
    const dist = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const tFly = Math.max(650, dist / DPI / (o.speed || 7) * 1000);
    const total = tUp + tHold + stag * (n - 1) + tFly;
    const ghosts = o.ghosts ?? 2, z = Date.now() + 40;
    const L = word.map((ch, k) => {
      const sx = A.x + (k - (n - 1) / 2) * gap, sy = A.y - (A.r || DPI / 2) * 0.95 - (k % 2 ? 0.08 : 0) * DPI;
      const bend = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9) * DPI;
      const spin = (Math.random() * 2 - 1) * 260, ph = Math.random() * TAU;
      const mk = (fo, gz) => glyph({ ch, fs, x: A.x, y: A.y, color: o.color || "#ece8ff", stroke: o.stroke || "#1d1038", font: o.font, z: gz });
      const g = circle({ x: A.x, y: A.y, r: fs * 0.55, fill: o.glow || "#a78bfa", fo: 0, n: 14, z: z + k * 10 });
      const main = mk(0, z + k * 10 + 5), gh = [];
      for (let j = 1; j <= ghosts; j++) gh.push(mk(0, z + k * 10 + 5 - j));
      return { ch, k, sx, sy, bend, spin, ph, g, main, gh };
    });
    // состояние буквы в момент tm (мс от старта)
    const at = (l, tm) => {
      const f0 = tUp + tHold + stag * l.k;
      if (tm < tUp) {   // вырывается из токена и поднимается на место в слове
        const e = out3(tm / tUp);
        return { x: A.x + (l.sx - A.x) * e, y: A.y + (l.sy - A.y) * e - Math.sin(Math.PI * e) * 0.25 * DPI,
          s: 0.25 + 0.75 * e, r: (1 - e) * l.spin * 0.4, o: c01(tm / (tUp * 0.5)), fly: 0 };
      }
      if (tm < f0) {    // висит над целью и дрожит — его «тянут»
        const k2 = c01((tm - tUp) / (tHold + stag * l.k)), j = (1 + 2 * k2) * 0.025 * DPI;
        return { x: l.sx + Math.sin(tm * 0.09 + l.ph) * j, y: l.sy + Math.cos(tm * 0.11 + l.ph) * j,
          s: 1 + 0.06 * Math.sin(tm * 0.02 + l.ph), r: Math.sin(tm * 0.03 + l.ph) * 8, o: 0.85 + 0.15 * Math.sin(tm * 0.05 + l.ph), fly: 0 };
      }
      const q = c01((tm - f0) / tFly), e = q * q * (3 - 2 * q);   // полёт к заклинателю по изогнутой траектории
      const dx = B.x - l.sx, dy = B.y - l.sy, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d;
      const h = Math.sin(Math.PI * e) * l.bend, sw = Math.sin(e * TAU * 1.5) * (1 - e) * 0.15 * DPI;
      return { x: l.sx + dx * e + nx * (h + sw), y: l.sy + dy * e + ny * (h + sw),
        s: 1 - 0.7 * e, r: l.spin * e, o: q < 0.8 ? 1 : 1 - (q - 0.8) / 0.2, fly: q > 0 && q < 1 ? 1 : 0, done: q >= 1 };
    };
    const items = [];
    for (const l of L) items.push(l.g, l.main, ...l.gh);
    spawn(delay, items, { dur: total + 40, f: (p, P) => {
      const tm = p * (total + 40);
      for (const l of L) {
        const c = at(l, tm), op = c.done ? 0 : c.o;
        P.set(l.main.id, { ...place(l.main.box, c.x, c.y, c.s, c.r), fo: op, so: op * 0.9 });
        P.set(l.g.id, { x: c.x, y: c.y, s: c.s * (1.1 + 0.15 * Math.sin(tm * 0.02 + l.ph)), fo: op * (c.fly ? 0.35 : 0.22) });
        l.gh.forEach((g, j) => {
          const c2 = at(l, tm - (j + 1) * 55), go = c.fly ? c2.o * 0.4 / (j + 1) : 0;
          P.set(g.id, { ...place(g.box, c2.x, c2.y, c2.s, c2.r), fo: go, so: 0 });
        });
      }
    } });
    return total;
  },
  // «Втягивание»: кольцо и искры стягиваются в точку
  implode(c, o, delay) {
    const R = (o.radius || 1.1) * DPI, col = o.color || "#7c3aed", core = o.core || "#ede9fe", dur = o.duration || 800, z = Date.now() + 30;
    const ring = circle({ x: c.x, y: c.y, r: R, fill: col, stroke: col, so: 0, sw: DPI * 0.05, n: 36, dash: [DPI * 0.12, DPI * 0.1], z });
    const dark = circle({ x: c.x, y: c.y, r: R * 0.8, fill: o.fill || "#120a22", fo: 0, n: 30, z: z - 1 });
    const sp = [];
    for (let k = 0; k < (o.sparks ?? 12); k++) {
      const a = Math.random() * TAU, d = R * (0.8 + Math.random() * 0.6);
      sp.push({ it: circle({ x: c.x, y: c.y, r: DPI * (0.03 + Math.random() * 0.03), fill: k % 2 ? col : core, fo: 0, n: 8, z: z + 1 + k }), a, d, q0: Math.random() * 0.3 });
    }
    spawn(delay, [dark, ring, ...sp.map(s => s.it)], { dur, f: (p, P) => {
      const e = p * p;
      P.set(ring.id, { s: Math.max(0.02, 1 - e), r: -200 * p, so: Math.sin(Math.PI * Math.min(1, p * 1.2)) });
      P.set(dark.id, { s: Math.max(0.02, 1 - 0.7 * e), fo: 0.4 * Math.sin(Math.PI * p) });
      for (const s of sp) {
        const lp = c01((p - s.q0) / (1 - s.q0)), k = 1 - lp * lp, a = s.a + lp * 1.6;
        P.set(s.it.id, { x: c.x + Math.cos(a) * s.d * k, y: c.y + Math.sin(a) * s.d * k, fo: Math.sin(Math.PI * lp) });
      }
    } });
    return 0;
  },
  image(c, o, delay) {
    const dur = o.duration || 1500;
    const it = picture({ x: c.x, y: c.y, url: o.url, cells: o.size || 2, px: o.px, pxh: o.pxh, mime: o.mime, s: 0.01 });
    spawn(delay, [it], { dur, f: (p, P) => {
      P.set(it.id, { s: p < 0.12 ? 0.01 + out3(p / 0.12) : p > 0.88 ? Math.max(0.01, 1 - (p - 0.88) / 0.12) : 1 });
    } });
    return 0;
  },
};

// центр и радиус токенов
export async function tokens(ids) {
  const out = {};
  await Promise.all(ids.map(async id => {
    try { const b = await OBR.scene.items.getItemBounds([id]); out[id] = { x: b.center.x, y: b.center.y, r: Math.max(b.width, b.height) / 2 }; } catch (e) {}
  }));
  try {   // имена токенов (нужны, например, для «букв имени»)
    for (const it of await OBR.scene.items.getItems(ids.filter(id => out[id])))
      out[it.id].name = (it.text && it.text.plainText) || it.name || "";
  } catch (e) {}
  return out;
}

// Проиграть способность. Возвращает {idЦели: мс до попадания}
export async function play(A, cId, tIds = []) {
  const hits = {}, ret = {};   // ret — когда «обратный» снаряд долетел до заклинателя
  if (!A) return hits;
  await grid();
  const info = await tokens([...new Set([cId, ...tIds].filter(Boolean))]);
  const C = cId && info[cId] ? { id: cId, ...info[cId] } : null;
  let T = tIds.filter(id => info[id]).map(id => ({ id, ...info[id] }));
  if (!T.length && C) T = [C];
  if (!T.length) return hits;
  for (const st of A.cast || []) {
    const fn = FX[st.fx]; if (!fn) { console.warn("[fx] неизвестный эффект", st.fx); continue; }
    const d0 = st.delay || 0, stag = st.stagger || 0;
    if (st.fx === "letters") {   // всегда летят от цели к заклинателю
      if (!C) continue;
      T.forEach((t, k) => {
        if (t.id === C.id) return;
        const d = d0 + stag * k + (st.after === "hit" ? hits[t.id] || 0 : 0);
        ret[t.id] = Math.max(ret[t.id] || 0, d + fn(t, C, st, d));
      });
      continue;
    }
    if (st.fx === "projectile" || st.fx === "beam") {
      if (!C) continue;
      T.forEach((t, k) => {
        if (t.id === C.id) return;
        const d = d0 + stag * k + (st.after === "hit" ? hits[t.id] || 0 : 0);
        if (st.reverse) ret[t.id] = Math.max(ret[t.id] || 0, d + fn(t, C, st, d));   // от цели к заклинателю
        else hits[t.id] = Math.max(hits[t.id] || 0, d + fn(C, t, st, d));
      });
      continue;
    }
    let at = st.at || "targets", list;
    if (at === "caster") list = C ? [C] : [];
    else if (at === "center") {
      const x = T.reduce((s, t) => s + t.x, 0) / T.length, y = T.reduce((s, t) => s + t.y, 0) / T.length;
      list = [{ id: "@center", x, y, r: T[0].r, hit: Math.max(0, ...T.map(t => hits[t.id] || 0)) }];
    } else list = T;
    list.forEach((t, k) => {
      let h = t.hit ?? hits[t.id] ?? 0;
      if (st.after === "return") h = ret[t.id] ?? Math.max(0, ...Object.values(ret));
      fn(t, st, d0 + stag * k + (st.after === "hit" || st.after === "return" ? h : 0));
    });
  }
  return hits;
}

// ── висящие эффекты (ауры), привязаны к токену и двигаются вместе с ним ──
export async function startAura(parts, tok) {
  await grid();
  const T = (await tokens([tok]))[tok];
  if (!T) throw new Error("token not found");
  const items = [], fs = [], z = Date.now();
  const appear = t => c01(t / 0.5);
  for (const p of parts || []) {
    const col = p.color || "#b48cff", per = p.period || 2, pu = p.pulse ?? 0.04, op = p.opacity, sp = p.spin || 0;
    const wave = t => Math.sin(t * TAU / per);
    const fl = t => 1 - (p.flicker || 0) * Math.pow(0.5 + 0.5 * Math.sin(t * 7.3 + Math.sin(t * 2.1) * 3), 4);   // «мерцание»
    if (p.fx === "ring") {
      const o = op ?? 0.9;
      const it = circle({ x: T.x, y: T.y, r: T.r * (p.size || 1.1), fill: col, fo: 0, stroke: col, so: 0, sw: DPI * (p.width || 0.05),
        dash: p.dash ? [DPI * 0.18, DPI * 0.12] : [], n: 36, attach: tok, z: z + items.length });
      items.push(it);
      fs.push((t, P) => P.set(it.id, { s: (1 + pu * wave(t)) * (0.6 + 0.4 * out3(appear(t))), r: sp * t, so: o * appear(t) * (0.75 + 0.25 * wave(t)) * fl(t), fo: (p.fill || 0) * appear(t) }));
    } else if (p.fx === "glow") {
      const o = op ?? 0.28;
      const it = circle({ x: T.x, y: T.y, r: T.r * (p.size || 1.3), fill: col, fo: 0, n: 36, attach: tok, layer: p.layer || "MOUNT", z: z + items.length });
      items.push(it);
      fs.push((t, P) => P.set(it.id, { s: 1 + (p.pulse ?? 0.06) * wave(t), fo: o * appear(t) * (0.7 + 0.3 * wave(t)) * fl(t) }));
    } else if (p.fx === "orbit") {
      const n = p.count || 3, o = op ?? 1, sp2 = p.speed ?? 90;
      for (let k = 0; k < n; k++) {
        const r0 = k * 360 / n;
        const it = circle({ x: T.x, y: T.y, cx: T.r * (p.radius || 1.05), r: DPI * (p.size || 0.07), fill: k % 2 && p.color2 ? p.color2 : col, fo: 0, n: 10, rot: r0, attach: tok, z: z + items.length });
        items.push(it);
        fs.push((t, P) => P.set(it.id, { r: r0 + sp2 * t, fo: o * appear(t) * (0.7 + 0.3 * Math.sin(t * 5 + k)) * fl(t + k) }));
      }
    } else if (p.fx === "image") {
      const it = picture({ x: T.x, y: T.y, url: p.url, cells: (p.size || 1.5) * T.r * 2 / DPI, px: p.px, pxh: p.pxh, mime: p.mime, attach: tok, layer: p.layer, s: 0.01, z: z + items.length });
      items.push(it);
      fs.push((t, P) => P.set(it.id, { s: Math.max(0.01, out3(appear(t))) * (1 + pu * wave(t)), r: sp * t }));
    }
  }
  if (!items.length) throw new Error("empty aura");
  await OBR.scene.local.addItems(items);
  const a = { ids: items.map(i => i.id), loop: true, t0: now(), f: (t, P) => fs.forEach(f => f(t, P)) };
  anims.add(a); kick();
  return { tok, a };
}
export function stopAura(r, del = true) {
  if (!r) return;
  anims.delete(r.a);
  if (del) OBR.scene.local.deleteItems(r.a.ids).catch(() => {});
}
export function stopAll() { anims.clear(); }
