// Движок анимаций Эмерджентности: локальные объекты на карте у каждого игрока.
// Цикл на setTimeout (requestAnimationFrame не работает в скрытом фоновом iframe).
import OBR, { buildCurve } from "https://esm.sh/@owlbear-rodeo/sdk@3";

export let DPI = 150;
export async function grid() { try { DPI = (await OBR.scene.grid.getDpi()) || DPI; } catch (e) {} return DPI; }
export async function feetPerCell() { try { const s = await OBR.scene.grid.getScale(); return (s && s.parsed && s.parsed.multiplier) || 5; } catch (e) { return 5; } }

export const TAU = Math.PI * 2;
export const now = () => performance.now();
export const c01 = p => Math.min(1, Math.max(0, p));
export const out3 = p => 1 - Math.pow(1 - c01(p), 3);
export const out2 = p => 1 - Math.pow(1 - c01(p), 2);
export const in2 = p => c01(p) * c01(p);
export const inOut = p => { p = c01(p); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
export const backOut = p => { p = c01(p); const s = 1.70158; return 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
// огибающая: нарастание за a, затухание за b (в долях прогресса)
export const env = (p, a = .1, b = .25) => p <= 0 || p >= 1 ? 0 : p < a ? p / a : p > 1 - b ? (1 - p) / b : 1;
export const seg = (p, a, b) => c01((p - a) / (b - a));

// векторы
export const V = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul: (a, k) => ({ x: a.x * k, y: a.y * k }),
  len: a => Math.hypot(a.x, a.y),
  dist: (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
  norm: a => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; },
  perp: a => ({ x: -a.y, y: a.x }),
  lerp: (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }),
  ang: (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
  pol: (c, r, a) => ({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }),
  rot: (p, a) => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) }),
};
export function bez(a, c, b, t) { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }; }
export function bez3(a, c1, c2, b, t) { const u = 1 - t; return { x: u*u*u*a.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*b.x, y: u*u*u*a.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*b.y }; }

// ───────────────────────── цикл ─────────────────────────
const anims = new Set(); let running = false;
function kick() { if (!running) { running = true; setTimeout(tick, 0); } }
async function tick() {
  const t = now(), P = new Map(), dead = [];
  for (const a of anims) {
    if (a.dead) { anims.delete(a); dead.push(...a.ids); continue; }
    if (a.loop) {
      if (a.fadeAt) { a.k = 1 - (t - a.fadeAt) / a.fade; if (a.k <= 0) { anims.delete(a); dead.push(...a.ids); continue; } } else a.k = 1;
      if (a.every && t - (a.last || 0) < a.every) continue;
      a.last = t; a.v = c01((t - a.t0) / a.appear) * a.k;
      try { a.f((t - a.t0) / 1000, P, a); } catch (e) { console.warn("[emergence]", e); }
      continue;
    }
    const p = (t - a.t0) / a.dur;
    if (p >= 1) { anims.delete(a); dead.push(...a.ids); continue; }
    try { a.f(p, P, a); } catch (e) { console.warn("[emergence]", e); }
  }
  for (const id of dead) P.delete(id);
  try { if (dead.length) await OBR.scene.local.deleteItems(dead); } catch (e) {}
  try {
    if (P.size) await OBR.scene.local.updateItems([...P.keys()], ds => { for (const d of ds) { const q = P.get(d.id); if (q) apply(d, q); } });
  } catch (e) {}
  if (anims.size) setTimeout(tick, Math.max(4, 33 - (now() - t))); else running = false;
}
function apply(d, q) {
  if (q.x != null) d.position = { x: q.x, y: q.y };
  if (q.pts) d.points = q.pts.map(p => ({ x: p.x, y: p.y }));
  if (q.s != null) d.scale = { x: q.s, y: q.s };
  if (q.sx != null) d.scale = { x: q.sx, y: q.sy ?? q.sx };
  if (q.r != null) d.rotation = q.r;
  const st = d.style;
  if (st) {
    if (q.fo != null) st.fillOpacity = c01(q.fo);
    if (q.so != null) st.strokeOpacity = c01(q.so);
    if (q.fc) st.fillColor = q.fc;
    if (q.sc) st.strokeColor = q.sc;
    if (q.sw != null) st.strokeWidth = Math.max(0, q.sw);
  }
}

// Одноразовая анимация: anim = {dur, f(p, P)}. Постоянная: {loop:true, f(sec, P, a)} — a.v = видимость (появление × затухание)
export function spawn(delay, items, anim) {
  anim.ids = items.map(i => i.id);
  if (anim.loop) { anim.appear = anim.appear || 600; anim.fade = anim.fade || 600; anim.v = 0; anim.k = 1; }
  setTimeout(async () => {
    if (anim.dead) return;
    try { await OBR.scene.local.addItems(items); } catch (e) { console.warn("[emergence] addItems", e); return; }
    if (anim.dead) { try { await OBR.scene.local.deleteItems(anim.ids); } catch (e) {} return; }
    anim.t0 = now(); anims.add(anim); kick();
  }, Math.max(0, delay || 0));
  return anim;
}
export const wait = ms => new Promise(r => setTimeout(r, ms));
// Остановить анимацию: постоянные плавно гаснут (a.k → 0), если не quick
export function stop(anim, quick) {
  if (!anim) return;
  if (quick || !anim.loop || !anims.has(anim)) { anim.dead = true; if (anims.has(anim)) kick(); return; }
  if (!anim.fadeAt) { anim.fadeAt = now(); kick(); }
}
export async function clearAll() {
  for (const a of anims) a.dead = true; anims.clear();
  try { const it = await OBR.scene.local.getItems(i => i.name === "⚡ emergence"); if (it.length) await OBR.scene.local.deleteItems(it.map(i => i.id)); } catch (e) {}
}

// ───────────────────────── примитивы ─────────────────────────
let Z = 0;
function base(it, o) {
  it.layer = o.layer || "ATTACHMENT";
  it.zIndex = o.z ?? (1e6 + (Z++ % 100000));
  it.locked = true; it.disableHit = true; it.name = "⚡ emergence";
  if (o.s != null) it.scale = { x: o.s, y: o.s };
  if (o.rot != null) it.rotation = o.rot;
  return it;
}
// Кривая (замкнутая или нет). Точки — абсолютные, если x/y не заданы.
export function poly(o) {
  const pts = (o.pts && o.pts.length ? o.pts : [{ x: 0, y: 0 }, { x: 0, y: 0 }]).map(p => ({ x: p.x, y: p.y }));
  const it = buildCurve().points(pts).build();
  it.points = pts;
  it.position = { x: o.x || 0, y: o.y || 0 };
  it.style = {
    fillColor: o.fill || "#000000", fillOpacity: o.fill ? (o.fo ?? 0) : 0,
    strokeColor: o.stroke || "#ffffff", strokeOpacity: o.stroke ? (o.so ?? 0) : 0,
    strokeWidth: o.sw ?? 0, strokeDash: o.dash || [], tension: o.tension ?? 0, closed: o.closed ?? true,
  };
  return base(it, o);
}
export const line = o => poly({ ...o, closed: false, fill: null });
export function circle(o) { return poly({ ...o, pts: ringPts(o.r || 1, o.n || 48), closed: true }); }

// ───────────────────────── геометрия ─────────────────────────
export function ringPts(r, n = 48, ox = 0, oy = 0, a0 = 0) { const p = []; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; p.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r }); } return p; }
export function ellPts(rx, ry, rot = 0, n = 40, ox = 0, oy = 0) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, q = V.rot({ x: Math.cos(a) * rx, y: Math.sin(a) * ry }, rot); p.push({ x: ox + q.x, y: oy + q.y }); } return p; }
export function hexPts(r, rot = 0, ox = 0, oy = 0) { const p = []; for (let i = 0; i < 6; i++) { const a = rot + i / 6 * TAU + Math.PI / 6; p.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r }); } return p; }
export function arcPts(c, r, a0, a1, n = 24) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); } return p; }
export function starPts(r1, r2, n = 4, rot = 0, ox = 0, oy = 0) { const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * TAU; const r = i % 2 ? r2 : r1; p.push({ x: ox + Math.cos(a) * r, y: oy + Math.sin(a) * r }); } return p; }
export function shardPts(r) { const n = 3 + Math.floor(Math.random() * 2), p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + rnd(-.4, .4); p.push({ x: Math.cos(a) * r * rnd(.4, 1), y: Math.sin(a) * r * rnd(.4, 1) }); } return p; }
// Ломаная молния от A к B
export function boltPts(A, B, jag = .18, n = 10) {
  const d = V.sub(B, A), L = V.len(d), nn = V.perp(V.norm(d)), p = [{ ...A }];
  for (let i = 1; i < n; i++) { const t = i / n, o = (Math.random() - .5) * 2 * jag * L / n * 2.2 * Math.sin(Math.PI * t) ** .5; p.push({ x: A.x + d.x * t + nn.x * o, y: A.y + d.y * t + nn.y * o }); }
  p.push({ ...B }); return p;
}
// Трещины стекла: набор ломаных из центра (каждая — массив точек, относительных)
export function crackSet(R, n = 7) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let a = i / n * TAU + rnd(-.3, .3), r = 0; const p = [{ x: 0, y: 0 }];
    const steps = 4 + Math.floor(Math.random() * 3);
    for (let k = 0; k < steps; k++) { r += R / steps * rnd(.7, 1.3); a += rnd(-.45, .45); p.push({ x: Math.cos(a) * r, y: Math.sin(a) * r }); }
    out.push(p);
    if (Math.random() < .6) { // ответвление
      const s = p[1 + Math.floor(Math.random() * (p.length - 2))]; let b = a + rnd(-1, 1) * .9, rr = 0; const q = [{ ...s }];
      for (let k = 0; k < 3; k++) { rr += R * .18 * rnd(.7, 1.2); b += rnd(-.4, .4); q.push({ x: s.x + Math.cos(b) * rr, y: s.y + Math.sin(b) * rr }); }
      out.push(q);
    }
  }
  // кольцевые трещины между лучами
  for (let k = 0; k < 2; k++) {
    const rr = R * (k ? .62 : .34), a0 = rnd(0, TAU), q = [];
    for (let i = 0; i <= 7; i++) { const a = a0 + i / 7 * rnd(1.4, 2.4); q.push({ x: Math.cos(a) * rr * rnd(.9, 1.1), y: Math.sin(a) * rr * rnd(.9, 1.1) }); }
    out.push(q);
  }
  return out;
}
// Часть ломаной по длине (0..1) — для «прорастания» линий
export function partial(pts, f) {
  f = c01(f); if (f >= 1) return pts; if (pts.length < 2) return pts;
  let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const l = V.dist(pts[i - 1], pts[i]); seg.push(l); L += l; }
  let need = L * f; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (need >= seg[i - 1]) { out.push(pts[i]); need -= seg[i - 1]; continue; }
    out.push(V.lerp(pts[i - 1], pts[i], seg[i - 1] ? need / seg[i - 1] : 0)); break;
  }
  if (out.length < 2) out.push(out[0]);
  return out;
}
export const offs = (pts, c) => pts.map(p => ({ x: p.x + c.x, y: p.y + c.y }));

// ───────────────────────── токены ─────────────────────────
export async function tokens(ids) {
  const out = [];
  for (const id of ids || []) {
    if (!id) continue;
    try {
      const b = await OBR.scene.items.getItemBounds([id]);
      const it = (await OBR.scene.items.getItems([id]))[0];
      out.push({ id, x: b.center.x, y: b.center.y, r: Math.max(b.width, b.height) / 2, name: it ? (it.text && it.text.plainText) || it.name || "" : "", vis: it ? it.visible !== false : true });
    } catch (e) {}
  }
  return out;
}
export async function token(id) { return (await tokens([id]))[0] || null; }

// Плавное перемещение токена центром в точку (только мастер)
export async function moveToken(id, to, ms = 450, steps = 10) {
  try {
    const it = (await OBR.scene.items.getItems([id]))[0]; if (!it) return;
    const b = await OBR.scene.items.getItemBounds([id]);
    const dx = to.x - b.center.x, dy = to.y - b.center.y, p0 = { ...it.position };
    for (let i = 1; i <= steps; i++) {
      const k = inOut(i / steps);
      await OBR.scene.items.updateItems([id], ds => { for (const d of ds) d.position = { x: p0.x + dx * k, y: p0.y + dy * k }; });
      if (i < steps) await wait(ms / steps);
    }
  } catch (e) { console.warn("[emergence] move", e); }
}
export async function teleportToken(id, to) { return moveToken(id, to, 0, 1); }
export async function setVisible(id, vis) { try { await OBR.scene.items.updateItems([id], ds => { for (const d of ds) d.visible = vis; }); } catch (e) {} }
// Стягивание токена в точку и скрытие (стирание): масштаб возвращается, токен остаётся скрытым
export async function shrinkHide(id, ms = 700, steps = 10) {
  try {
    const it = (await OBR.scene.items.getItems([id]))[0]; if (!it) return;
    const s0 = { ...it.scale };
    for (let i = 1; i <= steps; i++) {
      const k = 1 - in2(i / steps) * .96;
      await OBR.scene.items.updateItems([id], ds => { for (const d of ds) d.scale = { x: s0.x * k, y: s0.y * k }; });
      await wait(ms / steps);
    }
    await OBR.scene.items.updateItems([id], ds => { for (const d of ds) { d.visible = false; d.scale = s0; } });
  } catch (e) { console.warn("[emergence] shrink", e); }
}
