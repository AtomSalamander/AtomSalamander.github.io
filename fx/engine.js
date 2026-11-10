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
  if (q.pts) d.points = q.pts.map(p => ({ x: p.x, y: p.y }));
  if (q.s != null) d.scale = { x: q.s, y: q.s };
  if (q.r != null) d.rotation = q.r;
  const st = d.style || (d.text && d.text.style);
  if (st) {
    if (q.fo != null) st.fillOpacity = c01(q.fo);
    if (q.so != null) st.strokeOpacity = c01(q.so);
    if (q.fc) st.fillColor = q.fc;
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
// Произвольная фигура (кривая) по точкам относительно position: осколки, звёзды, руны, молнии, соты
function poly(o) {
  const pts = o.pts.map(p => ({ x: p.x, y: p.y }));
  const it = buildCurve().points(pts).build();
  it.points = pts;
  it.position = { x: o.x, y: o.y };
  it.style = {
    fillColor: o.fill || o.stroke || "#ffffff", fillOpacity: o.fo ?? 0,
    strokeColor: o.stroke || o.fill || "#ffffff", strokeOpacity: o.so ?? 0,
    strokeWidth: o.sw || 0, strokeDash: o.dash || [], tension: o.tension ?? 0, closed: o.closed ?? true,
  };
  return base(it, o);
}
const backOut = p => { const q = c01(p) - 1, k = 1.7; return 1 + q * q * ((k + 1) * q + k); };
const rnd = s => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function starPts(r, k = 5, inner = 0.45, rot = 0, ox = 0, oy = 0) {
  const pts = [];
  for (let i = 0; i < k * 2; i++) {
    const a = rot + i / (k * 2) * TAU - Math.PI / 2, rr = i % 2 ? r * inner : r;
    pts.push({ x: ox + Math.cos(a) * rr, y: oy + Math.sin(a) * rr });
  }
  return pts;
}
function shardPts(r) {
  const n = 3 + Math.floor(Math.random() * 3), a0 = Math.random() * TAU, pts = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + i / n * TAU + (Math.random() - 0.5) * 0.8, rr = r * (0.5 + Math.random() * 0.6);
    pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
  }
  return pts;
}
// Руны рисуем сами штрихами (не зависим от шрифтов). Координаты в квадрате 0..1.
const RUNES = [
  [[0, 1], [0, 0], [0.7, 0.25], [0, 0.5], [0.7, 1]],
  [[0, 0], [0, 1], [0, 0.25], [0.6, 0.5], [0, 0.75]],
  [[0.5, 1], [0.5, 0], [0.5, 0.45], [0, 0], [0.5, 0.45], [1, 0]],
  [[0.5, 1], [0.5, 0], [0, 0.35], [0.5, 0], [1, 0.35]],
  [[0.8, 0], [0, 0.5], [0.8, 1]],
  [[0, 1], [0.8, 0.3], [0.4, 0], [0, 0.3], [0.8, 1]],
  [[0, 0], [0, 1], [1, 0], [1, 1], [0, 0]],
  [[0, 0], [1, 1], [0.5, 0.5], [1, 0], [0, 1]],
  [[0, 1], [0, 0], [0.5, 0.5], [1, 0], [1, 1]],
];
function runePts(s, ox, oy, rot) {
  const R = RUNES[Math.floor(Math.random() * RUNES.length)], c = Math.cos(rot), sn = Math.sin(rot);
  return R.map(([u, v]) => { const x = (u - 0.5) * s * 0.7, y = (v - 0.5) * s; return { x: ox + x * c - y * sn, y: oy + x * sn + y * c }; });
}
// Магический круг: внешнее кольцо, пунктирное внутреннее, звезда, руны по кругу
function sigilParts(x, y, R, o, ex = {}) {
  const col = o.color || "#a24bff", w = DPI * (o.width || 0.03), L = ex.layer || o.layer || "MOUNT", at = ex.attach;
  let z = ex.z ?? Date.now() + 5;
  const P = [], add = (it, grp, kind, i = 0) => P.push({ it, grp, kind, i });
  if ((o.fill ?? 0.1) > 0) add(circle({ x, y, r: R, fill: col, fo: 0, n: 40, attach: at, layer: L, z: z++ }), 0, "fill");
  add(circle({ x, y, r: R, fill: col, stroke: col, sw: w * 1.4, n: 48, attach: at, layer: L, z: z++ }), 1, "ring");
  add(circle({ x, y, r: R * 0.8, fill: col, stroke: col, sw: w, n: 40, dash: [DPI * 0.08, DPI * 0.06], attach: at, layer: L, z: z++ }), -1, "ring");
  add(circle({ x, y, r: R * 0.3, fill: col, stroke: col, sw: w, n: 24, attach: at, layer: L, z: z++ }), 1, "ring");
  const k = o.points || 5, st = Math.floor(k / 2), vs = [];
  for (let i = 0; i < k; i++) { const a = (i * st % k) / k * TAU - Math.PI / 2; vs.push({ x: Math.cos(a) * R * 0.78, y: Math.sin(a) * R * 0.78 }); }
  add(poly({ x, y, pts: vs, stroke: col, sw: w, attach: at, layer: L, z: z++ }), -1, "star");
  const nr = o.runes ?? 8;
  for (let i = 0; i < nr; i++) {
    const a = i / nr * TAU;
    add(poly({ x, y, pts: runePts(R * 0.13, Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, a + Math.PI / 2), stroke: o.rune || col, sw: w * 0.9, closed: false, attach: at, layer: L, z: z++ }), 1, "rune", i);
  }
  return P;
}
function sigilFrame(parts, P, tm, env, spin, o) {
  const grow = 1 + 0.25 * (1 - out3(c01(tm / 500))), op = o.opacity ?? 0.9, rs = o.runeStep ?? 70;
  for (const q of parts) {
    if (q.kind === "fill") { P.set(q.it.id, { s: grow, fo: (o.fill ?? 0.1) * env }); continue; }
    let a = env;
    if (q.kind === "rune") a *= c01((tm - 150 - q.i * rs) / 180);
    if (q.kind === "star") a *= c01((tm - 100) / 400);
    P.set(q.it.id, { s: grow, r: q.grp * spin * tm / 1000, so: op * a });
  }
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
    // искры, которые снаряд роняет по пути (embers: сколько)
    const life = 520, em = [];
    for (let k = 0; k < (o.embers || 0); k++) {
      const a = Math.random() * TAU, d = DPI * (0.15 + Math.random() * 0.3);
      em.push({ it: circle({ ...s, r: DPI * (0.02 + Math.random() * 0.03), fill: k % 2 ? col : core, fo: 0, n: 8, z: z - 20 - k }),
        ti: 0.05 + Math.random() * 0.9, dx: Math.cos(a) * d, dy: Math.sin(a) * d - DPI * 0.15 });
    }
    const total = dur + (em.length ? life : 60);
    spawn(delay, [glow, head, hot, ...trail, ...em.map(e => e.it)], { dur: total, f: (p, P) => {
      const tm = p * total, t = tm / dur, c = at(t), pu = 1 + 0.15 * Math.sin(tm * 0.05);
      for (const it of [head, hot]) P.set(it.id, { x: c.x, y: c.y, fo: t > 1 ? 0 : undefined });
      P.set(glow.id, { x: c.x, y: c.y, s: pu, fo: t > 1 ? 0 : 0.22 });
      trail.forEach((it, k) => { const c2 = at(t - (k + 1) * 0.045); P.set(it.id, { x: c2.x, y: c2.y, fo: t - (k + 1) * 0.045 > 1 ? 0 : undefined }); });
      for (const e of em) {
        const age = (tm - e.ti * dur) / life;
        if (age < 0 || age > 1) { P.set(e.it.id, { fo: 0 }); continue; }
        const c0 = at(e.ti), g = out3(age);
        P.set(e.it.id, { x: c0.x + e.dx * g, y: c0.y + e.dy * g, s: 1 - 0.6 * age, fo: 0.9 * (1 - age) });
      }
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
      const a = Math.random() * TAU, d = R * (0.7 + Math.random() * 0.7), rr = DPI * (0.035 + Math.random() * 0.04);
      const it = o.stars   // stars: true — искры-звёздочки
        ? poly({ x: c.x, y: c.y, pts: starPts(rr * 1.9, 5, 0.42), fill: k % 2 ? col : core, fo: 0, z: z + 2 })
        : circle({ x: c.x, y: c.y, r: rr, fill: k % 2 ? col : core, fo: 0, n: 8, z: z + 2 });
      sp.push({ it, dx: Math.cos(a) * d, dy: Math.sin(a) * d, spin: (Math.random() * 2 - 1) * 400 });
    }
    spawn(delay, [flash, ring, ...sp.map(s => s.it)], { dur, f: (p, P) => {
      const e = out3(p);
      P.set(flash.id, { s: 0.2 + 0.8 * e, fo: 0.75 * (1 - p) * (o.flash ?? 1) });
      P.set(ring.id, { s: 0.3 + 0.9 * e, so: 1 - p });
      for (const s of sp) P.set(s.it.id, { x: c.x + s.dx * e, y: c.y + s.dy * e, fo: 1 - p, r: o.stars ? s.spin * p : undefined });
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
      const g = o.glyph && k % (o.glyphEvery || 3) === 0;   // glyph: "+" — часть частиц становится символом
      const it = g
        ? glyph({ ch: o.glyph, fs: Math.round(DPI * (o.glyphSize || 0.24) * (0.8 + Math.random() * 0.4)), x, y, color: o.glyphColor || col, stroke: o.glyphStroke || "#ffffff", sw: DPI * 0.008, z: z + k })
        : circle({ x, y, r: DPI * (0.04 + Math.random() * 0.05), fill: k % 3 ? col : (o.core || "#ffffff"), fo: 0, n: 8, z: z + k });
      ms.push({ it, g, x, y, q0: Math.random() * 0.4, w: DPI * 0.08 * Math.random(), ph: Math.random() * TAU });
    }
    spawn(delay, ms.map(m => m.it), { dur, f: (p, P) => {
      for (const m of ms) {
        const lp = c01((p - m.q0) / 0.6), x = m.x + Math.sin(lp * 9 + m.ph) * m.w, y = m.y - H * out3(lp), fo = Math.sin(Math.PI * lp);
        P.set(m.it.id, m.g ? { ...place(m.it.box, x, y, 1, 0), fo, so: fo * 0.7 } : { x, y, fo });
      }
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
  // Дым: клубы раздуваются, поднимаются и тают
  smoke(c, o, delay) {
    const R = (o.radius || 1) * DPI, n = o.count || 8, dur = o.duration || 2200, op = o.opacity ?? 0.45, z = Date.now() + (o.zo ?? 15);
    const ps = [];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, d0 = Math.random() * R * 0.35, d1 = R * (0.4 + Math.random() * 0.6);
      ps.push({ it: circle({ x: c.x + Math.cos(a) * d0, y: c.y + Math.sin(a) * d0, r: DPI * (o.size || 0.35) * (0.7 + Math.random() * 0.6),
        fill: k % 2 && o.color2 ? o.color2 : (o.color || "#4a4a4a"), fo: 0, n: 16, s: 0.3, z: z + k }),
        a, d0, d1, q0: Math.random() * 0.25, up: (o.rise ?? 0.5) * DPI * (0.6 + Math.random() * 0.8), g: 1 + Math.random() * 1.2 });
    }
    spawn(delay, ps.map(p => p.it), { dur, f: (p, P) => {
      for (const m of ps) {
        const lp = c01((p - m.q0) / (1 - m.q0)), e = out3(lp), d = m.d0 + (m.d1 - m.d0) * e;
        P.set(m.it.id, { x: c.x + Math.cos(m.a) * d, y: c.y + Math.sin(m.a) * d - m.up * lp, s: 0.3 + m.g * e,
          fo: lp > 0 ? op * Math.min(1, lp / 0.12) * Math.pow(1 - lp, 1.3) : 0 });
      }
    } });
    return 0;
  },
  // Осколки: разлетаются дугой и кувыркаются
  debris(c, o, delay) {
    const R = (o.radius || 1.5) * DPI, n = o.count || 12, dur = o.duration || 1100, z = Date.now() + 25;
    const cols = [o.color || "#3a2a20", o.color2 || o.color || "#6b4a30"], ch = [];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, r = DPI * (o.size || 0.09) * (0.6 + Math.random() * 0.8);
      ch.push({ it: poly({ x: c.x, y: c.y, pts: shardPts(r), fill: cols[k % 2], fo: 0, stroke: o.hot || cols[k % 2], so: 0, sw: DPI * 0.015, z: z + k }),
        a, d: R * (0.4 + Math.random() * 0.7), h: DPI * (0.3 + Math.random() * 0.8) * (o.height ?? 1), spin: (Math.random() * 2 - 1) * 720 });
    }
    spawn(delay, ch.map(x => x.it), { dur, f: (p, P) => {
      const e = out3(p), fo = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      for (const m of ch) P.set(m.it.id, { x: c.x + Math.cos(m.a) * m.d * e, y: c.y + Math.sin(m.a) * m.d * e - Math.sin(Math.PI * Math.min(1, p * 1.2)) * m.h,
        r: m.spin * p, fo, so: fo * (o.hot ? 1 - p : 0.5) });
    } });
    return 0;
  },
  // Ударная волна: несколько тонких колец друг за другом
  shock(c, o, delay) {
    const R = (o.radius || 1.5) * DPI, n = o.rings || 2, dur = o.duration || 700, col = o.color || "#ffffff", z = Date.now() + 12, gap = o.gap ?? 0.18;
    const rs = [];
    for (let k = 0; k < n; k++) rs.push(circle({ x: c.x, y: c.y, r: R, fill: col, stroke: col, so: 0, sw: DPI * (o.width || 0.05) * (1 - k * 0.25), n: 40, s: 0.05, z: z + k }));
    const total = dur * (1 + gap * (n - 1));
    spawn(delay, rs, { dur: total, f: (p, P) => {
      const tm = p * total;
      rs.forEach((it, k) => { const lp = c01((tm - k * gap * dur) / dur); P.set(it.id, { s: 0.05 + 0.95 * out3(lp), so: lp > 0 ? (o.opacity ?? 0.9) * (1 - lp) : 0 }); });
    } });
    return 0;
  },
  // Искры/угольки: поднимаются, покачиваясь, и гаснут
  embers(c, o, delay) {
    const S = o.spread != null ? o.spread * DPI : (c.r || DPI / 2) * 0.9, n = o.count || 12, dur = o.duration || 1600, z = Date.now() + 35;
    const cols = [o.core || "#fff3c4", o.color || "#ffb347", o.color2 || o.color || "#ff5a10"], ms = [];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * S, x = c.x + Math.cos(a) * d, y = c.y + Math.sin(a) * d;
      ms.push({ it: circle({ x, y, r: DPI * (o.size || 0.035) * (0.6 + Math.random() * 0.8), fill: cols[k % 3], fo: 0, n: 8, z: z + k }),
        x, y, q0: Math.random() * 0.45, h: DPI * (o.height || 1) * (0.5 + Math.random() * 0.8), w: DPI * 0.15 * (0.5 + Math.random()), ph: Math.random() * TAU, fr: 2 + Math.random() * 3 });
    }
    spawn(delay, ms.map(m => m.it), { dur, f: (p, P) => {
      for (const m of ms) {
        const lp = c01((p - m.q0) / 0.55);
        P.set(m.it.id, { x: m.x + Math.sin(lp * m.fr * Math.PI + m.ph) * m.w * lp, y: m.y - m.h * out3(lp), s: 1 - 0.6 * lp,
          fo: lp > 0 ? (lp < 0.15 ? lp / 0.15 : 1 - (lp - 0.15) / 0.85) * (0.75 + 0.25 * Math.sin(p * 60 + m.ph)) : 0 });
      }
    } });
    return 0;
  },
  // Молния (зигзаг, пересобирается каждые ~70 мс) или wave: true — извивающееся щупальце
  bolt(A, B, o, delay) {
    const dur = o.duration || 450, w = (o.width || 0.06) * DPI, n = o.segments || (o.wave ? 18 : 9), col = o.color || "#ffe066", core = o.core || "#ffffff";
    const dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy) || 1, nx = -dy / dist, ny = dx / dist;
    const amp = (o.jag ?? (o.wave ? 0.18 : 0.35)) * DPI, grow = o.grow ?? (o.wave ? 0.25 : 0.08), flick = o.flick || 70;
    const path = (tm, seed, g) => {
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const q = k / n * g, env = Math.sin(Math.PI * q);
        const off = o.wave ? Math.sin(q * (o.freq || 3) * TAU - tm * 0.012) * amp * env
          : (k === 0 || q >= 1 ? 0 : (rnd(seed * 31 + k) * 2 - 1) * amp * Math.pow(env, 0.6));
        pts.push({ x: q * dx + nx * off, y: q * dy + ny * off });
      }
      return pts;
    };
    const z = Date.now() + 30, ten = o.wave ? 0.5 : 0, p0 = path(0, 0, 0.01);
    const L = [
      poly({ x: A.x, y: A.y, pts: p0, stroke: col, sw: w * 4, closed: false, tension: ten, z }),
      poly({ x: A.x, y: A.y, pts: p0, stroke: col, sw: w * 1.8, closed: false, tension: ten, z: z + 1 }),
      poly({ x: A.x, y: A.y, pts: p0, stroke: core, sw: w * 0.8, closed: false, tension: ten, z: z + 2 }),
    ];
    const ops = [0.22, 0.75, 1];
    spawn(delay, L, { dur, f: (p, P) => {
      const tm = p * dur, seed = Math.floor(tm / flick), g = Math.max(0.01, c01(p / grow));
      const env = p > 0.75 ? (1 - p) / 0.25 : 1, fl = o.wave ? 1 : 0.6 + 0.4 * rnd(seed + 7), pts = path(tm, seed, g);
      L.forEach((it, k) => P.set(it.id, { pts, so: ops[k] * env * fl }));
    } });
    return o.hitAt ?? grow * dur;
  },
  // Магический круг на земле: рисуется, вращается, гаснет
  sigil(c, o, delay) {
    const dur = o.duration || 1800, R = (o.radius || 1) * DPI, parts = sigilParts(c.x, c.y, R, o, { layer: o.layer || "MOUNT" });
    spawn(delay, parts.map(q => q.it), { dur, f: (p, P) => {
      const tm = p * dur, env = c01(tm / 250) * (p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1);
      sigilFrame(parts, P, tm, env, o.spin ?? 60, o);
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
    if (st.fx === "bolt" && st.from === "sky") {   // молния с неба — заклинатель не нужен
      T.forEach((t, k) => {
        const d = d0 + stag * k, S = { x: t.x + (Math.random() - 0.5) * DPI, y: t.y - (st.height || 4) * DPI };
        hits[t.id] = Math.max(hits[t.id] || 0, d + fn(S, t, st, d));
      });
      continue;
    }
    if (st.fx === "projectile" || st.fx === "beam" || st.fx === "bolt") {
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
    } else if (p.fx === "dome") {
      // Защитный купол: полупрозрачная сфера с сотами, бликом, бегущим переливом и рябью
      const R = T.r * (p.size || 1.3), o = op ?? 1, hi = p.highlight || "#ffffff", L = p.layer || "ATTACHMENT", dl = p.delay || 0;
      const D = [], add = (it, kind, ex = {}) => { items.push(it); D.push({ it, kind, ...ex }); };
      const cfg = { attach: tok, layer: L };
      add(circle({ x: T.x, y: T.y, r: R, fill: col, fo: 0, n: 48, ...cfg, z: z + items.length }), "fill");
      const hr = R / (p.cells || 3.4), sq = Math.sqrt(3), N = Math.ceil(R / hr) + 1;
      const proj = (x, y) => { const d = Math.hypot(x, y); if (!d) return { x, y }; const k = R * Math.sin(Math.min(1, d / R) * Math.PI / 2) / d; return { x: x * k, y: y * k }; };
      for (let a = -N; a <= N; a++) for (let b = -N; b <= N; b++) {
        const cx = hr * 1.5 * a, cy = hr * sq * (b + a / 2);
        if (Math.hypot(cx, cy) > R - hr * 0.6) continue;
        const pts = [];
        for (let v = 0; v < 6; v++) { const an = v / 6 * TAU; pts.push(proj(cx + Math.cos(an) * hr * 0.88, cy + Math.sin(an) * hr * 0.88)); }
        const c2 = proj(cx, cy);
        add(poly({ x: T.x, y: T.y, pts, stroke: p.grid || col, fill: p.grid || col, sw: DPI * 0.018, ...cfg, z: z + items.length }), "hex",
          { u: (c2.x + c2.y) / Math.SQRT2, d: Math.hypot(c2.x, c2.y) / R, ph: Math.random() * TAU });
      }
      add(circle({ x: T.x, y: T.y, r: R, fill: col, stroke: col, sw: DPI * 0.07, n: 56, ...cfg, z: z + items.length }), "rim", { o: 0.85 });
      add(circle({ x: T.x, y: T.y, r: R * 0.93, fill: hi, stroke: hi, sw: DPI * 0.025, n: 56, ...cfg, z: z + items.length }), "rim", { o: 0.35 });
      const arc = (r, a0, a1, m = 10) => { const pts = []; for (let i = 0; i <= m; i++) { const a = a0 + (a1 - a0) * i / m; pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); } return pts; };
      add(poly({ x: T.x, y: T.y, pts: arc(R * 0.8, 3.5, 4.4), stroke: hi, sw: DPI * 0.06, closed: false, tension: 0.5, ...cfg, z: z + items.length }), "hl", { o: 0.6 });
      add(poly({ x: T.x, y: T.y, pts: arc(R * 0.62, 3.75, 4.1), stroke: hi, sw: DPI * 0.035, closed: false, tension: 0.5, ...cfg, z: z + items.length }), "hl", { o: 0.4 });
      add(poly({ x: T.x, y: T.y, pts: arc(R * 0.86, 0.45, 1.1), stroke: hi, sw: DPI * 0.03, closed: false, tension: 0.5, ...cfg, z: z + items.length }), "hl", { o: 0.3 });
      add(circle({ x: T.x, y: T.y, r: R, fill: hi, stroke: hi, sw: DPI * 0.03, n: 48, ...cfg, z: z + items.length }), "ripple");
      const sweep = p.sweep || 3.2, every = p.rippleEvery || 2.8;
      fs.push((t, P) => {
        const ap = c01((t - dl) / 0.6), sc = ap > 0 ? Math.max(0.01, backOut(ap)) : 0.01, A = o * c01(ap * 1.5) * fl(t), br = 0.85 + 0.15 * wave(t);
        const u = ((t / sweep) % 1) * 3 * R - 1.5 * R;
        for (const q of D) {
          if (q.kind === "fill") P.set(q.it.id, { s: sc, fo: (p.fill ?? 0.13) * A * br });
          else if (q.kind === "hex") {
            const band = Math.exp(-Math.pow((q.u - u) / (R * 0.28), 2)), tw = 0.5 + 0.5 * Math.sin(t * 2.3 + q.ph);
            P.set(q.it.id, { s: sc, so: A * (0.12 + 0.2 * q.d + 0.55 * band + 0.1 * tw), fo: A * 0.1 * band });
          } else if (q.kind === "rim") P.set(q.it.id, { s: sc, so: A * q.o * br });
          else if (q.kind === "hl") P.set(q.it.id, { s: sc, so: A * q.o * (0.8 + 0.2 * Math.sin(t * 1.7)) });
          else if (q.kind === "ripple") {
            const rp = ((t - dl) % every) / 1.2;
            P.set(q.it.id, t > dl && rp < 1 ? { s: sc * (0.35 + 0.65 * out3(rp)), so: A * 0.5 * (1 - rp) } : { s: sc, so: 0 });
          }
        }
      });
    } else if (p.fx === "sigil") {
      const R = T.r * (p.size || 1.15), parts = sigilParts(T.x, T.y, R, p, { attach: tok, layer: p.layer || "MOUNT", z: z + items.length });
      items.push(...parts.map(q => q.it));
      fs.push((t, P) => sigilFrame(parts, P, t * 1000, (op ?? 1) * appear(t) * fl(t), p.spin ?? 15, p));
    } else if (p.fx === "stars") {
      // «Звёздочки над головой»: кружатся по эллипсу, ближние крупнее и ярче
      const n = p.count || 3, o = op ?? 1, rx = T.r * (p.radius || 0.6), ry = rx * (p.tilt ?? 0.35), oy = -T.r * (p.height ?? 0.85);
      const sz = DPI * (p.size || 0.09), sp2 = (p.speed ?? 120) * Math.PI / 180;
      for (let k = 0; k < n; k++) {
        const it = poly({ x: T.x, y: T.y, pts: starPts(sz, 5, 0.45, 0, 0, oy), fill: k % 2 && p.color2 ? p.color2 : col, stroke: p.edge || "#ffffff", sw: DPI * 0.01, attach: tok, z: z + items.length });
        items.push(it);
        fs.push((t, P) => {
          const a = sp2 * t + k / n * TAU, front = 0.5 + 0.5 * Math.sin(a), A = o * appear(t) * fl(t + k);
          P.set(it.id, { pts: starPts(sz * (0.75 + 0.35 * front), 5, 0.45, t * 3 + k, Math.cos(a) * rx, oy + Math.sin(a) * ry), fo: A * (0.55 + 0.45 * front), so: A * 0.6 * front });
        });
      }
    } else if (p.fx === "wisps") {
      // Дымка/тени: клубы медленно кружат и «дышат»
      const n = p.count || 4, o = op ?? 0.35, sp2 = p.speed ?? 25;
      for (let k = 0; k < n; k++) {
        const r0 = k * 360 / n + Math.random() * 30;
        const it = circle({ x: T.x, y: T.y, cx: T.r * (p.radius || 0.85), r: T.r * (p.size || 0.35), fill: k % 2 && p.color2 ? p.color2 : col, fo: 0, n: 16, rot: r0, attach: tok, layer: p.layer, z: z + items.length });
        items.push(it);
        fs.push((t, P) => P.set(it.id, { r: r0 + sp2 * t + 12 * Math.sin(t * 0.9 + k), s: 0.85 + 0.25 * Math.sin(t * 1.3 + k * 1.7),
          fo: o * appear(t) * (0.6 + 0.4 * Math.sin(t * 1.1 + k * 2.3)) * fl(t + k) }));
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
