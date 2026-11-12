// Висящие (постоянные) эффекты. Каждый — циклическая анимация, которая следует за токенами
// через G(id) → {x, y, r, vis} | null (кэш позиций из background.js).
import { DPI, TAU, V, c01, lerp, rnd, out2, out3, spawn, poly, line, circle, ringPts, hexPts, starPts, boltPts, crackSet, arcPts } from "./engine.js";
import { PAL } from "./const.js";
import { tentPts, tentacleKit, eyeShape, hexLattice, clockTicks } from "./fx.js";

const { cy: CY, cy2: CY2, navy: NAVY, white: WH, lens: LENS, lens2: LENS2 } = PAL;
const set = (P, it, q) => P.set(it.id, q);
const loop = (items, f, o = {}) => spawn(0, items, { loop: true, f, appear: o.appear || 700, fade: o.fade || 700, every: o.every || 0 });
const hide = (P, items) => items.forEach(it => set(P, it, { fo: 0, so: 0 }));
// Сглаженное слежение за токеном
function follower(G) {
  const sm = new Map();
  return id => {
    const t = id ? G(id) : null;
    if (!t || t.vis === false) { sm.delete(id); return null; }
    let s = sm.get(id);
    if (!s || Math.hypot(t.x - s.x, t.y - s.y) > DPI * 12) { s = { ...t }; sm.set(id, s); }
    else { s.x += (t.x - s.x) * .35; s.y += (t.y - s.y) * .35; s.r = t.r; }
    return s;
  };
}
// Значок «без реакций»: круг со стрелкой-петлёй и перечёркиванием
function noReactGlyph(col, size) {
  const s = size;
  const bg = circle({ r: s * 1.15, fill: NAVY, fo: 0 });
  const ring = circle({ r: s, stroke: col, so: 0, sw: DPI * .035 });
  const arc = line({ pts: arcPts({ x: 0, y: 0 }, s * .5, -2.4, 1.6, 14), stroke: col, so: 0, sw: DPI * .03 });
  const tip = arcPts({ x: 0, y: 0 }, s * .5, 1.6, 1.6, 1)[0];
  const head = poly({ pts: [{ x: tip.x + s * .18, y: tip.y - s * .02 }, { x: tip.x - s * .12, y: tip.y + s * .2 }, { x: tip.x - s * .1, y: tip.y - s * .16 }], fill: col, fo: 0 });
  const slash = line({ pts: [{ x: -s * .7, y: -s * .7 }, { x: s * .7, y: s * .7 }], stroke: col, so: 0, sw: DPI * .045 });
  const items = [bg, ring, arc, head, slash];
  return { items, draw(P, c, a) { for (const it of items) set(P, it, { x: c.x, y: c.y }); set(P, bg, { x: c.x, y: c.y, fo: a * .6 }); set(P, ring, { x: c.x, y: c.y, so: a }); set(P, arc, { x: c.x, y: c.y, so: a * .9 }); set(P, head, { x: c.x, y: c.y, fo: a * .9 }); set(P, slash, { x: c.x, y: c.y, so: a }); } };
}

// Голубые нити на ногах (Касание, скорость 0)
function nets(G, { tok }) {
  const F = follower(G), D = DPI;
  const glow = circle({ r: 1, fill: CY, fo: 0, layer: "DRAWING" });
  const th = [0, 1, 2, 3, 4].map(j => line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: j % 2 ? CY : CY2, so: 0, sw: D * .025, tension: .5 }));
  const anchors = [0, 1, 2, 3].map(() => line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY, so: 0, sw: D * .02, tension: .4 }));
  const nodes = [0, 1, 2, 3, 4, 5].map(() => circle({ r: D * .045, fill: WH, fo: 0 }));
  const items = [glow, ...anchors, ...th, ...nodes];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const r = T.r, v = a.v;
    set(P, glow, { x: T.x, y: T.y + r * .45, s: r * .95, fo: v * (.1 + .04 * Math.sin(sec * 3)) });
    th.forEach((it, j) => {
      const y0 = r * (.08 + .17 * j), w = Math.sqrt(Math.max(0, r * r - y0 * y0)) * 1.04, pts = [];
      for (let i = 0; i <= 8; i++) pts.push({ x: -w + 2 * w * i / 8, y: y0 + Math.sin(i * 1.3 + sec * 2.2 + j) * r * .055 });
      set(P, it, { x: T.x, y: T.y, pts, so: v * (.55 + .3 * Math.sin(sec * 4 + j)) });
    });
    anchors.forEach((it, k) => { const x = r * (-.6 + k * .4); set(P, it, { x: T.x, y: T.y, pts: [{ x, y: r * .1 }, { x: x * 1.25 + Math.sin(sec + k) * r * .05, y: r * .55 }, { x: x * 1.5, y: r * 1.08 }], so: v * .5 }); });
    nodes.forEach((it, k) => { const x = r * (-.62 + k * .25), y = r * (.25 + (k % 3) * .17); set(P, it, { x: T.x + x, y: T.y + y, fo: v * (.5 + .5 * Math.sin(sec * 5 + k * 2)) }); });
  }, { every: 33 });
}
// Плетение: прозрачная паутина и значок «без реакций»
function web(G, { tok }) {
  const F = follower(G), D = DPI, spokes = [], rings = [];
  for (let i = 0; i < 8; i++) spokes.push(line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY2, so: 0, sw: D * .018 }));
  for (let k = 0; k < 2; k++) rings.push(line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY, so: 0, sw: D * .016, tension: .45 }));
  const g = noReactGlyph(CY2, D * .2);
  const items = [...spokes, ...rings, ...g.items];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const R = T.r * 1.05, rot = sec * .15, v = a.v * (.45 + .15 * Math.sin(sec * 2));
    spokes.forEach((it, i) => { const an = i / 8 * TAU; set(P, it, { x: T.x, y: T.y, r: rot * 57, pts: [V.pol({ x: 0, y: 0 }, R * .1, an), V.pol({ x: 0, y: 0 }, R, an)], so: v }); });
    rings.forEach((it, k) => { const rr = R * (k + 1) / 2.4, pts = []; for (let i = 0; i <= 16; i++) pts.push(V.pol({ x: 0, y: 0 }, rr * (i % 2 ? .88 : 1), i / 16 * TAU)); set(P, it, { x: T.x, y: T.y, r: rot * 57, pts, so: v }); });
    g.draw(P, { x: T.x + T.r * .75, y: T.y - T.r * .85 + Math.sin(sec * 2) * D * .04 }, a.v);
  }, { every: 33 });
}
// Стирание: зарядка — сотовый диск, прицельные лучи, прицел и взгляд босса
function charge(G, { tok, boss }) {
  const F = follower(G), D = DPI;
  const cells = hexLattice(D * 1.9, D * .3).map(h => ({ h, it: poly({ pts: hexPts(D * .27, 0, h.x, h.y), fill: CY, fo: 0, stroke: CY2, so: 0, sw: D * .012, layer: "DRAWING" }), ph: rnd(0, TAU) }));
  const aims = [0, 1, 2, 3, 4, 5].map(() => { const l = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY2, so: 0, sw: D * .025 }); l.style.strokeDash = [D * .16, D * .1]; return l; });
  const ch = circle({ r: D * .26, stroke: WH, so: 0, sw: D * .03 }), ticks = [0, 1, 2, 3].map(k => line({ pts: [V.pol({ x: 0, y: 0 }, D * .14, k * TAU / 4), V.pol({ x: 0, y: 0 }, D * .38, k * TAU / 4)], stroke: CY2, so: 0, sw: D * .035 }));
  const dot = circle({ r: D * .05, fill: WH, fo: 0 });
  const teth = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY, so: 0, sw: D * .02 }); teth.style.strokeDash = [D * .1, D * .12];
  const pulse = circle({ r: D * .08, fill: CY2, fo: 0 });
  const items = [...cells.map(c => c.it), teth, pulse, ...aims, ch, ...ticks, dot];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const v = a.v, sc = Math.max(1, T.r / (D * .5));
    cells.forEach(c => set(P, c.it, { x: T.x, y: T.y, s: sc, r: sec * 8, fo: v * (.05 + .07 * (.5 + .5 * Math.sin(sec * 3 + c.ph))), so: v * (.25 + .35 * (.5 + .5 * Math.sin(sec * 3 + c.ph))) }));
    aims.forEach((it, k) => { const an = k * TAU / 6 + sec * .3, R = T.r * 2.4 + Math.sin(sec * 2 + k) * D * .2; set(P, it, { pts: [V.pol(T, R, an), V.pol(T, T.r * 1.08, an)], so: v * (.45 + .3 * Math.sin(sec * 6 + k)) }); });
    const c = { x: T.x, y: T.y - T.r - D * .5 };
    set(P, ch, { x: c.x, y: c.y, so: v, s: 1 + .08 * Math.sin(sec * 5) });
    ticks.forEach(it => set(P, it, { x: c.x, y: c.y, r: sec * 60, so: v }));
    set(P, dot, { x: c.x, y: c.y, fo: v * (Math.sin(sec * 8) > 0 ? 1 : .3) });
    const B = F(boss);
    if (B) {
      const S = { x: B.x, y: B.y - B.r * .55 }, u = (sec * .7) % 1, q = V.lerp(S, T, u);
      set(P, teth, { pts: [S, T], so: v * .35 }); set(P, pulse, { x: q.x, y: q.y, fo: v * Math.sin(u * Math.PI) * .9 });
    } else { set(P, teth, { so: 0 }); set(P, pulse, { fo: 0 }); }
  }, { every: 33 });
}
// Сфера: щупальце держит цель; при снятии — втягивается обратно
function grab(G, { tok, boss }) {
  const F = follower(G), D = DPI, kit = tentacleKit();
  const coil = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: "#B5C7D6", so: 0, sw: D * .1, tension: .5 });
  const coilO = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: "#2C4157", so: 0, sw: D * .15, tension: .5 });
  const items = [coilO, coil, ...kit.items];
  return loop(items, (sec, P, a) => {
    const T = F(tok), B = F(boss); if (!T || !B) return hide(P, items);
    const k = a.k, A = V.pol(B, B.r * .6, V.ang(B, T)), tip = V.lerp(A, V.pol(T, T.r * .35, V.ang(T, B) + .4), out3(k));
    kit.draw(P, tentPts(A, tip, sec * .6, D * .25, 16, 1), Math.min(1, a.v * 1.5) * (k < .15 ? k / .15 : 1), sec);
    const pts = []; for (let i = 0; i <= 26; i++) { const an = i / 26 * TAU * 1.4 + sec * .4, rr = T.r * (1.02 + .06 * Math.sin(i * .9 + sec * 2)); pts.push({ x: Math.cos(an) * rr, y: Math.sin(an) * rr * .9 + (i / 26 - .5) * T.r * .3 }); }
    const ca = a.v * c01(k * 2 - 1);
    set(P, coil, { x: T.x, y: T.y, pts, so: ca * .95 }); set(P, coilO, { x: T.x, y: T.y, pts, so: ca * .9 });
  }, { every: 33, appear: 350, fade: 900 });
}
// Присвоение: глаз в шестиграннике над целью
function appro(G, { tok, boss }) {
  const F = follower(G), D = DPI, w = D * .3;
  const hx = poly({ pts: hexPts(w * 1.35), stroke: CY2, so: 0, sw: D * .03, fill: NAVY, fo: 0 });
  const hx2 = poly({ pts: hexPts(w * 1.6), stroke: CY, so: 0, sw: D * .015 }); hx2.style.strokeDash = [D * .08, D * .06];
  const ey = poly({ pts: eyeShape({ x: 0, y: 0 }, w), stroke: WH, so: 0, sw: D * .025, fill: CY, fo: 0, tension: .2 });
  const ir = circle({ r: w * .3, fill: CY2, fo: 0 }), pu = poly({ pts: ringPts(1, 12).map(p => ({ x: p.x * w * .07, y: p.y * w * .26 })), fill: NAVY, fo: 0 });
  const th = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY, so: 0, sw: D * .015 });
  const items = [th, hx2, hx, ey, ir, pu];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const v = a.v, c = { x: T.x, y: T.y - T.r - D * .45 + Math.sin(sec * 1.8) * D * .04 }, blink = (sec % 4) > 3.85 ? .1 : 1;
    set(P, hx, { x: c.x, y: c.y, r: sec * 20, so: v, fo: v * .65 }); set(P, hx2, { x: c.x, y: c.y, r: -sec * 35, so: v * .7 });
    set(P, ey, { x: c.x, y: c.y, sy: blink, sx: 1, so: v, fo: v * .25 });
    const look = { x: Math.sin(sec * .9) * w * .25, y: 0 };
    set(P, ir, { x: c.x + look.x, y: c.y, fo: v * blink, s: 1 }); set(P, pu, { x: c.x + look.x, y: c.y, fo: v * blink });
    const B = F(boss);
    set(P, th, B ? { pts: [{ x: B.x, y: B.y - B.r * .55 }, c], so: v * (.12 + .1 * Math.sin(sec * 4)) } : { so: 0 });
  }, { every: 33 });
}
// Линза (провал): оранжевые трещины на боссе и звёзды оглушения
function stun(G, { tok }) {
  const F = follower(G), D = DPI;
  const halo = circle({ r: 1, fill: LENS, fo: 0 });
  const cr = crackSet(1, 8).map(path => ({ g: line({ pts: path, stroke: LENS, so: 0, sw: D * .06 }), k: line({ pts: path, stroke: "#FFE2C4", so: 0, sw: D * .018 }) }));
  const stars = [0, 1, 2].map(() => poly({ pts: starPts(D * .14, D * .055, 4), fill: LENS2, fo: 0, stroke: WH, so: 0, sw: D * .01 }));
  const items = [halo, ...cr.flatMap(c => [c.g, c.k]), ...stars];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const v = a.v, fl = .7 + .3 * Math.sin(sec * 7) * Math.sin(sec * 2.3);
    set(P, halo, { x: T.x, y: T.y, s: T.r * 1.1, fo: v * .1 * fl });
    cr.forEach(c => { set(P, c.g, { x: T.x, y: T.y, s: T.r * 1.05, sw: D * .06 / (T.r * 1.05), so: v * .45 * fl }); set(P, c.k, { x: T.x, y: T.y, s: T.r * 1.05, sw: D * .018 / (T.r * 1.05), so: v * .8 * fl }); });
    stars.forEach((it, k) => { const an = sec * 2.2 + k * TAU / 3; set(P, it, { x: T.x + Math.cos(an) * T.r * .6, y: T.y - T.r * .9 + Math.sin(an) * T.r * .18, r: sec * 200, fo: v * (.7 + .3 * Math.sin(an)), so: v }); });
  }, { every: 33 });
}
// Линза (успех): разомкнутый барьер и значок «без реакций»
function open(G, { tok }) {
  const F = follower(G), D = DPI;
  const segs = [0, 1, 2, 3, 4, 5].map(k => line({ pts: arcPts({ x: 0, y: 0 }, 1, k * TAU / 6 + .12, (k + 1) * TAU / 6 - .12, 6), stroke: LENS2, so: 0, sw: D * .04 }));
  const g = noReactGlyph(LENS2, D * .22);
  const items = [...segs, ...g.items];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    segs.forEach((it, k) => set(P, it, { x: T.x, y: T.y, s: T.r * 1.15, sw: D * .04 / (T.r * 1.15), r: sec * 12, so: a.v * (Math.random() < .12 ? .1 : .55) }));
    g.draw(P, { x: T.x, y: T.y - T.r - D * .4 + Math.sin(sec * 2) * D * .04 }, a.v);
  }, { every: 40 });
}
// Перекалибровка: оболочка из сот цвета стихии
function recal(G, { tok, col }) {
  const F = follower(G), D = DPI, n = 14;
  const ring = circle({ r: 1, stroke: col, so: 0, sw: D * .03, fill: col, fo: 0 });
  const hx = Array.from({ length: n }, (_, i) => poly({ pts: hexPts(.13, 0, Math.cos(i / n * TAU) * 1.12, Math.sin(i / n * TAU) * 1.12), stroke: col, so: 0, sw: D * .02, fill: col, fo: 0 }));
  const items = [ring, ...hx];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const v = a.v;
    set(P, ring, { x: T.x, y: T.y, s: T.r * 1.02, sw: D * .03 / T.r, so: v * .5, fo: v * (.06 + .03 * Math.sin(sec * 2)) });
    hx.forEach((it, i) => set(P, it, { x: T.x, y: T.y, s: T.r, sw: D * .02 / T.r, r: sec * 10, so: v * (.4 + .4 * Math.sin(sec * 3 + i)), fo: v * .12 }));
  }, { every: 40 });
}
// Обнажённое ядро: пульсирующий свет из груди и лучи
function core(G, { tok }) {
  const F = follower(G), D = DPI;
  const glow = circle({ r: 1, fill: CY, fo: 0 }), c = circle({ r: 1, fill: WH, fo: 0, stroke: CY2, so: 0, sw: D * .04 });
  const rays = Array.from({ length: 10 }, (_, i) => line({ pts: [V.pol({ x: 0, y: 0 }, .35, i / 10 * TAU), V.pol({ x: 0, y: 0 }, i % 2 ? 1.2 : 1.6, i / 10 * TAU)], stroke: i % 2 ? WH : CY2, so: 0, sw: D * .05 }));
  const items = [glow, ...rays, c];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const v = a.v, pu = .5 + .5 * Math.sin(sec * 4);
    set(P, glow, { x: T.x, y: T.y, s: T.r * (1 + .15 * pu), fo: v * (.15 + .1 * pu) });
    set(P, c, { x: T.x, y: T.y, s: T.r * (.18 + .05 * pu), sw: D * .04 / (T.r * .2), fo: v * .95, so: v });
    rays.forEach((it, i) => set(P, it, { x: T.x, y: T.y, s: T.r, sw: D * .05 / T.r, r: sec * 15, so: v * (.25 + .4 * Math.abs(Math.sin(sec * 3 + i))) }));
  }, { every: 33 });
}

// ──────────────────── Ключи и Протоколы ────────────────────
// Горящий Ключ: пульсирующее ядро, два вращающихся кольца, шестигранная рамка, мерцающие лучи
function keyGlow(G, { tok, col, dim }) {
  const F = follower(G), D = DPI;
  const halo = circle({ r: 1, fill: col, fo: 0 }), halo2 = circle({ r: 1, fill: col, fo: 0 });
  const core = circle({ r: 1, fill: WH, fo: 0 });
  const r1 = circle({ r: 1, stroke: col, so: 0, sw: D * .04, n: 60 }), r2 = circle({ r: 1, stroke: WH, so: 0, sw: D * .02, n: 60 });
  r1.style.strokeDash = [D * .22, D * .12]; r2.style.strokeDash = [D * .06, D * .14];
  const hx = poly({ pts: hexPts(1), stroke: col, so: 0, sw: D * .035 });
  const rays = Array.from({ length: 8 }, (_, i) => line({ pts: [V.pol({ x: 0, y: 0 }, 1.25, i / 8 * TAU), V.pol({ x: 0, y: 0 }, i % 2 ? 1.6 : 1.9, i / 8 * TAU)], stroke: i % 2 ? WH : col, so: 0, sw: D * .04 }));
  const items = [halo2, halo, ...rays, hx, r1, r2, core];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const R = Math.max(T.r, D * .5), v = a.v * (dim ? .35 : 1), pu = .5 + .5 * Math.sin(sec * 3.2);
    set(P, halo2, { x: T.x, y: T.y, s: R * (2.4 + .3 * pu), fo: v * .08 });
    set(P, halo, { x: T.x, y: T.y, s: R * (1.5 + .15 * pu), fo: v * (.16 + .1 * pu) });
    set(P, core, { x: T.x, y: T.y, s: R * (.35 + .1 * pu), fo: v * (.3 + .2 * pu) });
    set(P, r1, { x: T.x, y: T.y, s: R * 1.3, sw: D * .04 / (R * 1.3), r: sec * 40, so: v * .85 });
    set(P, r2, { x: T.x, y: T.y, s: R * 1.42, sw: D * .02 / (R * 1.42), r: -sec * 60, so: v * .7 });
    set(P, hx, { x: T.x, y: T.y, s: R * 1.12, sw: D * .035 / (R * 1.12), r: sec * 8, so: v * (.6 + .3 * pu) });
    rays.forEach((it, i) => set(P, it, { x: T.x, y: T.y, s: R, sw: D * .04 / R, r: -sec * 12, so: v * (Math.random() < .25 ? .15 : .75) }));
  }, { every: 33 });
}
// Вены: светящиеся линии от босса к целым Ключам (источник Барьера)
function veins(G, { boss, keys, dim }) {
  const F = follower(G), D = DPI;
  const per = keys.map(() => ({ g: line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY, so: 0, sw: D * .16, layer: "DRAWING" }), k: line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY2, so: 0, sw: D * .025, layer: "DRAWING" }), p: circle({ r: D * .07, fill: WH, fo: 0 }), ph: Math.random(), last: 0, pts: null }));
  const items = per.flatMap(o => [o.g, o.k, o.p]);
  return loop(items, (sec, P, a) => {
    const B = F(boss); if (!B) return hide(P, items);
    const v = a.v * (dim ? .15 : 1);
    keys.forEach((id, i) => {
      const o = per[i], K = F(id); if (!K) { set(P, o.g, { so: 0 }); set(P, o.k, { so: 0 }); set(P, o.p, { fo: 0 }); return; }
      const S = V.pol(B, B.r * .8, V.ang(B, K)), E = V.pol(K, K.r * .8, V.ang(K, B));
      if (!o.pts || sec - o.last > .3) { o.pts = boltPts(S, E, .02, Math.max(6, Math.round(V.dist(S, E) / D))); o.last = sec; o.S = S; o.E = E; }
      const dS = V.sub(S, o.S), dE = V.sub(E, o.E), n = o.pts.length - 1;
      const pts = o.pts.map((p, j) => V.add(p, V.lerp(dS, dE, j / n)));
      set(P, o.g, { pts, so: v * (.08 + .04 * Math.sin(sec * 2 + i)) });
      set(P, o.k, { pts, so: v * (.35 + .2 * Math.sin(sec * 3 + i)) });
      const u = (sec * .45 + o.ph) % 1, q = V.lerp(S, E, u);
      set(P, o.p, { x: q.x, y: q.y, fo: dim ? 0 : a.v * Math.sin(u * Math.PI) * .9 });
    });
  }, { every: 40 });
}
// Протокол Разделения: сияющая стена силы между точками a и b, растёт от Ключа
function wall(G, { a: A, b: Bp, tok, col }) {
  const D = DPI, len = V.dist(A, Bp), dir = V.norm(V.sub(Bp, A)), nn = V.perp(dir);
  const K = tok && G(tok);
  let t0 = .5; if (K) t0 = c01(((K.x - A.x) * dir.x + (K.y - A.y) * dir.y) / (len || 1));
  const glow = line({ pts: [A, Bp], stroke: col, so: 0, sw: D * .9 }), glow2 = line({ pts: [A, Bp], stroke: col, so: 0, sw: D * .4 });
  const core = line({ pts: [A, Bp], stroke: WH, so: 0, sw: D * .1 });
  const e1 = line({ pts: [A, Bp], stroke: col, so: 0, sw: D * .03 }), e2 = line({ pts: [A, Bp], stroke: col, so: 0, sw: D * .03 });
  const n = Math.max(4, Math.min(60, Math.round(len / (D * .5))));
  const tiles = Array.from({ length: n }, (_, i) => ({ u: (i + .5) / n, it: poly({ pts: hexPts(D * .2), stroke: WH, so: 0, sw: D * .015, fill: col, fo: 0 }), ph: rnd(0, TAU) }));
  const motes = Array.from({ length: 12 }, () => ({ it: circle({ r: D * .05, fill: WH, fo: 0 }), u: Math.random(), sp: rnd(.05, .15) * (Math.random() < .5 ? -1 : 1), o: rnd(-1, 1) }));
  const caps = [0, 1].map(() => circle({ r: D * .22, fill: col, fo: 0, stroke: WH, so: 0, sw: D * .03 }));
  const items = [glow, glow2, e1, e2, ...tiles.map(t => t.it), core, ...motes.map(m => m.it), ...caps];
  const at = u => V.lerp(A, Bp, u);
  return loop(items, (sec, P, a) => {
    const g = out2(c01(sec / 1.2)), u0 = t0 * (1 - g), u1 = t0 + (1 - t0) * g, v = a.v, fl = .85 + .15 * Math.sin(sec * 9) * Math.sin(sec * 3.1);
    const p0 = at(u0), p1 = at(u1);
    set(P, glow, { pts: [p0, p1], so: v * .12 * fl }); set(P, glow2, { pts: [p0, p1], so: v * .22 * fl }); set(P, core, { pts: [p0, p1], so: v * .9 * fl });
    const off = D * .3 + Math.sin(sec * 2) * D * .03;
    set(P, e1, { pts: [V.add(p0, V.mul(nn, off)), V.add(p1, V.mul(nn, off))], so: v * .55 }); set(P, e2, { pts: [V.sub(p0, V.mul(nn, off)), V.sub(p1, V.mul(nn, off))], so: v * .55 });
    tiles.forEach(t => { const on = t.u >= u0 && t.u <= u1, q = at(t.u), f = .5 + .5 * Math.sin(sec * 2.5 + t.ph); set(P, t.it, { x: q.x, y: q.y, r: sec * 20, fo: on ? v * .2 * f : 0, so: on ? v * (.25 + .5 * f) : 0 }); });
    motes.forEach(m => { const u = ((m.u + sec * m.sp) % 1 + 1) % 1, on = u >= u0 && u <= u1, q = V.add(at(u), V.mul(nn, m.o * D * .2)); set(P, m.it, { x: q.x, y: q.y, fo: on ? v * (.5 + .5 * Math.sin(sec * 6 + m.o * 5)) : 0 }); });
    set(P, caps[0], { x: p0.x, y: p0.y, fo: v * .5, so: v }); set(P, caps[1], { x: p1.x, y: p1.y, fo: v * .5, so: v });
  }, { every: 33 });
}
// Протокол Перестановки: искажённое пространство вокруг Ключа (две встречные гексаграммы)
function perm(G, { tok, col }) {
  const F = follower(G), D = DPI;
  const tri = k => [0, 1, 2].map(i => V.pol({ x: 0, y: 0 }, 1, -Math.PI / 2 + k * Math.PI + i * TAU / 3));
  const t = [0, 1, 2, 3].map(k => poly({ pts: tri(k % 2), stroke: k < 2 ? col : "#E0C2FF", so: 0, sw: D * .03 }));
  const orb = Array.from({ length: 6 }, () => circle({ r: D * .06, fill: "#E0C2FF", fo: 0 }));
  const items = [...t, ...orb];
  return loop(items, (sec, P, a) => {
    const T = F(tok); if (!T) return hide(P, items);
    const R = Math.max(T.r, D * .5) * 2.2, v = a.v;
    t.forEach((it, k) => set(P, it, { x: T.x, y: T.y, s: R * (k < 2 ? 1 : .7), sw: D * .03 / (R * (k < 2 ? 1 : .7)), r: (k < 2 ? 1 : -1.6) * sec * 18, so: v * (.35 + .25 * Math.sin(sec * 2 + k)) }));
    orb.forEach((it, i) => { const an = -sec * 1.3 + i * TAU / 6, rr = R * (1.05 + .1 * Math.sin(sec * 3 + i)); set(P, it, { x: T.x + Math.cos(an) * rr, y: T.y + Math.sin(an) * rr, fo: v * .8 }); });
  }, { every: 33 });
}
// Протокол Петли: золотые призраки запомненных позиций + циферблат у Ключа
function loopViz(G, { tok, col, snap }) {
  const F = follower(G), D = DPI;
  const gh = (snap || []).map(s => {
    const ring = circle({ x: s.x, y: s.y, r: s.r * 1.02, stroke: col, so: 0, sw: D * .035, fill: col, fo: 0, layer: "DRAWING" });
    ring.style.strokeDash = [D * .14, D * .1];
    const hand = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: -s.r * .6 }], stroke: col, so: 0, sw: D * .03, layer: "DRAWING" });
    const th = line({ pts: [s, s], stroke: col, so: 0, sw: D * .015 }); th.style.strokeDash = [D * .06, D * .1];
    return { s, ring, hand, th };
  });
  const dial = circle({ r: 1, stroke: col, so: 0, sw: D * .04, fill: col, fo: 0, n: 60 });
  const rune = circle({ r: 1, stroke: col, so: 0, sw: D * .02, n: 60 }); rune.style.strokeDash = [D * .05, D * .08, D * .15, D * .08];
  const ticks = clockTicks({ x: 0, y: 0 }, 1).map(t => line({ pts: t, stroke: col, so: 0, sw: D * .03 }));
  const hm = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: -.85 }], stroke: WH, so: 0, sw: D * .04 }), hh = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: -.55 }], stroke: col, so: 0, sw: D * .06 });
  const items = [...gh.flatMap(g => [g.ring, g.hand, g.th]), dial, rune, ...ticks, hh, hm];
  return loop(items, (sec, P, a) => {
    const v = a.v;
    gh.forEach((g, i) => {
      const f = .55 + .25 * Math.sin(sec * 2 + i);
      set(P, g.ring, { so: v * f, fo: v * .06, r: sec * 15 });
      set(P, g.hand, { x: g.s.x, y: g.s.y, r: -sec * 90, so: v * .6 });
      const C = G(g.s.id);
      set(P, g.th, C && C.vis !== false && V.dist(C, g.s) > g.s.r * .8 ? { pts: [C, g.s], so: v * .35 } : { so: 0 });
    });
    const K = F(tok);
    if (!K) return hide(P, [dial, rune, ...ticks, hh, hm]);
    const R = Math.max(K.r * 2.4, D * 1.8), sw = w => w / R;
    set(P, dial, { x: K.x, y: K.y, s: R, sw: sw(D * .04), so: v * .8, fo: v * .05 });
    set(P, rune, { x: K.x, y: K.y, s: R * 1.12, sw: sw(D * .02) / 1.12, r: sec * 10, so: v * .6 });
    ticks.forEach(t => set(P, t, { x: K.x, y: K.y, s: R, sw: sw(D * .03), so: v * .75 }));
    set(P, hm, { x: K.x, y: K.y, s: R, sw: sw(D * .04), r: sec * 72, so: v });
    set(P, hh, { x: K.x, y: K.y, s: R, sw: sw(D * .06), r: sec * 6, so: v });
  }, { every: 40 });
}
// Протокол Тишины: тёмные волны расходятся по арене, над Ключом — знак тишины
function silence(G, { tok, col, glow }) {
  const F = follower(G), D = DPI;
  const rip = [0, 1, 2].map(() => circle({ r: 1, fill: col, fo: 0, stroke: glow, so: 0, sw: D * .05, layer: "DRAWING", n: 64 }));
  const bg = circle({ r: D * .3, fill: NAVY, fo: 0, stroke: glow, so: 0, sw: D * .03 });
  const spk = poly({ pts: [{ x: -.5, y: -.2 }, { x: -.2, y: -.2 }, { x: .1, y: -.5 }, { x: .1, y: .5 }, { x: -.2, y: .2 }, { x: -.5, y: .2 }].map(p => ({ x: p.x * D * .3, y: p.y * D * .3 })), fill: glow, fo: 0 });
  const waves = [1, 2].map(k => line({ pts: arcPts({ x: D * .02, y: 0 }, D * .1 * k, -.8, .8, 8), stroke: glow, so: 0, sw: D * .025 }));
  const sl = line({ pts: [{ x: -D * .2, y: -D * .2 }, { x: D * .2, y: D * .2 }], stroke: "#FF6B6B", so: 0, sw: D * .04 });
  const items = [...rip, bg, spk, ...waves, sl];
  return loop(items, (sec, P, a) => {
    const K = F(tok); if (!K) return hide(P, items);
    const v = a.v, Rm = D * 9;
    rip.forEach((it, k) => { const ph = ((sec / 3) + k / 3) % 1, rr = Math.max(K.r, D * .5) + ph * Rm; set(P, it, { x: K.x, y: K.y, s: rr, sw: D * .05 / rr, fo: v * .12 * (1 - ph), so: v * .55 * (1 - ph) }); });
    const c = { x: K.x, y: K.y - Math.max(K.r, D * .5) - D * .45 + Math.sin(sec * 2) * D * .04 };
    set(P, bg, { x: c.x, y: c.y, fo: v * .7, so: v }); set(P, spk, { x: c.x, y: c.y, fo: v });
    waves.forEach(w => set(P, w, { x: c.x, y: c.y, so: v * .25 })); set(P, sl, { x: c.x, y: c.y, so: v });
  }, { every: 40 });
}

// Реестр: kind → функция(G, параметры) → циклическая анимация
export const AURA = { nets, weave: web, charge, grab, appro, stun, open, recal, core, keyGlow, veins, wall, perm, loop: loopViz, silence };
