// Движок анимаций: рисует локальные объекты на карте у каждого игрока
// (не синхронизируются по сети — поэтому анимация плавная и не нагружает комнату).
import OBR, { buildCurve, buildLine, buildImage, buildText } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { GLYPHS } from "./glyphs.js";

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
// Формы снарядов (кончик в (0,0), тело вдоль −x). L — длина в пикселях
const SHAPES = {
  arrow(L, o) {
    const w = L * 0.022, P = (...a) => { const r = []; for (let i = 0; i < a.length; i += 2) r.push({ x: a[i] * L, y: a[i + 1] * L }); return r; };
    return [
      { pts: P(-1, -0.075, -0.84, -0.022, -0.8, -0.022, -0.92, -0.085), fill: o.fletch || "#c0392b" },
      { pts: P(-1, 0.075, -0.84, 0.022, -0.8, 0.022, -0.92, 0.085), fill: o.fletch2 || o.fletch || "#e8e2d0" },
      { pts: [{ x: -L, y: -w / 2 }, { x: -L * 0.17, y: -w / 2 }, { x: -L * 0.17, y: w / 2 }, { x: -L, y: w / 2 }], fill: o.shaft || "#8b5a2b" },
      { pts: P(0, 0, -0.2, -0.06, -0.16, 0, -0.2, 0.06), fill: o.tip || "#d9dde3", stroke: "#4a4f57", sw: L * 0.008 },
    ];
  },
  spear(L, o) {
    const P = (...a) => { const r = []; for (let i = 0; i < a.length; i += 2) r.push({ x: a[i] * L, y: a[i + 1] * L }); return r; };
    return [
      { pts: P(0.05, 0, -0.35, -0.11, -1, -0.03, -1.05, 0, -1, 0.03, -0.35, 0.11), fill: o.color || "#b48cff", fo: 0.35 },
      { pts: P(0, 0, -0.3, -0.07, -0.95, -0.018, -0.95, 0.018, -0.3, 0.07), fill: o.core || "#ffffff", fo: 0.95, stroke: o.color || "#b48cff", sw: L * 0.01 },
      { pts: P(-0.05, 0, -0.3, -0.03, -0.7, 0, -0.3, 0.03), fill: o.color2 || o.color || "#b48cff", fo: 0.6 },
    ];
  },
};
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
// Одна буква (текстовый объект). Позиция текста — его л���вый верхний угол, поэтому центр считаем сами (place).
function glyph(o) {   // буква как векторная фигура (без текстовых элементов — они ненадёжны в Owlbear)
  const g = GLYPHS[o.ch] || GLYPHS["?"] || [], k = o.fs / 100, pts = [];
  for (let i = 0; i + 1 < g.length; i += 2) pts.push({ x: g[i] * k, y: g[i + 1] * k });
  return poly({ pts, x: o.x, y: o.y, fill: o.color || "#ffffff", fo: 0, so: 0, sw: 0, z: o.z, layer: o.layer });
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


// точки окружности со смещённым центром (для фигур, которые вращаются вокруг другой точки)
function ringPts(r, n, ox = 0, oy = 0) {
  const pts = [];
  for (let k = 0; k < n; k++) { const a = k / n * TAU; pts.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r }); }
  return pts;
}
// спираль Архимеда: turns витков, от центра до радиуса R, начальный угол a0
function spiralPts(R, turns, a0 = 0, ox = 0, oy = 0, n = 0) {
  const N = n || Math.max(16, Math.round(turns * 18)), pts = [];
  for (let i = 0; i <= N; i++) { const t = i / N, a = a0 + t * turns * TAU, r = R * t; pts.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r }); }
  return pts;
}

// Сеть/паутина: n радиальных нитей и m провисающих колец (точки относительно центра)
function webGeom(R, n, m, sag = 0.84, seed = 1) {
  const A = [];
  for (let k = 0; k < n; k++) A.push(k / n * TAU + (rnd(seed * 13 + k) - 0.5) * 0.35);
  const L = A.map((a, k) => R * (0.9 + rnd(seed * 7 + k) * 0.2));
  const spokes = A.map((a, k) => [{ x: Math.cos(a) * R * 0.05, y: Math.sin(a) * R * 0.05 }, { x: Math.cos(a) * L[k], y: Math.sin(a) * L[k] }]);
  const rings = [];
  for (let j = 1; j <= m; j++) {
    const f = j / (m + 0.3), pts = [];
    for (let k = 0; k < n; k++) {
      const a = A[k], b = k + 1 < n ? A[k + 1] : A[0] + TAU, rr = L[k] * f, rn = L[(k + 1) % n] * f, mid = (a + b) / 2, rm = (rr + rn) / 2 * sag;
      pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }, { x: Math.cos(mid) * rm, y: Math.sin(mid) * rm });
    }
    rings.push(pts);
  }
  const knots = A.map((a, k) => ({ x: Math.cos(a) * L[k], y: Math.sin(a) * L[k] }));
  return { spokes, rings, knots };
}

// ── эффекты применения (каждая функция возвращает «время попадания» в мс) ──
const FX = {
  projectile(A, B, o, delay) {
    const dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy) || 1;
    const dur = Math.max(180, dist / DPI / (o.speed || 14) * 1000);
    const r = (o.size || 0.3) * DPI / 2, n = o.trail ?? 6, col = o.color || "#ff7a1a", core = o.core || "#fff3c4";
    const arc = (o.arc || 0) * DPI, nx = -dy / dist, ny = dx / dist;
    const at = p => { const q = c01(p), h = Math.sin(Math.PI * q) * arc; return { x: A.x + dx * q + nx * h, y: A.y + dy * q + ny * h }; };
    const z = Date.now(), s = at(0), shp = o.shape ? SHAPES[o.shape] : null;
    const glowFo = o.glow ?? (shp ? 0 : 0.22), glowCols = o.glowColors || null;
    const glow = circle({ ...s, r: r * 2.2, fill: glowCols ? glowCols[0] : col, fo: glowFo, z: z + 1 });
    const head = shp ? null : circle({ ...s, r, fill: col, fo: 1, z: z + 2 });
    const hot = shp ? null : circle({ ...s, r: r * 0.5, fill: core, fo: 0.95, z: z + 3 });
    // фигура снаряда: кончик в position, тело вдоль −x; поворачивается по направлению полёта
    const L = (o.length || (o.size || 0.3) * 3) * DPI;
    const parts = shp ? shp(L, o).map((q, k) => poly({ pts: q.pts, x: s.x, y: s.y, fill: q.fill, fo: 0, stroke: q.stroke, so: 0, sw: q.sw, z: z + 4 + k })) : [];
    const partFo = shp ? shp(L, o).map(q => q.fo ?? 1) : [];
    // спиральные цветные ленты за снарядом (ribbons: [цвета])
    const rb = (o.ribbons || []).map((c, i) => ({ ph: i / (o.ribbons.length) * TAU,
      pts: Array.from({ length: o.ribbonLen || 7 }, (_, j) => circle({ ...s, r: DPI * (o.ribbonSize || 0.05) * (1 - j / ((o.ribbonLen || 7) + 1) * 0.6), fill: c, fo: 0, n: 10, z: z - 30 - i * 10 - j })) }));
    const stick = o.stick || 0;
    const trail = [];
    for (let k = 1; k <= n; k++) trail.push(circle({ ...s, r: r * (1 - k / (n + 1) * 0.7), fill: col, fo: 0.6 * (1 - k / (n + 1)), z: z - k }));
    // искры, которые снаряд роняет по пути (embers: сколько)
    const life = 520, em = [];
    for (let k = 0; k < (o.embers || 0); k++) {
      const a = Math.random() * TAU, d = DPI * (0.15 + Math.random() * 0.3);
      em.push({ it: circle({ ...s, r: DPI * (0.02 + Math.random() * 0.03), fill: k % 2 ? col : core, fo: 0, n: 8, z: z - 20 - k }),
        ti: 0.05 + Math.random() * 0.9, dx: Math.cos(a) * d, dy: Math.sin(a) * d - DPI * 0.15 });
    }
    const total = dur + Math.max(em.length ? life : 60, stick);
    const ang = t => { const a = at(Math.min(t, 0.999)), b = at(Math.min(t, 0.999) + 0.001); return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; };
    const endAng = ang(0.999);
    const items = [glow, ...(head ? [head, hot] : []), ...trail, ...em.map(e => e.it), ...rb.flatMap(x => x.pts), ...parts];
    spawn(delay, items, { dur: total, f: (p, P) => {
      const tm = p * total, t = tm / dur, c = at(t), pu = 1 + 0.15 * Math.sin(tm * 0.05);
      if (head) for (const it of [head, hot]) P.set(it.id, { x: c.x, y: c.y, fo: t > 1 ? 0 : undefined });
      P.set(glow.id, { x: c.x, y: c.y, s: pu, fo: t > 1 ? 0 : glowFo, fc: glowCols ? glowCols[Math.floor(tm / 90) % glowCols.length] : undefined });
      if (parts.length) {
        const after = tm - dur;   // после попадания: дрожит и гаснет (или сразу исчезает, если stick = 0)
        const fade = after < 0 ? Math.min(1, tm / 60) : stick ? c01((stick - after) / 350) : 0;
        const r0 = after < 0 ? ang(t) : endAng + Math.sin(after * 0.06) * 9 * Math.exp(-after / 160);
        parts.forEach((it, k) => P.set(it.id, { x: c.x, y: c.y, r: r0, fo: partFo[k] * fade, so: fade }));
      }
      for (const x of rb) x.pts.forEach((it, j) => {
        const tq = t - (j + 1) * 0.035; if (tq < 0 || tq > 1) { P.set(it.id, { fo: 0 }); return; }
        const c2 = at(tq), a = ang(tq) * Math.PI / 180, w = Math.sin(tq * 26 + x.ph + tm * 0.004) * DPI * (o.ribbonAmp || 0.16);
        P.set(it.id, { x: c2.x - Math.sin(a) * w, y: c2.y + Math.cos(a) * w, fo: 0.85 * (1 - j / x.pts.length) });
      });
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
  // «Тьма»: из точки разливается сфера магической тьмы — мягкий край из нескольких слоёв,
  // щупальца теней по краю, искорки света втягиваются внутрь и гаснут; держится hold мс и рассеивается
  gloom(c, o, delay) {
    const R = (o.radius || 3) * DPI, col = o.color || "#05030a", col2 = o.color2 || "#140b28", edge = o.edge || "#3b2466", glow = o.glow || "#8a5cff";
    const hold = o.hold ?? 5000, tIn = o.grow || 900, tOut = o.fade || 1500, dur = tIn + hold + tOut, z = Date.now() + 5, L = o.layer || "ATTACHMENT";
    const items = [];
    const disks = [[1.1, 0.14], [1.0, 0.22], [0.9, 0.3], [0.74, 0.36], [0.52, 0.4]].map(([k, a], i) => {
      const it = circle({ x: c.x, y: c.y, r: R * k, fill: i < 2 ? col2 : col, fo: 0, n: 48, s: 0.01, layer: L, z: z + i });
      items.push(it); return { it, a, ph: Math.random() * TAU };
    });
    const nt = o.tendrils ?? 10, tend = [];
    for (let k = 0; k < nt; k++) {
      const it = poly({ x: c.x, y: c.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: k % 2 ? col : col2, sw: DPI * (0.06 + Math.random() * 0.06), closed: false, tension: 0.5, layer: L, z: z + 6 });
      items.push(it);
      tend.push({ it, a0: k / nt * TAU + Math.random() * 0.4, len: R * (0.2 + Math.random() * 0.3), ph: Math.random() * TAU, sp: 0.6 + Math.random() * 0.7, dir: Math.random() < 0.5 ? -1 : 1 });
    }
    const rims = [0, 1].map(k => { const it = circle({ x: c.x, y: c.y, r: R * (1 - k * 0.07), fill: edge, stroke: k ? glow : edge, sw: DPI * (k ? 0.022 : 0.05), dash: k ? [DPI * 0.06, DPI * 0.22] : [DPI * 0.32, DPI * 0.16], n: 56, s: 0.01, layer: L, z: z + 10 + k }); items.push(it); return it; });
    const rush = circle({ x: c.x, y: c.y, r: R * 1.6, fill: glow, stroke: glow, sw: DPI * 0.04, n: 48, layer: L, z: z + 12 }); items.push(rush);
    const core = circle({ x: c.x, y: c.y, r: DPI * 0.4, fill: glow, fo: 0, n: 24, layer: L, z: z + 13 }); items.push(core);
    const nm = o.motes ?? 18, motes = [];
    for (let k = 0; k < nm; k++) {
      const it = circle({ x: c.x, y: c.y, r: DPI * (0.025 + Math.random() * 0.03), fill: k % 3 ? (o.mote || "#cbb8ff") : "#ffffff", fo: 0, n: 8, layer: L, z: z + 14 + k });
      items.push(it); motes.push({ it, a: Math.random() * TAU, per: 1.3 + Math.random() * 1.3, off: Math.random(), d: R * (1.1 + Math.random() * 0.5), sw: Math.random() < 0.5 ? -1 : 1 });
    }
    spawn(delay, items, { dur, f: (p, P) => {
      const tm = p * dur, sec = tm / 1000, g = Math.max(0.01, tm < tIn ? backOut(tm / tIn) : 1);
      const env = tm < tIn ? c01(tm / (tIn * 0.5)) : tm > tIn + hold ? Math.max(0, 1 - (tm - tIn - hold) / tOut) : 1;
      const spread = tm > tIn + hold ? 1 + 0.12 * (1 - env) : 1;   // рассеиваясь, чуть расплывается
      disks.forEach(d => P.set(d.it.id, { s: g * spread * (1 + 0.025 * Math.sin(sec * 1.3 + d.ph)), fo: d.a * env }));
      P.set(rims[0].id, { s: g * spread, r: sec * 7, so: 0.55 * env });
      P.set(rims[1].id, { s: g * spread, r: -sec * 13, so: 0.4 * env * (0.7 + 0.3 * Math.sin(sec * 2.1)) });
      const rq = c01(tm / tIn);
      P.set(rush.id, { s: 1 - 0.375 * out3(rq), so: rq < 1 ? 0.85 * Math.sin(Math.PI * rq) : 0 });
      const cq = c01(tm / 550);
      P.set(core.id, { s: 0.4 + 2.2 * cq, fo: cq < 1 ? 0.55 * Math.sin(Math.PI * cq) : 0 });
      for (const t of tend) {
        const pts = [], a = t.a0 + 0.18 * Math.sin(sec * t.sp * 0.7 + t.ph);
        for (let j = 0; j <= 6; j++) {
          const f = j / 6, rr = R * g * spread * 0.82 + t.len * f * (0.7 + 0.3 * Math.sin(sec * t.sp + t.ph)) * env;
          const aa = a + t.dir * f * f * 0.8 * Math.sin(sec * t.sp * 1.3 + t.ph + f * 2);
          pts.push({ x: Math.cos(aa) * rr, y: Math.sin(aa) * rr });
        }
        P.set(t.it.id, { pts, so: 0.8 * env * c01((tm - tIn * 0.4) / 400) });
      }
      for (const m of motes) {
        const q = (sec / m.per + m.off) % 1, d = m.d * (1 - q * q * 0.85), a = m.a + m.sw * q * 2.2 + Math.floor(sec / m.per + m.off) * 1.7;
        P.set(m.it.id, { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, fo: Math.sin(Math.PI * q) * env * c01((tm - 300) / 400) * 0.9 });
      }
    } });
    return 0;
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
        P.set(m.it.id, { x, y, fo });
      }
    } });
    return 0;
  },
  // «Буквы имени»: буквы вырываются из цели, складываются в слово над ней, дрожат и по одной
  // улетают по спирали к заклинателю (A — цель, B — заклинатель). Возвращает время прилёта последней буквы.
  letters(A, B, o, delay) {
    const word = [...String(o.text || A.name || "ИМЯ").toUpperCase()].map(ch => ch === "Й" ? "И" : ch).filter(ch => GLYPHS[ch]).slice(0, o.max || 10);
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
      const sh = glyph({ ch, fs, x: A.x, y: A.y, color: o.stroke || "#1d1038", z: z + k * 10 + 4 });
      for (let j = 1; j <= ghosts; j++) gh.push(mk(0, z + k * 10 + 5 - j));
      return { ch, k, sx, sy, bend, spin, ph, g, main, sh, gh };
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
    for (const l of L) items.push(l.g, ...l.gh, l.sh, l.main);
    spawn(delay, items, { dur: total + 40, f: (p, P) => {
      const tm = p * (total + 40);
      for (const l of L) {
        const c = at(l, tm), op = c.done ? 0 : c.o;
        P.set(l.main.id, { x: c.x, y: c.y, s: c.s, r: c.r, fo: op });
        P.set(l.sh.id, { x: c.x + fs * 0.05, y: c.y + fs * 0.06, s: c.s * 1.04, r: c.r, fo: op * 0.85 });
        P.set(l.g.id, { x: c.x, y: c.y, s: c.s * (1.1 + 0.15 * Math.sin(tm * 0.02 + l.ph)), fo: op * (c.fly ? 0.35 : 0.22) });
        l.gh.forEach((g, j) => {
          const c2 = at(l, tm - (j + 1) * 55), go = c.fly ? c2.o * 0.4 / (j + 1) : 0;
          P.set(g.id, { x: c2.x, y: c2.y, s: c2.s, r: c2.r, fo: go });
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
  // «Шов Порога»: от A к B прорезается шов голубого света — ядро, свечение, трещащая молния, поперечные «стежки».
  // По ОБЕ стороны шва прорастают ветвящиеся вены («рыбья кость», чуть отклонены назад, к точке старта),
  // по ним волнами бегут импульсы света от начала шва к концу; на концах вен вспыхивают узелки.
  // По шву бегут светлые «бусины», с линии поднимаются искры; держится и медленно гаснет.
  // Опции: width, jag, grow, duration, veins (плотность вен на клетку), veinLen (клетки), veinWidth, pulse (Гц), color, core, crackle
  seam(A, B, o, delay) {
    const dur = o.duration || 3200, grow = o.grow || 320, w = (o.width || 0.08) * DPI, col = o.color || "#38c8ff", core = o.core || "#e8fbff", hi = o.crackle || "#9eeaff";
    const dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy) || 1, nx = -dy / dist, ny = dx / dist, ux = dx / dist, uy = dy / dist;
    const n = Math.max(8, Math.round(dist / DPI * 3)), amp = (o.jag ?? 0.13) * DPI, sp = o.pulse ?? 1.1;
    let z = Date.now() + 40;
    const path = (g, seed, a) => {
      const pts = [];
      for (let k = 0; k <= n; k++) {
        const q = k / n * g, env = Math.sin(Math.PI * k / n);
        const off = k === 0 || k === n ? 0 : (rnd(seed * 17 + k) * 2 - 1) * a * env;
        pts.push({ x: q * dx + nx * off, y: q * dy + ny * off });
      }
      return pts;
    };
    // часть ломаной (0..1) — вены «прорастают» постепенно
    const part = (pts, f) => {
      const m = pts.length - 1, t = c01(f) * m, i = Math.min(m - 1, Math.floor(t)), u = t - i, a = pts[i], b = pts[i + 1];
      return [...pts.slice(0, i + 1), { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }];
    };
    const p0 = path(0.01, 0, 0);

    // ── вены по обе стороны шва (рисуются под швом) ──
    const VC = Math.min(12, Math.max(3, Math.round(dist / DPI * (o.veins ?? 1.6)))), VL = (o.veinLen ?? 0.6) * DPI, vw = DPI * (o.veinWidth ?? 0.026);
    const V = [], nodes = [];
    const branch = (sx, sy, ang, len, depth, q, j) => {
      const pts = [{ x: sx, y: sy }], m = 6; let cx = sx, cy = sy, a = ang;
      for (let k = 1; k <= m; k++) { a += (Math.random() - 0.5) * 0.8; cx += Math.cos(a) * len / m; cy += Math.sin(a) * len / m; pts.push({ x: cx, y: cy }); }
      const g = poly({ x: A.x, y: A.y, pts, stroke: col, sw: vw * (3.4 - depth * 1.2), closed: false, tension: 0.4, z: z++ });
      const c = poly({ x: A.x, y: A.y, pts, stroke: core, sw: vw * (1.1 - depth * 0.35), closed: false, tension: 0.4, z: z++ });
      const v = { g, c, pts, q, d: depth, j, t0: null, f: 0, pl: 0 };
      V.push(v);
      if (depth === 0) {
        nodes.push({ v, it: circle({ x: A.x + cx, y: A.y + cy, r: vw * 2.3, fill: core, n: 10, z: z + 200 }) });
        const b = pts[2 + Math.floor(Math.random() * 3)];
        branch(b.x, b.y, a + (Math.random() < 0.5 ? -1 : 1) * (0.55 + Math.random() * 0.45), len * (0.45 + Math.random() * 0.2), 1, q, j + 0.12);
        if (Math.random() < 0.45) {   // иногда — вторая веточка в другую сторону
          const b2 = pts[3 + Math.floor(Math.random() * 2)];
          branch(b2.x, b2.y, a + (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.4), len * 0.35, 1, q, j + 0.18);
        }
      }
    };
    for (let i = 0; i < VC; i++) {
      for (const sd of [1, -1]) {
        const q = c01((i + 0.5 + sd * 0.22 + (Math.random() - 0.5) * 0.3) / VC);
        const t = 0.3 + Math.random() * 0.35, vx = sd * nx * Math.cos(t) - ux * Math.sin(t), vy = sd * ny * Math.cos(t) - uy * Math.sin(t);
        const len = VL * (0.5 + 0.5 * Math.sin(Math.PI * q)) * (0.75 + Math.random() * 0.5);
        const off = sd * w * 0.6;   // стартуют от края свечения, а не из самой оси
        branch(dx * q + nx * off, dy * q + ny * off, Math.atan2(vy, vx), len, 0, q, q * 1.3);
      }
    }

    // ── сам шов ──
    z += 210;
    const L = [[w * 7, col, 0.12], [w * 3, col, 0.5], [w * 1.1, core, 1]].map(([sw, c, a]) =>
      ({ a, it: poly({ x: A.x, y: A.y, pts: p0, stroke: c, sw, closed: false, z: z++ }) }));
    const cr = poly({ x: A.x, y: A.y, pts: p0, stroke: hi, sw: w * 0.5, closed: false, z: z++ });
    const cr2 = poly({ x: A.x, y: A.y, pts: p0, stroke: core, sw: w * 0.3, closed: false, z: z++ });
    const ns = Math.max(3, Math.round(dist / DPI * 1.6)), st = [];
    for (let k = 1; k < ns; k++) {
      const q = k / ns, h = DPI * (o.stitch ?? 0.22) * (k % 2 ? 1 : 0.7), cx = dx * q, cy = dy * q;
      st.push({ q, it: poly({ x: A.x, y: A.y, pts: [{ x: cx - nx * h - ux * h * 0.35, y: cy - ny * h - uy * h * 0.35 }, { x: cx + nx * h + ux * h * 0.35, y: cy + ny * h + uy * h * 0.35 }],
        stroke: core, sw: w * 0.55, closed: false, z: z++ }) });
    }
    // бусины света, бегущие по шву от начала к концу
    const beads = [0, 1, 2].map(b => ({ b, it: circle({ x: A.x, y: A.y, r: w * 1.3, fill: core, n: 12, z: z++ }), h: circle({ x: A.x, y: A.y, r: w * 3.2, fill: col, n: 16, z: z++ }) }));
    const nm = Math.min(34, Math.round(dist / DPI * 4)), motes = [];
    for (let k = 0; k < nm; k++) {
      const q = Math.random(), sd = Math.random() < 0.5 ? -1 : 1;
      motes.push({ q, ph: Math.random(), sx: sd * DPI * (0.1 + Math.random() * 0.3), h: DPI * (0.3 + Math.random() * 0.6),
        it: circle({ x: A.x + dx * q, y: A.y + dy * q, r: DPI * (0.025 + Math.random() * 0.03), fill: k % 3 ? col : core, n: 8, z: z++ }) });
    }
    const flashA = circle({ x: A.x, y: A.y, r: DPI * 0.45, fill: core, n: 20, z: z++ });
    const flash = circle({ x: B.x, y: B.y, r: DPI * 0.6, fill: core, n: 24, z: z++ });
    const ringB = circle({ x: B.x, y: B.y, r: DPI * 0.5, fill: col, stroke: col, sw: w * 0.6, n: 32, z: z++ });

    const all = [...V.flatMap(v => [v.g, v.c]), ...nodes.map(d => d.it), ...L.map(l => l.it), cr, cr2, ...st.map(s => s.it),
      ...beads.flatMap(b => [b.h, b.it]), ...motes.map(m => m.it), flashA, flash, ringB];
    const fadeMs = Math.min(1000, dur * 0.35);
    spawn(delay, all, { dur, f: (p, P) => {
      const tm = p * dur, g = Math.max(0.01, out3(tm / grow)), env = c01(tm > dur - fadeMs ? (dur - tm) / fadeMs : 1);
      const beat = Math.pow(0.5 + 0.5 * Math.sin(tm / 1000 * sp * TAU), 3), pulse = 0.75 + 0.25 * beat, seed = Math.floor(tm / 70), bp = path(g, 0, 0);
      L.forEach((l, i) => P.set(l.it.id, { pts: bp, so: l.a * env * (i === 0 ? 0.7 + 0.6 * beat : pulse) }));
      P.set(cr.id, { pts: path(g, seed + 1, amp), so: 0.8 * env * (0.4 + 0.6 * rnd(seed + 3)) });
      P.set(cr2.id, { pts: path(g, seed + 5, amp * 0.7), so: 0.55 * env * rnd(seed + 9) });
      for (const s of st) P.set(s.it.id, { so: c01((g - s.q) * 8) * env * (0.6 + 0.4 * Math.sin(tm * 0.008 + s.q * 9)) });
      // вены: прорастают, когда шов доходит до их основания, потом пульсируют волной вдоль шва
      for (const v of V) {
        if (v.t0 == null && g >= v.q) v.t0 = tm + v.d * 150;
        v.f = v.t0 == null ? 0 : c01((tm - v.t0) / 340);
        if (v.f <= 0) { P.set(v.g.id, { so: 0 }); P.set(v.c.id, { so: 0 }); continue; }
        v.pl = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin((tm / 1000 * sp - v.j - v.d * 0.15) * TAU), 4);
        const pts = part(v.pts, out3(v.f)), k = 1 - v.d * 0.25, flare = 1 + 0.6 * (1 - v.f);   // при прорастании ярче
        P.set(v.g.id, { pts, so: env * (0.16 + 0.34 * v.pl) * k * flare });
        P.set(v.c.id, { pts, so: c01(env * (0.35 + 0.65 * v.pl) * k * flare) });
      }
      for (const d of nodes) {
        const on = d.v.f >= 1 ? 1 : 0;
        P.set(d.it.id, { s: 0.5 + 0.9 * d.v.pl, fo: on * env * 0.9 * d.v.pl * d.v.pl });
      }
      for (const b of beads) {
        const q = ((tm - grow) / 1000 * 0.8 + b.b / 3) % 1, a = tm > grow ? env * Math.sin(Math.PI * q) : 0;
        const x = A.x + dx * q, y = A.y + dy * q;
        P.set(b.it.id, { x, y, fo: a * 0.95 }); P.set(b.h.id, { x, y, fo: a * 0.25 });
      }
      for (const m of motes) {
        const k = (tm / 1000 / 1.4 + m.ph) % 1;
        P.set(m.it.id, { x: A.x + dx * m.q + m.sx * k, y: A.y + dy * m.q - m.h * k, fo: (g >= m.q ? 1 : 0) * env * Math.sin(Math.PI * k) * 0.9 });
      }
      const fa = c01(tm / 300);
      P.set(flashA.id, { s: 0.4 + 1 * out3(fa), fo: fa < 1 ? 0.55 * (1 - fa) : 0 });
      const fq = c01((tm - grow * 0.8) / 400), rq = c01((tm - grow * 0.8) / 700);
      P.set(flash.id, { s: 0.3 + 1.2 * out3(fq), fo: fq > 0 && fq < 1 ? 0.6 * (1 - fq) : 0 });
      P.set(ringB.id, { s: 0.4 + 2.2 * out3(rq), so: rq > 0 && rq < 1 ? 0.8 * (1 - rq) : 0, fo: rq > 0 && rq < 1 ? 0.1 * (1 - rq) : 0 });
    } });
    return o.hitAt ?? grow;
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

  // «Часы на цепочке»: рядом с целью из воздуха возникают иллюзорные карманные часы, качаются как маятник,
  // на циферблате крутится гипнотическая спираль, от часов расходятся волны. Возвращает момент «захвата» (hitAt).
  // Опции: size (радиус корпуса, клетки), length (цепочка), swing (амплитуда, °), period (мс), side (1 справа / −1 слева),
  // color (золото), edge (обводка), face (циферблат), hands (стрелки), glow (цвет гипноза), glitch: true — иллюзия рассыпается.
  watch(c, o, delay) {
    const dur = o.duration || 2800, r = c.r || DPI / 2, sd = o.side ?? 1;
    const px = c.x + sd * r * (o.dx ?? 1.65), py = c.y - r * (o.dy ?? 1.5);
    const L = (o.length || 0.7) * DPI, R = (o.size || 0.2) * DPI, cy = L + R * 1.55;
    const gold = o.color || "#e8c15a", dark = o.edge || "#6b4a12", face = o.face || "#fff6dc", hc = o.hands || "#2b1d0a", gl = o.glow || "#c084fc";
    const amp = o.swing ?? 28, per = o.period || 1100, w = DPI * 0.018, L0 = o.layer || "ATTACHMENT";
    let z = Date.now() + 40;
    const mk = (pts, st) => poly({ x: px, y: py, pts, layer: L0, z: z++, ...st });
    const halo = mk(ringPts(R * 2, 32, 0, cy), { fill: gl });
    const waves = [0, 1, 2].map(() => mk(ringPts(R, 32, 0, cy), { stroke: gl, fill: gl, sw: DPI * 0.03 }));
    const chain = mk([{ x: 0, y: 0 }, { x: 0, y: L + R * 0.2 }], { stroke: gold, sw: DPI * 0.028, dash: [DPI * 0.045, DPI * 0.03], closed: false });
    const chain2 = mk([{ x: 0, y: 0 }, { x: 0, y: L + R * 0.2 }], { stroke: "#fff3c4", sw: DPI * 0.01, dash: [DPI * 0.02, DPI * 0.055], closed: false });
    const pin = mk(ringPts(DPI * 0.045, 12), { stroke: gold, fill: gl, sw: w });
    const bow = mk(ringPts(R * 0.22, 14, 0, L + R * 0.2), { stroke: gold, sw: DPI * 0.03 });
    const crown = mk([{ x: -R * 0.16, y: L + R * 0.38 }, { x: R * 0.16, y: L + R * 0.38 }, { x: R * 0.2, y: L + R * 0.62 }, { x: -R * 0.2, y: L + R * 0.62 }], { fill: gold, stroke: dark, sw: w * 0.7 });
    const caseO = mk(ringPts(R, 36, 0, cy), { fill: gold, stroke: dark, sw: w * 1.3 });
    const bezel = mk(ringPts(R * 0.88, 36, 0, cy), { fill: "#b8862b", stroke: "#fff3c4", sw: w * 0.6 });
    const dial = mk(ringPts(R * 0.78, 36, 0, cy), { fill: face, stroke: dark, sw: w * 0.5 });
    const spir = mk(spiralPts(R * 0.66, 2.6, 0, 0, cy), { stroke: gl, sw: w * 0.9, closed: false, tension: 0.4 });
    const ticks = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, big = i % 3 === 0, rr = R * 0.66;
      ticks.push(mk(ringPts(R * (big ? 0.065 : 0.035), 8, Math.sin(a) * rr, cy - Math.cos(a) * rr), { fill: big ? dark : "#8a6a2a" }));
    }
    const hand = (len) => mk([{ x: 0, y: cy }, { x: 0, y: cy - len }], { stroke: hc, sw: w * 1.1, closed: false });
    const hH = hand(R * 0.38), hM = hand(R * 0.58);
    const hub = mk(ringPts(R * 0.07, 10, 0, cy), { fill: hc });
    const glint = mk(starPts(R * 0.42, 4, 0.22, 0, -R * 0.45, cy - R * 0.45), { fill: "#ffffff" });
    const body = [chain, chain2, pin, bow, crown, caseO, bezel, dial, ...ticks, hH, hM, hub];
    const all = [halo, ...waves, ...body, spir, glint];
    const hit = o.hitAt ?? 1400;
    spawn(delay, all, { dur, f: (p, P) => {
      const tm = p * dur, ap = c01(tm / 450), out = o.glitch ? c01((p - 0.55) / 0.45) : c01((p - 0.8) / 0.2);
      const ill = 0.88 + 0.12 * Math.sin(tm * 0.031) * Math.sin(tm * 0.013);   // лёгкое «дрожание» иллюзии
      let A = ap * (1 - out) * ill;
      if (o.glitch && out > 0) A *= (rnd(Math.floor(tm / 45)) > out * 0.8 ? 1 : 0.15);   // иллюзия «рвётся»
      const th = amp * Math.min(1, tm / 600) * Math.sin(tm / per * TAU), s = Math.max(0.01, 0.35 + 0.65 * backOut(ap)) * (o.glitch ? 1 - 0.25 * out : 1), rot = -th;
      for (const it of body) P.set(it.id, { s, r: rot, so: A, fo: A });
      P.set(chain2.id, { s, r: rot, so: A * 0.7 });
      P.set(bow.id, { s, r: rot, so: A, fo: 0 });
      P.set(pin.id, { s, r: rot, so: A, fo: A * 0.6 });
      P.set(halo.id, { s, r: rot, fo: A * (0.16 + 0.1 * Math.sin(tm * 0.008)) });
      const sa = tm * 0.006;
      P.set(spir.id, { s, r: rot, so: A * 0.75, pts: spiralPts(R * 0.66, 2.6, sa, 0, cy) });
      const am = tm * 0.012, ah = tm * 0.003;   // стрелки бегут с неестественной скоростью
      P.set(hM.id, { s, r: rot, so: A, pts: [{ x: 0, y: cy }, { x: Math.sin(am) * R * 0.58, y: cy - Math.cos(am) * R * 0.58 }] });
      P.set(hH.id, { s, r: rot, so: A, pts: [{ x: 0, y: cy }, { x: Math.sin(ah) * R * 0.38, y: cy - Math.cos(ah) * R * 0.38 }] });
      const g = Math.pow(Math.max(0, Math.abs(Math.sin(tm / per * TAU)) - 0.7) / 0.3, 2);   // блик в крайних точках качания
      P.set(glint.id, { s, r: rot, fo: A * g, pts: starPts(R * (0.3 + 0.25 * g), 4, 0.22, tm * 0.002, -R * 0.45, cy - R * 0.45) });
      waves.forEach((it, k) => {
        const wp = ((tm - 300 - k * per / 3) / per) % 1, on = tm > 300 + k * per / 3;
        P.set(it.id, on ? { s, r: rot, pts: ringPts(R * (1 + 2.6 * out3(wp)), 32, 0, cy), so: A * 0.7 * (1 - wp), fo: A * 0.06 * (1 - wp) } : { so: 0, fo: 0 });
      });
    } });
    return hit;
  },
  // «Гипнотическая спираль»: огромная двойная спираль вращается вокруг цели и стягивается в неё
  spiral(c, o, delay) {
    const dur = o.duration || 1300, R = (o.radius || 1.3) * DPI, col = o.color || "#c084fc", col2 = o.color2 || "#f0abfc", z = Date.now() + 25;
    const arms = [0, 1].map(k => poly({ x: c.x, y: c.y, pts: spiralPts(R, o.turns || 2.5, k * Math.PI), stroke: k ? col2 : col, sw: DPI * (o.width || 0.05), closed: false, tension: 0.4, layer: o.layer, z: z + k }));
    const core = circle({ x: c.x, y: c.y, r: R * 0.35, fill: col2, fo: 0, n: 24, layer: o.layer, z: z - 1 });
    spawn(delay, [core, ...arms], { dur, f: (p, P) => {
      const s = Math.max(0.02, 1.15 - 0.95 * p * p), A = Math.sin(Math.PI * Math.min(1, p * 1.15));
      arms.forEach(it => P.set(it.id, { s, r: (o.spin ?? 540) * p, so: A * (o.opacity ?? 0.9) }));
      P.set(core.id, { s: 0.4 + 0.8 * p, fo: 0.35 * Math.sin(Math.PI * p) });
    } });
    return 0;
  },
  // «Конус» (дыхание дракона): стихия вырывается из токена A в сторону точки B клином 15 фт.
  // length — длина в клетках, angle — раствор в градусах (D&D-конус ≈ 53°), bolts — молнии внутри.
  // Возвращает момент, когда фронт доходит до целей.
  cone(A, B, o, delay) {
    const L = (o.length || 3) * DPI, half = (o.angle ?? 53) / 2 * Math.PI / 180, dur = o.duration || 1600;
    const ang = Math.atan2(B.y - A.y, B.x - A.x) || 0, r0 = (A.r || DPI / 2) * 0.6;
    const ox = A.x + Math.cos(ang) * r0, oy = A.y + Math.sin(ang) * r0;
    const col = o.color || "#ff5a10", col2 = o.color2 || "#ffb347", core = o.core || "#fff1b0", z = Date.now() + 20;
    const wedge = len => { const pts = [{ x: 0, y: 0 }]; for (let k = 0; k <= 14; k++) { const a = ang - half + 2 * half * k / 14; pts.push({ x: Math.cos(a) * len, y: Math.sin(a) * len }); } return pts; };
    const outer = poly({ x: ox, y: oy, pts: wedge(L * 0.02), fill: col, fo: 0, stroke: col2, so: 0, sw: DPI * 0.04, tension: 0.15, z });
    const inner = poly({ x: ox, y: oy, pts: wedge(L * 0.01), fill: col2, fo: 0, tension: 0.15, z: z + 1 });
    const cols = [col, col2, core], ps = [], n = o.count || 40;
    for (let k = 0; k < n; k++) {
      const a = ang + (Math.random() * 2 - 1) * half * 0.92;
      ps.push({ it: circle({ x: ox, y: oy, r: DPI * (o.size || 0.22) * (0.5 + Math.random() * 0.7), fill: cols[k % 3], fo: 0, n: 14, s: 0.3, z: z + 2 + k }),
        a, d1: L * (0.55 + Math.random() * 0.5), q0: Math.random() * 0.5, w: DPI * 0.12 * Math.random(), ph: Math.random() * TAU, g: 1 + Math.random() * 1.3 });
    }
    spawn(delay, [outer, inner, ...ps.map(p => p.it)], { dur, f: (p, P) => {
      const f = out3(c01(p / 0.4)), env = p < 0.15 ? p / 0.15 : p > 0.6 ? Math.max(0, (1 - p) / 0.4) : 1;
      P.set(outer.id, { pts: wedge(Math.max(2, L * f)), fo: 0.32 * env, so: 0.75 * env });
      P.set(inner.id, { pts: wedge(Math.max(1, L * f * 0.62)), fo: 0.4 * env * (0.8 + 0.2 * Math.sin(p * 40)) });
      for (const s of ps) {
        const lp = c01((p - s.q0) / 0.5), d = s.d1 * out3(lp), wob = Math.sin(lp * 8 + s.ph) * s.w;
        P.set(s.it.id, { x: ox + Math.cos(s.a) * d - Math.sin(s.a) * wob, y: oy + Math.sin(s.a) * d + Math.cos(s.a) * wob,
          s: 0.3 + s.g * lp, fo: Math.sin(Math.PI * lp) * 0.9 });
      }
    } });
    for (let k = 0; k < (o.bolts || 0); k++) {
      const a = ang + (Math.random() * 2 - 1) * half * 0.8, d = L * (0.6 + Math.random() * 0.4);
      FX.bolt({ x: ox, y: oy }, { x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d },
        { color: o.boltColor || col2, core: "#ffffff", width: 0.04, jag: 0.3, duration: 360, grow: 0.12 }, delay + 120 + k * 150);
    }
    return o.hitAt ?? dur * 0.3;
  },
  // Нити тьмы: из «пальцев» заклинателя (A) веером вылетают извивающиеся нити, долетают до цели (B),
  // обвиваются вокруг неё и натягиваются. count — число нитей, speed — клеток/с, wrap — витков обмотки,
  // wrapTime — мс обмотки, hold — мс натянутыми, fade — мс исчезновения, amp — размах изгибов (клетки),
  // retract: true — в конце нити втягиваются обратно в руку (иначе отрываются от руки и тают на цели)
  threads(A, B, o, delay) {
    const n = o.count || 5, col = o.color || "#7c3aed", dark = o.dark || "#07030f", core = o.core || "#c4b5fd";
    const dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist, px = -uy, py = ux;
    const rA = A.r || DPI / 2, rB = B.r || DPI / 2, Rw = rB * (o.radius || 1.05), W = o.wrap ?? 0.9;
    const fd = Math.max(220, dist / DPI / (o.speed || 10) * 1000), wd = o.wrapTime || 450, hold = o.hold ?? 400, fade = o.fade || 500;
    const lagK = o.lag ?? 35, total = fd + wd + hold + fade + lagK * n, back = Math.atan2(-uy, -ux), amp = (o.amp ?? 0.16) * DPI, M = o.points || 26;
    const z = Date.now() + 35, S = [];
    for (let k = 0; k < n; k++) {
      const off = n > 1 ? k / (n - 1) - 0.5 : 0, sx = A.x + ux * rA * 0.75 + px * off * rA * 0.7, sy = A.y + uy * rA * 0.75 + py * off * rA * 0.7;
      const a0 = back + off * 1.7 + (rnd(k * 2.3 + 0.7) - 0.5) * 0.3, p0 = [{ x: sx, y: sy }, { x: sx, y: sy }];
      const mk = (stroke, sw, zz) => poly({ x: 0, y: 0, pts: p0, stroke, sw, closed: false, tension: 0.5, z: z + zz });
      S.push({ sx, sy, ex: B.x + Math.cos(a0) * Rw, ey: B.y + Math.sin(a0) * Rw, a0, sg: k % 2 ? 1 : -1,
        bulge: (rnd(k * 3.7 + 1) - 0.5) * 0.5 + off * 0.8, ph: rnd(k * 9.1) * TAU, fr: 1.2 + rnd(k * 5.3) * 1.3, lag: k * lagK,
        L: [mk(col, DPI * 0.08, 0), mk(dark, DPI * 0.032, 10), mk(core, DPI * 0.009, 20)],
        head: circle({ x: sx, y: sy, r: DPI * 0.045, fill: core, fo: 0, n: 10, z: z + 30 }) });
    }
    const at = (s, u, tm, tt) => {
      if (u <= 1) {
        const env = Math.sin(Math.PI * u), wv = Math.sin(u * s.fr * TAU - tm * 0.012 + s.ph) * amp * (1 - tt);
        const off = (s.bulge * dist * 0.12 * (1 - 0.6 * tt) + wv) * env;
        return { x: s.sx + (s.ex - s.sx) * u + px * off, y: s.sy + (s.ey - s.sy) * u + py * off };
      }
      const v = Math.min(u - 1, W), a = s.a0 + s.sg * v * TAU, r = Rw * (1 - 0.18 * v / Math.max(W, 0.01));
      return { x: B.x + Math.cos(a) * r, y: B.y + Math.sin(a) * r };
    };
    const ops = [0.3, 0.95, 0.75];
    spawn(delay, S.flatMap(s => [...s.L, s.head]), { dur: total, f: (p, P) => {
      const tm = p * total;
      for (const s of S) {
        const tl = tm - s.lag;
        if (tl <= 0) continue;
        const tt = c01((tl - fd) / wd), fp = c01((tl - fd - wd - hold) / fade);
        let hu = tl < fd ? 1 - Math.pow(1 - tl / fd, 1.6) : 1 + W * out3(tt), u0 = 0, A1;
        if (o.retract) { hu *= 1 - out3(fp); A1 = 1 - c01((fp - 0.75) / 0.25); }
        else { u0 = out3(fp) * (1 + W * 0.6); A1 = 1 - fp * fp; }
        if (hu - u0 < 0.002) { s.L.forEach(it => P.set(it.id, { so: 0 })); P.set(s.head.id, { fo: 0 }); continue; }
        const pts = [];
        for (let i = 0; i < M; i++) pts.push(at(s, u0 + (hu - u0) * i / (M - 1), tm, tt));
        const A0 = c01(tl / 80) * A1, sh = 0.8 + 0.2 * Math.sin(tm * 0.02 + s.ph);
        s.L.forEach((it, k) => P.set(it.id, { pts, so: ops[k] * A0 * (k === 2 ? sh : 1) }));
        const h = pts[pts.length - 1];
        P.set(s.head.id, { x: h.x, y: h.y, fo: (tl < fd + wd ? 0.9 : o.retract ? 0.9 * A1 : 0) * A0 });
      }
    } });
    return o.hitAt ?? fd + lagK * (n - 1) * 0.5 + wd * 0.6;
  },
  // Сеть теней: нити раскрываются над точкой с закруткой, рывком затягиваются и гаснут.
  // radius — в клетках (для токена масштабируется по его размеру), spokes — радиальные нити, rings — кольца,
  // unfold — мс раскрытия, twist — закрутка (°), hold — доля времени до угасания
  web(c, o, delay) {
    const k0 = (c.r || DPI / 2) / (DPI / 2), R = (o.radius || 0.65) * DPI * k0, n = o.spokes || 8, m = o.rings || 4;
    const dur = o.duration || 1600, hold = o.hold ?? 0.75, u = o.unfold || 420, tw = o.twist ?? -140;
    const col = o.color || "#7c3aed", core = o.core || "#e9ddff", z = Date.now() + 40, G = webGeom(R, n, m, o.sag ?? 0.84, Math.random() * 100);
    const W = [], add = (it, kind, ex = {}) => { W.push({ it, kind, ...ex }); return it; };
    add(circle({ x: c.x, y: c.y, r: R * 1.05, fill: o.shade || "#07030f", fo: 0, n: 32, s: 0.2, layer: "MOUNT", z }), "shade");
    G.spokes.forEach((pts, k) => add(poly({ x: c.x, y: c.y, pts, stroke: col, sw: DPI * 0.07, closed: false, s: 0.15, z: z + 1 }), "g", { j: -1, k }));
    G.rings.forEach((pts, j) => add(poly({ x: c.x, y: c.y, pts, stroke: col, sw: DPI * 0.06, tension: 0.35, s: 0.15, z: z + 2 }), "g", { j }));
    G.spokes.forEach((pts, k) => add(poly({ x: c.x, y: c.y, pts, stroke: core, sw: DPI * 0.02, closed: false, s: 0.15, z: z + 3 }), "t", { j: -1, k }));
    G.rings.forEach((pts, j) => add(poly({ x: c.x, y: c.y, pts, stroke: core, sw: DPI * 0.018, tension: 0.35, s: 0.15, z: z + 4 }), "t", { j }));
    G.knots.forEach((q, k) => add(poly({ x: c.x, y: c.y, pts: ringPts(DPI * 0.035, 8, q.x, q.y), fill: col, stroke: core, sw: DPI * 0.012, s: 0.15, z: z + 5 }), "k", { k }));
    spawn(delay, W.map(q => q.it), { dur, f: (p, P) => {
      const tm = p * dur, q = c01(tm / u), cq = c01((tm - u) / 260);
      const s = Math.max(0.05, (0.15 + 0.85 * backOut(q)) * (1 - 0.06 * out3(cq) - 0.1 * Math.sin(Math.PI * cq)));
      const r = tw * (1 - out3(q)), env = p > hold ? Math.max(0, 1 - (p - hold) / (1 - hold)) : 1, snap = 1 + 0.8 * Math.sin(Math.PI * cq);
      for (const w of W) {
        if (w.kind === "shade") { P.set(w.it.id, { s, fo: (o.fill ?? 0.35) * c01(q * 2) * env }); continue; }
        const ap = w.kind === "k" || w.j < 0 ? c01(q * 3) : c01((tm - 60 - w.j * 55) / 140);
        const sh = 0.75 + 0.25 * Math.sin(tm * 0.018 - (w.j >= 0 ? w.j * 1.3 : (w.k || 0)));
        if (w.kind === "g") P.set(w.it.id, { s, r, so: 0.35 * ap * env * snap });
        else if (w.kind === "t") P.set(w.it.id, { s, r, so: 0.95 * ap * env * sh });
        else P.set(w.it.id, { s, r, fo: ap * env * sh, so: ap * env });
      }
    } });
    return o.hitAt ?? u;
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

// примитивы для прицела (aim.js)
export const prim = { circle, poly, dpi: () => DPI };

// Короткая надпись над токеном (видна только тому, кто нажал): «ЗАКЛИНАТЕЛЬ», «ЦЕЛЬ»…
export async function label(ids, text, o = {}) {
  await grid();
  const info = await tokens(ids);
  const word = [...String(text).toUpperCase()].map(ch => ch === "Й" ? "И" : ch).filter(ch => GLYPHS[ch] || ch === " ");
  const fs = Math.round((o.size || 0.28) * DPI), gap = fs * 0.74, col = o.color || "#f3d58a", dark = o.stroke || "#1d1038";
  const dur = o.duration || 1400, z = Date.now() + 500;
  for (const id of ids) {
    const T = info[id]; if (!T) continue;
    const by = T.y - (T.r || DPI / 2) - fs * 0.75, n = word.length, L = [];
    word.forEach((ch, k) => {
      if (ch === " ") return;
      const x = T.x + (k - (n - 1) / 2) * gap;
      L.push({ k, x, sh: glyph({ ch, fs, x, y: by, color: dark, z: z + k * 2 }), g: glyph({ ch, fs, x, y: by, color: col, z: z + k * 2 + 1 }) });
    });
    const ring = circle({ x: T.x, y: T.y, r: (T.r || DPI / 2) * 1.05, fill: col, stroke: col, sw: DPI * 0.04, n: 36, s: 0.8, z: z - 1 });
    spawn(0, [ring, ...L.flatMap(l => [l.sh, l.g])], { dur, f: (p, P) => {
      const tm = p * dur;
      P.set(ring.id, { s: 0.8 + 0.35 * out3(p), so: 0.9 * (1 - p) });
      for (const l of L) {
        const q = c01((tm - l.k * 25) / 220), e = 1 + 0.25 * Math.sin(Math.PI * q) * (1 - q);
        const fo = p > 0.7 ? (1 - p) / 0.3 : q, y = by - (1 - out3(q)) * fs * 0.6 - p * fs * 0.4;
        P.set(l.g.id, { x: l.x, y, s: e, fo });
        P.set(l.sh.id, { x: l.x + fs * 0.05, y: y + fs * 0.06, s: e * 1.04, fo: fo * 0.85 });
      }
    } });
  }
}

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
// opt.pt — точка прицела для заклинаний по области (центр сферы / направление конуса)
export async function play(A, cId, tIds = [], opt = {}) {
  const hits = {}, ret = {}, mp = {};   // ret — когда «обратный» снаряд долетел до заклинателя; mp — точки промаха
  if (!A) return hits;
  await grid();
  const info = await tokens([...new Set([cId, ...tIds].filter(Boolean))]);
  const C = cId && info[cId] ? { id: cId, ...info[cId] } : null;
  let T = tIds.filter(id => info[id]).map(id => ({ id, ...info[id] }));
  const PT = opt.pt && isFinite(opt.pt.x) && isFinite(opt.pt.y) ? { id: "@pt", x: +opt.pt.x, y: +opt.pt.y, r: DPI / 2 } : null;
  if (!T.length && C && !PT) T = [C];
  if (!T.length && PT && opt.asTarget) T = [PT];   // направленное заклинание «в место» — точка как цель
  if (!T.length && !PT) return hits;
  // точка области: прицел, а без него — центр целей (кроме заклинателя)
  const pointOf = () => {
    if (PT) return PT;
    const L = T.filter(t => !C || t.id !== C.id), S = L.length ? L : T;
    return { id: "@pt", x: S.reduce((s, t) => s + t.x, 0) / S.length, y: S.reduce((s, t) => s + t.y, 0) / S.length, r: S[0].r };
  };
  for (const st of A.cast || []) {
    const fn = FX[st.fx]; if (!fn) { console.warn("[fx] неизвестный эффект", st.fx); continue; }
    const d0 = st.delay || 0, stag = st.stagger || 0;
    if (st.fx === "cone" || (st.to === "point" && (st.fx === "projectile" || st.fx === "beam" || st.fx === "bolt" || st.fx === "threads" || st.fx === "seam"))) {
      if (!C) continue;   // один снаряд / один конус в точку области; цели «загораются» в момент попадания
      const h = d0 + fn(C, pointOf(), st, d0);
      hits["@pt"] = Math.max(hits["@pt"] || 0, h);
      T.forEach(t => { hits[t.id] = Math.max(hits[t.id] || 0, h); });
      continue;
    }
    if (st.fx === "letters") {   // всегда летят от цели к заклинателю
      if (!C) continue;
      T.forEach((t, k) => {
        if (t.id === C.id) return;
        const d = d0 + stag * k + (st.after === "hit" ? hits[t.id] || 0 : 0);
        ret[t.id] = Math.max(ret[t.id] || 0, d + fn(t, C, st, d));
      });
      continue;
    }
    if (st.fx === "watch") {   // часы появляются рядом с каждой целью; их hitAt — момент попадания
      T.forEach((t, k) => {
        const d = d0 + stag * k + (st.after === "hit" ? hits[t.id] || 0 : 0);
        hits[t.id] = Math.max(hits[t.id] || 0, d + fn(t, st, d));
      });
      continue;
    }
    if (st.fx === "bolt" && st.from === "sky") {   // молния с неба — заклинатель не нужен
      T.forEach((t, k) => {
        const d = d0 + stag * k + (st.after === "hit" ? hits[t.id] || 0 : 0), S = { x: t.x + (Math.random() - 0.5) * DPI, y: t.y - (st.height || 4) * DPI };
        hits[t.id] = Math.max(hits[t.id] || 0, d + fn(S, t, st, d));
      });
      continue;
    }
    if (st.fx === "projectile" || st.fx === "beam" || st.fx === "bolt" || st.fx === "threads" || st.fx === "seam") {
      if (!C) continue;
      T.forEach((t, k) => {
        if (t.id === C.id) return;
        const d = d0 + stag * k + (st.after === "hit" ? hits[t.id] || 0 : 0);
        if (st.miss) {   // промах: пролетает мимо цели и падает за ней
          if (!mp[t.id]) {
            const dx = t.x - C.x, dy = t.y - C.y, L = Math.hypot(dx, dy) || 1, sd = Math.random() < 0.5 ? -1 : 1;
            const over = (st.overshoot ?? 1.4) * DPI, side = (t.r || DPI / 2) + (st.side ?? 0.35) * DPI;
            mp[t.id] = { id: t.id, r: DPI / 2, x: t.x + dx / L * over - dy / L * side * sd, y: t.y + dy / L * over + dx / L * side * sd };
          }
          hits[t.id] = Math.max(hits[t.id] || 0, d + fn(C, mp[t.id], st, d));
        } else if (st.reverse) ret[t.id] = Math.max(ret[t.id] || 0, d + fn(t, C, st, d));   // от цели к заклинателю
        else hits[t.id] = Math.max(hits[t.id] || 0, d + fn(C, t, st, d));
      });
      continue;
    }
    let at = st.at || "targets", list;
    if (at === "caster") list = C ? [C] : [];
    else if (at === "miss") list = T.filter(t => mp[t.id]).map(t => mp[t.id]);
    else if (at === "point" || (at === "center" && PT)) list = [{ ...pointOf(), hit: hits["@pt"] ?? Math.max(0, ...T.map(t => hits[t.id] || 0)) }];
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
    } else if (p.fx === "hypno") {
      // Гипноз: двойная спираль медленно вращается под целью, к центру сходятся кольца,
      // над головой висят призрачные часы, стрелка которых тикает раз в секунду
      const R = T.r * (p.size || 1.2), o = op ?? 0.55, c2 = p.color2 || col, L = p.layer || "MOUNT", spn = p.spin ?? -80;
      const arms = [0, 1].map(k => circle({ x: T.x, y: T.y, r: 1, attach: tok, layer: L, z: z + items.length + k }));
      arms.forEach((it, k) => { it.points = spiralPts(R, p.turns || 2.2, k * Math.PI); it.style.strokeColor = k ? c2 : col; it.style.strokeWidth = DPI * (p.width || 0.04); it.style.closed = false; it.style.tension = 0.4; });
      items.push(...arms);
      const rings = [0, 1, 2].map(k => { const it = circle({ x: T.x, y: T.y, r: R, fill: c2, stroke: c2, sw: DPI * 0.025, n: 40, attach: tok, layer: L, z: z + items.length }); items.push(it); return it; });
      const cl = [];
      if (p.clock !== false) {
        const cc = p.clockColor || "#e8c15a", cr = DPI * (p.clockSize || 0.13), oy = -T.r * (p.height ?? 1.05), ck = { attach: tok, z: 0 };
        const mk = (pts, st) => { const it = poly({ x: T.x, y: T.y, pts, attach: tok, z: z + items.length, ...st }); items.push(it); return it; };
        const fc = mk(ringPts(cr, 24, 0, oy), { fill: "#fff6dc", stroke: cc, sw: DPI * 0.022 });
        const bw = mk(ringPts(cr * 0.25, 10, 0, oy - cr * 1.25), { stroke: cc, sw: DPI * 0.015 });
        const tk = [0, 1, 2, 3].map(i => mk(ringPts(cr * 0.08, 6, Math.sin(i * Math.PI / 2) * cr * 0.72, oy - Math.cos(i * Math.PI / 2) * cr * 0.72), { fill: "#6b4a12" }));
        const hs = mk([{ x: 0, y: oy }, { x: 0, y: oy - cr * 0.75 }], { stroke: p.color || "#7c3aed", sw: DPI * 0.014, closed: false });
        const hm = mk([{ x: 0, y: oy }, { x: cr * 0.45, y: oy }], { stroke: "#2b1d0a", sw: DPI * 0.016, closed: false });
        cl.push({ fc, bw, tk, hs, hm, cr, oy });
      }
      fs.push((t, P) => {
        const A = o * appear(t) * fl(t);
        arms.forEach(it => P.set(it.id, { r: spn * t, s: 1 + 0.05 * Math.sin(t * 1.8), so: A }));
        rings.forEach((it, k) => { const q = ((t * 0.45 + k / 3) % 1); P.set(it.id, { s: Math.max(0.05, 1.15 - q), so: A * 0.8 * Math.sin(Math.PI * q), fo: A * 0.05 * Math.sin(Math.PI * q) }); });
        for (const c of cl) {
          const sec = Math.floor(t), fr = t - sec, kick = fr < 0.12 ? Math.sin(fr / 0.12 * Math.PI) * 0.15 : 0;   // стрелка «щёлкает» с отскоком
          const a = (sec + Math.min(1, fr / 0.08)) * TAU / 12 + kick, bob = Math.sin(t * 1.6) * c.cr * 0.25, CA = appear(t) * (0.75 + 0.2 * Math.sin(t * 2.2)) * fl(t);
          const sh = pts => pts.map(q => ({ x: q.x, y: q.y + bob }));
          P.set(c.fc.id, { pts: sh(ringPts(c.cr, 24, 0, c.oy)), fo: CA * 0.92, so: CA });
          P.set(c.bw.id, { pts: sh(ringPts(c.cr * 0.25, 10, 0, c.oy - c.cr * 1.25)), so: CA });
          c.tk.forEach((it, i) => P.set(it.id, { pts: sh(ringPts(c.cr * 0.08, 6, Math.sin(i * Math.PI / 2) * c.cr * 0.72, c.oy - Math.cos(i * Math.PI / 2) * c.cr * 0.72)), fo: CA }));
          P.set(c.hs.id, { pts: sh([{ x: 0, y: c.oy }, { x: Math.sin(a) * c.cr * 0.75, y: c.oy - Math.cos(a) * c.cr * 0.75 }]), so: CA });
          const am = t * TAU / 60;
          P.set(c.hm.id, { pts: sh([{ x: 0, y: c.oy }, { x: Math.sin(am + 1.5) * c.cr * 0.48, y: c.oy - Math.cos(am + 1.5) * c.cr * 0.48 }]), so: CA });
        }
      });
    } else if (p.fx === "plates") {
      // Каменная облицовка: пластины слетаются к цели, с отскоком смыкаются в кольцо,
      // медленно «дышат», по ним вспыхивают кварцевые блики
      const n = p.count || 8, o = op ?? 0.95, r1 = T.r * (p.radius || 0.92), r2 = r1 + T.r * (p.width || 0.2), gapA = p.gap ?? 0.08;
      const c2 = p.color2 || col, ed = p.edge || "#d9cfb8", L = p.layer || "ATTACHMENT", sp3 = p.spin ?? 4, pl = [], gl = [];
      for (let k = 0; k < n; k++) {
        const a0 = k / n * TAU + gapA / 2, a1 = (k + 1) / n * TAU - gapA / 2, pts = [], m = 6, j = () => 1 + (Math.random() - 0.5) * 0.08;
        for (let i = 0; i <= m; i++) { const a = a0 + (a1 - a0) * i / m, rr = r2 * j(); pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); }
        for (let i = m; i >= 0; i--) { const a = a0 + (a1 - a0) * i / m, rr = r1 * j(); pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr }); }
        const it = poly({ x: T.x, y: T.y, pts, fill: k % 2 ? c2 : col, stroke: ed, sw: DPI * 0.018, attach: tok, layer: L, z: z + items.length });
        items.push(it); pl.push({ it, k, d: k * 0.06 });
      }
      for (let k = 0; k < (p.glints ?? 4); k++) {
        const a = Math.random() * TAU, rr = (r1 + r2) / 2, ox = Math.cos(a) * rr, oy = Math.sin(a) * rr;
        const it = poly({ x: T.x, y: T.y, pts: starPts(DPI * 0.02, 4, 0.3, 0, ox, oy), fill: p.glint || "#e6f6ff", stroke: "#ffffff", sw: DPI * 0.006, attach: tok, layer: L, z: z + items.length + 40 });
        items.push(it); gl.push({ it, ox, oy, per: 2.4 + Math.random() * 2.6, off: Math.random() * 3 });
      }
      fs.push((t, P) => {
        for (const q of pl) {
          const ap = c01((t - q.d) / 0.55), s = ap < 1 ? 1.7 - 0.7 * backOut(ap) : 1 + 0.012 * Math.sin(t * 1.5 + q.k), A = o * c01(ap * 2) * fl(t);
          P.set(q.it.id, { s, r: sp3 * t, fo: A * (0.88 + 0.12 * Math.sin(t * 0.8 + q.k * 1.3)), so: A * 0.8 });
        }
        for (const g of gl) {
          const q = ((t + g.off) % g.per) / 0.6, A = q < 1 ? Math.sin(Math.PI * q) : 0, on = c01((t - 0.9) / 0.3);
          P.set(g.it.id, { pts: starPts(DPI * 0.08 * (0.3 + 0.9 * A), 4, 0.28, t * 2, g.ox, g.oy), r: sp3 * t, fo: A * on, so: A * 0.8 * on });
        }
      });
    } else if (p.fx === "web") {
      // Сеть теней на токене: нити облепили цель и «дышат», по кольцам бегут блики от центра к краю,
      // сеть периодически дёргается (цель пытается вырваться), под ней — тёмная тень
      const R = T.r * (p.size || 1.2), n = p.spokes || 8, m = p.rings || 4, o = op ?? 0.9, c2 = p.core || "#e9ddff", L = p.layer || "ATTACHMENT";
      const G = webGeom(R, n, m, p.sag ?? 0.84, Math.random() * 100), W = [];
      const add = (it, kind, ex = {}) => { items.push(it); W.push({ it, kind, ...ex }); };
      const cfg = { x: T.x, y: T.y, attach: tok, layer: L };
      add(circle({ ...cfg, r: R * 1.04, fill: p.shade || "#07030f", n: 32, layer: "MOUNT", z: z + items.length }), "shade");
      G.spokes.forEach((pts, k) => add(poly({ ...cfg, pts, stroke: col, sw: DPI * 0.06, closed: false, z: z + items.length }), "g", { k, j: -1 }));
      G.rings.forEach((pts, j) => add(poly({ ...cfg, pts, stroke: col, sw: DPI * 0.05, tension: 0.35, z: z + items.length }), "g", { j }));
      G.spokes.forEach((pts, k) => add(poly({ ...cfg, pts, stroke: c2, sw: DPI * 0.016, closed: false, z: z + items.length }), "t", { k, j: -1 }));
      G.rings.forEach((pts, j) => add(poly({ ...cfg, pts, stroke: c2, sw: DPI * 0.015, tension: 0.35, z: z + items.length }), "t", { j }));
      G.knots.forEach((q, k) => add(poly({ ...cfg, pts: ringPts(DPI * 0.03, 8, q.x, q.y), fill: col, stroke: c2, sw: DPI * 0.01, z: z + items.length }), "k", { k }));
      const tug = p.tugEvery || 3.4, spn = p.spin || 0;
      fs.push((t, P) => {
        const ap = c01(t / 0.45), A = o * c01(ap * 1.6) * fl(t);
        const tq = (t % tug) / 0.35, tg = tq < 1 ? Math.sin(Math.PI * tq) : 0;
        const s = (1.25 - 0.25 * out3(ap)) * (1 + 0.015 * Math.sin(t * 1.7) - 0.05 * tg), r = 3 * Math.sin(t * 0.6) + spn * t + 2.5 * tg;
        for (const q of W) {
          if (q.kind === "shade") { P.set(q.it.id, { s, fo: (p.fill ?? 0.3) * A }); continue; }
          const a = q.kind === "k" ? 0.7 + 0.3 * Math.sin(t * 3 + q.k)
            : q.j < 0 ? 0.75 + 0.25 * Math.sin(t * 2.1 + q.k * 0.9)
            : 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.4 - q.j * 1.1), 2);
          if (q.kind === "g") P.set(q.it.id, { s, r, so: A * a * 0.32 * (1 + 0.8 * tg) });
          else if (q.kind === "t") P.set(q.it.id, { s, r, so: A * a * (1 + 0.3 * tg) });
          else P.set(q.it.id, { s, r, fo: A * a, so: A * a });
        }
      });
    } else if (p.fx === "veins") {
      // Светящиеся вены: ветвящиеся прожилки от центра наружу, по ним бегут импульсы света
      const n = p.count || 6, o = op ?? 0.9, R = T.r * (p.size || 1.1), w = DPI * (p.width || 0.03), V = [];
      const a0 = (p.angle ?? 0) * Math.PI / 180, spread = (p.spread ?? 360) * Math.PI / 180, full = spread >= TAU - 0.01;
      const branch = (x, y, ang, len, depth, j) => {
        const pts = [{ x, y }], m = 5; let cx = x, cy = y, a = ang;
        for (let k = 1; k <= m; k++) { a += (Math.random() - 0.5) * 0.7; cx += Math.cos(a) * len / m; cy += Math.sin(a) * len / m; pts.push({ x: cx, y: cy }); }
        const g = poly({ x: T.x, y: T.y, pts, stroke: col, sw: w * (3.2 - depth), closed: false, tension: 0.4, attach: tok, layer: p.layer, z: z + items.length });
        const c = poly({ x: T.x, y: T.y, pts, stroke: p.core || "#e8fbff", sw: w * (1.2 - depth * 0.35), closed: false, tension: 0.4, attach: tok, layer: p.layer, z: z + items.length + 1 });
        items.push(g, c); V.push({ g, c, j: j + depth * 0.25, d: depth });
        if (depth < 2) {
          const q = pts[2 + Math.floor(Math.random() * 2)];
          branch(q.x, q.y, a + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5), len * 0.55, depth + 1, j + 0.2);
        }
      };
      for (let k = 0; k < n; k++) {
        const ang = a0 + (full ? k / n * TAU : (k / Math.max(1, n - 1) - 0.5) * spread) + (Math.random() - 0.5) * 0.3, r0 = T.r * (p.inner ?? 0.25);
        branch(Math.cos(ang) * r0, Math.sin(ang) * r0, ang, R - r0, 0, k / n);
      }
      const sp2 = p.speed ?? 0.8;
      fs.push((t, P) => {
        const A = o * appear(t) * fl(t);
        for (const v of V) {
          const pl = 0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin((t * sp2 - v.j) * TAU), 3), k = 1 - v.d * 0.22;
          P.set(v.g.id, { so: A * 0.32 * pl * k }); P.set(v.c.id, { so: A * (0.45 + 0.55 * pl) * k });
        }
      });
    } else if (p.fx === "wings") {
      // Крылья из тени и кости (наполовину вороньи): костяной каркас плечо→локоть→запястье→коготь,
      // с него свисают перья-лезвия (маховые длиннее к концу), между ними — теневая перепонка и костяные спицы.
      // Раскрываются из сложенного положения, потом медленно взмахивают; по кромкам перьев бегут голубые блики
      const F = p.feathers || 11, o = op ?? 1, S = T.r * (p.size || 1), WL = [], L = p.layer || "MOUNT";
      const dark = col, edge = p.edge || "#38c8ff", bone = p.bone || "#d8d0bf", shade = p.shade || "#1a1f2e";
      const mk = (o2) => { const it = poly({ x: T.x, y: T.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], attach: tok, layer: L, z: z + items.length, ...o2 }); items.push(it); return it; };
      for (const sd of [1, -1]) {
        const w = { sd, mem: mk({ fill: shade, stroke: shade, sw: DPI * 0.01, tension: 0.25 }), fe: [], sp: [] };
        for (let k = 0; k < F; k++) {
          const bon = k % 3 === 1;
          w.fe.push({ k, bon, it: bon ? mk({ stroke: bone, sw: DPI * 0.03, closed: false, tension: 0.4 })
            : mk({ fill: dark, stroke: edge, sw: DPI * 0.018, tension: 0.35 }) });
        }
        w.arm = mk({ stroke: bone, sw: DPI * 0.06, closed: false, tension: 0.3 });
        w.armHi = mk({ stroke: "#ffffff", sw: DPI * 0.02, closed: false, tension: 0.3 });
        w.claw = mk({ fill: bone, stroke: bone, sw: DPI * 0.01 });
        WL.push(w);
      }
      const per2 = p.period || 3.4, unf = p.unfold || 1.1;
      const rot = (x, y, a) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });
      // геометрия правого крыла в локальных координатах (x — наружу, y — назад), u — раскрытие, fa — взмах
      const geom = (u, fa) => {
        const sh = { x: T.r * 0.35, y: T.r * 0.15 };
        const a1 = -0.8 * u + 1.25 * (1 - u) + fa, a2 = a1 + 0.5 + 0.35 * (1 - u), a3 = a2 + 0.45;
        const l1 = S * 0.95, l2 = S * (0.6 + 0.4 * u), l3 = S * (0.35 + 0.25 * u);
        const el = { x: sh.x + Math.cos(a1) * l1, y: sh.y + Math.sin(a1) * l1 };
        const wr = { x: el.x + Math.cos(a2) * l2, y: el.y + Math.sin(a2) * l2 };
        const tp = { x: wr.x + Math.cos(a3) * l3, y: wr.y + Math.sin(a3) * l3 };
        const along = q => q < 0.45 ? { x: sh.x + (el.x - sh.x) * q / 0.45, y: sh.y + (el.y - sh.y) * q / 0.45, a: a1 }
          : q < 0.85 ? { x: el.x + (wr.x - el.x) * (q - 0.45) / 0.4, y: el.y + (wr.y - el.y) * (q - 0.45) / 0.4, a: a2 }
          : { x: wr.x + (tp.x - wr.x) * (q - 0.85) / 0.15, y: wr.y + (tp.y - wr.y) * (q - 0.85) / 0.15, a: a3 };
        const fe = [];
        for (let k = 0; k < F; k++) {
          const f = k / (F - 1), b = along(0.1 + 0.9 * f);
          const fan = (1.95 - 1.25 * f) * (0.35 + 0.65 * u);   // внутренние перья смотрят назад, маховые — наружу
          const ang = b.a + fan, len = S * (0.7 + 0.9 * Math.pow(f, 1.2)) * (0.4 + 0.6 * u), wid = S * (0.09 + 0.05 * f);
          fe.push({ b, ang, len, wid });
        }
        return { sh, el, wr, tp, fe };
      };
      const blade = (b, ang, len, wid) => {
        const c = Math.cos(ang), s = Math.sin(ang), px = -s, py = c;
        return [{ x: b.x - px * wid * 0.4, y: b.y - py * wid * 0.4 }, { x: b.x + c * len * 0.55 - px * wid, y: b.y + s * len * 0.55 - py * wid },
          { x: b.x + c * len, y: b.y + s * len }, { x: b.x + c * len * 0.5 + px * wid * 0.55, y: b.y + s * len * 0.5 + py * wid * 0.55 }];
      };
      fs.push((t, P) => {
        const u = out3(c01(t / unf)), A = o * c01(t / 0.35) * fl(t), fa = 0.12 * Math.sin(t * TAU / per2) * u, lift = -Math.sin(t * TAU / per2) * T.r * 0.03;
        const G = geom(u, fa);
        for (const w of WL) {
          const m = q => ({ x: q.x * w.sd, y: q.y + lift });
          const mem = [G.sh, G.el, G.wr, G.tp, ...G.fe.slice().reverse().map(f => ({ x: f.b.x + Math.cos(f.ang) * f.len * 0.92, y: f.b.y + Math.sin(f.ang) * f.len * 0.92 }))].map(m);
          P.set(w.mem.id, { pts: mem, fo: A * (p.membrane ?? 0.55), so: A * 0.4 });
          for (const f of w.fe) {
            const g = G.fe[f.k], sh2 = 0.5 + 0.5 * Math.sin(t * 2.4 - f.k * 0.6);
            if (f.bon) P.set(f.it.id, { pts: [g.b, { x: g.b.x + Math.cos(g.ang) * g.len * 0.5, y: g.b.y + Math.sin(g.ang) * g.len * 0.5 + S * 0.02 }, { x: g.b.x + Math.cos(g.ang) * g.len * 0.85, y: g.b.y + Math.sin(g.ang) * g.len * 0.85 }].map(m), so: A * 0.85 });
            else P.set(f.it.id, { pts: blade(g.b, g.ang, g.len, g.wid).map(m), fo: A * (p.fill ?? 0.92), so: A * (0.25 + 0.55 * Math.pow(sh2, 3)) });
          }
          const arm = [G.sh, G.el, G.wr, G.tp].map(m);
          P.set(w.arm.id, { pts: arm, so: A * 0.95 }); P.set(w.armHi.id, { pts: arm, so: A * 0.35 });
          const ca = Math.atan2(G.tp.y - G.wr.y, G.tp.x - G.wr.x), cl = S * 0.22;
          P.set(w.claw.id, { pts: [{ x: G.tp.x + Math.sin(ca) * S * 0.03, y: G.tp.y - Math.cos(ca) * S * 0.03 }, { x: G.tp.x + Math.cos(ca - 0.5) * cl, y: G.tp.y + Math.sin(ca - 0.5) * cl }, { x: G.tp.x - Math.sin(ca) * S * 0.03, y: G.tp.y + Math.cos(ca) * S * 0.03 }].map(m), fo: A, so: A });
        }
      });
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
// Зона в точке (Тьма): висит, пока её не снимут. Rc — радиус в клетках; quick — без «разливания» (смена радиуса)
// tok — id токена: зона прикрепляется к нему и двигается вместе с ним (pt — его текущий центр)
export async function startZone(p, pt, Rc, quick, tok) {
  await grid();
  const R = Rc * DPI, col = p.color || "#05030a", col2 = p.color2 || "#140b28", edge = p.edge || "#3b2466", glow = p.glow || "#8a5cff";
  const op = p.opacity ?? 1, L = p.layer || "ATTACHMENT", z = Date.now() + 5, tIn = quick ? 350 : (p.grow || 900), FADE = p.fade || 1400;
  const c = { x: +pt.x, y: +pt.y }, items = [], big = Math.max(1, Rc / 3), at = tok || undefined;
  const disks = [[1.1, 0.14], [1.0, 0.22], [0.9, 0.3], [0.74, 0.36], [0.52, 0.4]].map(([k, a], i) => {
    const it = circle({ x: c.x, y: c.y, r: R * k, fill: i < 2 ? col2 : col, fo: 0, n: 56, s: 0.01, layer: L, z: z + i, attach: at });
    items.push(it); return { it, a: a * op, ph: Math.random() * TAU };
  });
  const nt = p.tendrils ?? Math.min(24, Math.round(10 * big)), tend = [];
  for (let k = 0; k < nt; k++) {
    const it = poly({ x: c.x, y: c.y, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: k % 2 ? col : col2, sw: DPI * (0.06 + Math.random() * 0.06), closed: false, tension: 0.5, layer: L, z: z + 6, attach: at });
    items.push(it);
    tend.push({ it, a0: k / nt * TAU + Math.random() * 0.4, len: DPI * Math.min(3, Rc) * (0.2 + Math.random() * 0.3), ph: Math.random() * TAU, sp: 0.6 + Math.random() * 0.7, dir: Math.random() < 0.5 ? -1 : 1 });
  }
  const rims = [0, 1].map(k => { const it = circle({ x: c.x, y: c.y, r: R * (1 - k * 0.05), fill: edge, stroke: k ? glow : edge, sw: DPI * (k ? 0.022 : 0.05), dash: k ? [DPI * 0.06, DPI * 0.22] : [DPI * 0.32, DPI * 0.16], n: 72, s: 0.01, layer: L, z: z + 10 + k, attach: at }); items.push(it); return it; });
  const rush = quick ? null : circle({ x: c.x, y: c.y, r: R * 1.6, fill: glow, stroke: glow, sw: DPI * 0.04, n: 56, layer: L, z: z + 12, attach: at });
  const core = quick ? null : circle({ x: c.x, y: c.y, r: DPI * 0.4, fill: glow, fo: 0, n: 24, layer: L, z: z + 13, attach: at });
  if (rush) items.push(rush, core);
  const nm = p.motes ?? Math.min(40, Math.round(18 * big)), motes = [];
  for (let k = 0; k < nm; k++) {
    const mr = DPI * (0.025 + Math.random() * 0.03);
    const it = circle({ x: c.x, y: c.y, r: mr, fill: k % 3 ? (p.mote || "#cbb8ff") : "#ffffff", fo: 0, n: 8, layer: L, z: z + 14 + k, attach: at });
    items.push(it); motes.push({ it, mr, a: Math.random() * TAU, per: (1.3 + Math.random() * 1.3) * Math.sqrt(big), off: Math.random(), d: R * (1.1 + Math.random() * 0.5), sw: Math.random() < 0.5 ? -1 : 1 });
  }
  await OBR.scene.local.addItems(items);
  const a = { ids: items.map(i => i.id), loop: true, t0: now(), stop: 0 };
  a.f = (t, P) => {
    const tm = t * 1000, sec = t, q = c01(tm / tIn), g = Math.max(0.01, q < 1 ? (quick ? out3(q) : backOut(q)) : 1);
    const out = a.stop ? c01((now() - a.stop) / FADE) : 0;
    const env = (q < 1 ? c01(tm / (tIn * 0.5)) : 1) * (1 - out), spread = 1 + 0.12 * out;   // снятая тьма расплывается и тает
    disks.forEach(d => P.set(d.it.id, { s: g * spread * (1 + 0.025 * Math.sin(sec * 1.3 + d.ph)), fo: d.a * env }));
    P.set(rims[0].id, { s: g * spread, r: sec * 7 / big, so: 0.5 * env });
    P.set(rims[1].id, { s: g * spread, r: -sec * 13 / big, so: 0.4 * env * (0.7 + 0.3 * Math.sin(sec * 2.1)) });
    if (rush) {
      P.set(rush.id, { s: 1 - 0.375 * out3(q), so: q < 1 ? 0.85 * Math.sin(Math.PI * q) : 0 });
      const cq = c01(tm / 550);
      P.set(core.id, { s: 0.4 + 2.2 * cq, fo: cq < 1 ? 0.55 * Math.sin(Math.PI * cq) : 0 });
    }
    for (const T of tend) {
      const pts = [], an = T.a0 + 0.18 * Math.sin(sec * T.sp * 0.7 + T.ph);
      for (let j = 0; j <= 6; j++) {
        const f = j / 6, rr = R * g * spread * 0.85 + T.len * f * (0.7 + 0.3 * Math.sin(sec * T.sp + T.ph)) * env;
        const aa = an + T.dir * f * f * 0.8 / big * Math.sin(sec * T.sp * 1.3 + T.ph + f * 2);
        pts.push({ x: Math.cos(aa) * rr, y: Math.sin(aa) * rr });
      }
      P.set(T.it.id, { pts, so: 0.6 * env * c01((tm - tIn * 0.4) / 400) });
    }
    for (const m of motes) {
      const k = (sec / m.per + m.off) % 1, d = m.d * (1 - k * k * 0.85), an = m.a + m.sw * k * 2.2 + Math.floor(sec / m.per + m.off) * 1.7;
      // искры двигаем точками относительно центра — так они едут вместе с токеном, если зона прикреплена
      const ox = Math.cos(an) * d, oy = Math.sin(an) * d, pts = [];
      for (let j = 0; j < 8; j++) { const b = j / 8 * TAU; pts.push({ x: ox + Math.cos(b) * m.mr, y: oy + Math.sin(b) * m.mr }); }
      P.set(m.it.id, { pts, fo: Math.sin(Math.PI * k) * env * c01((tm - 300) / 400) * 0.85 });
    }
  };
  anims.add(a); kick();
  return { tok: tok || null, pt: c, a, fade: FADE };
}
export function stopAura(r, del = true) {
  if (!r) return;
  if (del && r.fade) {   // зона тает, потом удаляется
    r.a.stop = now();
    setTimeout(() => { anims.delete(r.a); OBR.scene.local.deleteItems(r.a.ids).catch(() => {}); }, r.fade + 60);
    return;
  }
  anims.delete(r.a);
  if (del) OBR.scene.local.deleteItems(r.a.ids).catch(() => {});
}
export function stopAll() { anims.clear(); }
