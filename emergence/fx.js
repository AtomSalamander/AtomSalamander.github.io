// Одноразовые анимации способностей Эмерджентности. Всё рисуется векторно локальными объектами.
// Координаты — в пикселях сцены; токен = {x, y, r}.
import {
  DPI, TAU, V, c01, out3, out2, in2, inOut, backOut, lerp, rnd, env, seg, bez, spawn,
  poly, line, circle, ringPts, ellPts, hexPts, arcPts, starPts, shardPts, boltPts, crackSet, partial, offs,
} from "./engine.js";
import { PAL } from "./const.js";

const { cy: CY, cy2: CY2, navy: NAVY, white: WH, bone: BONE, bone2: BONE2, boneDk: BONEDK, lens: LENS, lens2: LENS2 } = PAL;
const set = (P, it, q) => P.set(it.id, q);
const once = (delay, dur, items, f) => spawn(delay, items, { dur, f });

// ──────────────────────── базовые эффекты ────────────────────────
export function flash(c, R, col = CY, dur = 650, d = 0, peak = .85) {
  const g = circle({ x: c.x, y: c.y, r: R, fill: col, fo: 0 });
  const k = circle({ x: c.x, y: c.y, r: R * .45, fill: WH, fo: 0 });
  return once(d, dur, [g, k], (p, P) => {
    const a = Math.pow(1 - p, 2) * peak;
    set(P, g, { s: lerp(.35, 1.15, out3(p)), fo: a * .7 });
    set(P, k, { s: lerp(.5, 1.3, out3(p)), fo: a });
  });
}
export function shock(c, R, col = CY, dur = 700, d = 0, w = 1) {
  const r = circle({ x: c.x, y: c.y, r: R, stroke: col, so: 0, sw: DPI * .09 * w });
  const r2 = circle({ x: c.x, y: c.y, r: R, stroke: WH, so: 0, sw: DPI * .025 * w });
  return once(d, dur, [r, r2], (p, P) => {
    const s = lerp(.08, 1, out3(p)), a = 1 - p;
    set(P, r, { s, so: a * .75, sw: DPI * .09 * w * (1 - p * .7) / Math.max(.2, s) });
    set(P, r2, { s: s * .985, so: a * .9, sw: DPI * .025 * w / Math.max(.2, s) });
  });
}
export function sparks(c, n, R, cols = [CY, CY2, WH], dur = 900, d = 0, o = {}) {
  const its = [], v = [];
  for (let i = 0; i < n; i++) {
    const a = o.dir != null ? o.dir + rnd(-1, 1) * (o.spread ?? .6) : rnd(0, TAU), sz = DPI * rnd(.035, .08) * (o.size || 1);
    its.push(poly({ x: c.x, y: c.y, pts: starPts(sz, sz * .3, 2, rnd(0, TAU)), fill: cols[i % cols.length], fo: 0 }));
    v.push({ a, r: R * rnd(.4, 1.1), sp: rnd(-6, 6), up: o.up ? R * rnd(.3, .9) : 0 });
  }
  return once(d, dur, its, (p, P) => {
    its.forEach((it, i) => {
      const q = v[i], e = out2(p), r = q.r * e;
      set(P, it, { x: c.x + Math.cos(q.a) * r, y: c.y + Math.sin(q.a) * r - q.up * e, r: q.sp * p * 57, fo: env(p, .05, .6) * .95, s: 1 - p * .5 });
    });
  });
}
export function shards(c, n, R, col = CY2, dur = 1000, d = 0, o = {}) {
  const its = [], v = [];
  for (let i = 0; i < n; i++) {
    its.push(poly({ x: c.x, y: c.y, pts: shardPts(DPI * rnd(.06, .16) * (o.size || 1)), fill: i % 3 ? col : WH, fo: 0, stroke: WH, so: 0, sw: DPI * .01 }));
    v.push({ a: o.dir != null ? o.dir + rnd(-1, 1) * (o.spread ?? .7) : rnd(0, TAU), r: R * rnd(.4, 1.1), sp: rnd(-300, 300) });
  }
  return once(d, dur, its, (p, P) => {
    its.forEach((it, i) => {
      const q = v[i], r = q.r * out3(p);
      set(P, it, { x: c.x + Math.cos(q.a) * r, y: c.y + Math.sin(q.a) * r, r: q.sp * p, fo: env(p, .04, .5) * .75, so: env(p, .04, .5) * .8 });
    });
  });
}
export function cracks(c, R, col = CY, dur = 1400, d = 0, o = {}) {
  const its = [];
  for (const path of crackSet(R, o.n || 7)) {
    const abs = offs(path, c);
    its.push({ g: line({ pts: abs, stroke: col, so: 0, sw: DPI * .08 * (o.w || 1), layer: o.layer }), k: line({ pts: abs, stroke: WH, so: 0, sw: DPI * .02 * (o.w || 1), layer: o.layer }), abs });
  }
  return once(d, dur, its.flatMap(i => [i.g, i.k]), (p, P) => {
    const g = out3(seg(p, 0, o.grow ?? .3)), a = p > .6 ? (1 - p) / .4 : 1;
    for (const i of its) { const pts = partial(i.abs, g); set(P, i.g, { pts, so: a * .45 }); set(P, i.k, { pts, so: a * .95 }); }
  });
}
export function bolt(A, B, col = CY, dur = 400, d = 0, w = 1, jag = .16) {
  const g = line({ pts: [A, B], stroke: col, so: 0, sw: DPI * .14 * w }), k = line({ pts: [A, B], stroke: WH, so: 0, sw: DPI * .035 * w });
  return once(d, dur, [g, k], (p, P) => {
    const pts = boltPts(A, B, jag, 9), f = (Math.random() * .4 + .6) * env(p, .05, .4);
    set(P, g, { pts, so: f * .5 }); set(P, k, { pts, so: f });
  });
}
// Шестигранный щит (соты внутри круга)
export function hexLattice(R, s) {
  const out = [], w = Math.sqrt(3) * s, n = Math.ceil(R / s) + 1;
  for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++) {
    const x = w * (q + r / 2), y = 1.5 * s * r;
    if (Math.hypot(x, y) <= R - s * .4) out.push({ x, y });
  }
  return out;
}
export function hexShield(c, R, col = CY, dur = 800, d = 0) {
  const s = Math.max(R / 3.2, DPI * .16), its = [];
  const ring = circle({ x: c.x, y: c.y, r: R, fill: col, fo: 0, stroke: WH, so: 0, sw: DPI * .03 });
  for (const h of hexLattice(R, s)) its.push({ it: poly({ x: c.x, y: c.y, pts: hexPts(s * .92, 0, h.x, h.y), fill: col, fo: 0, stroke: CY2, so: 0, sw: DPI * .015 }), d: Math.hypot(h.x, h.y) / R });
  return once(d, dur, [ring, ...its.map(i => i.it)], (p, P) => {
    set(P, ring, { fo: env(p, .1, .6) * .12, so: env(p, .1, .6) * .8, s: lerp(.9, 1.04, out3(p)) });
    for (const i of its) { const a = env(c01(p * 1.25 - i.d * .25), .15, .6); set(P, i.it, { fo: a * .16, so: a * .8 }); }
  });
}
// Разлом: тёмная дыра с голубой кромкой (как дыра в груди на арте)
export function rift(c, R, dur, d = 0, open = .12, close = .15) {
  const glow = circle({ x: c.x, y: c.y, r: R * 1.5, fill: CY, fo: 0 });
  const hole = circle({ x: c.x, y: c.y, r: R, fill: "#02060F", fo: 0, stroke: CY2, so: 0, sw: DPI * .05 });
  const rim = circle({ x: c.x, y: c.y, r: R * 1.12, stroke: CY, so: 0, sw: DPI * .03, n: 36 });
  rim.style.strokeDash = [DPI * .12, DPI * .08];
  return once(d, dur, [glow, hole, rim], (p, P) => {
    const a = p < open ? out3(p / open) : p > 1 - close ? 1 - in2((p - (1 - close)) / close) : 1;
    set(P, glow, { s: a, fo: a * (.18 + Math.random() * .06) });
    set(P, hole, { s: a, fo: a * .92, so: a });
    set(P, rim, { s: a, so: a * .8, r: p * 200 });
  });
}

// ──────────────────────── скелетная рука ────────────────────────
// Кость: сужающаяся форма с утолщениями на суставах
function bonePts(a, b, wa, wb) {
  const d = V.norm(V.sub(b, a)), n = V.perp(d), m1 = V.lerp(a, b, .3), m2 = V.lerp(a, b, .7), k = DPI * .05;
  const P = (o, nn, w) => ({ x: o.x + n.x * nn * w, y: o.y + n.y * nn * w });
  return [
    V.sub(a, V.mul(d, k)), P(a, .5, wa), P(m1, .3, wa), P(m2, .3, wb), P(b, .5, wb), V.add(b, V.mul(d, k)),
    P(b, -.5, wb), P(m2, -.3, wb), P(m1, -.3, wa), P(a, -.5, wa),
  ];
}
// Кисть в локальных координатах (x — вперёд). curl 0 — раскрыта, 1 — кулак.
function handGeom(W, ang, H, curl, t, side) {
  const T = p => { const q = V.rot({ x: p.x * H, y: p.y * H * side }, ang); return { x: W.x + q.x, y: W.y + q.y }; };
  const palm = [[-.1, -.18], [.1, -.25], [.33, -.25], [.42, -.1], [.43, .06], [.36, .23], [.12, .26], [-.1, .18]].map(([x, y]) => T({ x, y }));
  const fingers = [], tips = [];
  const by = [-.2, -.07, .07, .2], lenK = [.88, 1.08, 1.0, .8], spread = [-.24, -.08, .08, .24];
  for (let f = 0; f < 4; f++) {
    let p = { x: .4 - Math.abs(by[f]) * .15, y: by[f] }; const pts = [T(p)];
    const a0 = spread[f] * (1 - curl * .8) + Math.sin(t * 5 + f) * .05 * (1 - curl);
    const L = [.36, .3, .24], bend = [1.15, 2.25, 2.95];
    for (let k = 0; k < 3; k++) {
      const th = curl * bend[k] + (1 - curl) * .08 * (k + 1), l = L[k] * lenK[f] * Math.cos(th);
      p = { x: p.x + Math.cos(a0) * l, y: p.y + Math.sin(a0) * l + curl * .02 * (f - 1.5) };
      pts.push(T(p));
    }
    fingers.push(pts); tips.push(pts[pts.length - 1]);
  }
  // большой палец
  let p = { x: .08, y: -.24 }; const th = [T(p)];
  const ta = lerp(-1.05, -.25, curl);
  for (const [l, b] of [[.28, .5], [.22, 1.4]]) { const ll = l * Math.cos(curl * b); p = { x: p.x + Math.cos(ta) * ll, y: p.y + Math.sin(ta) * ll }; th.push(T(p)); }
  fingers.push(th); tips.push(th[th.length - 1]);
  return { palm, fingers, tips };
}

// Касание Системы: из разлома рядом с боссом вырастает четырёхсуставная костяная рука, сжимает кулак и бьёт.
// v: "fail" — попала и спасбросок провален (нити висят отдельным эффектом), "ok" — попала, спасбросок успешен, "miss" — промах
export function touch(B, T, v = "fail") {
  const D = DPI, DUR = 3600;
  const dir = V.norm(V.sub(T, B)), side = Math.random() < .5 ? -1 : 1, nrm = V.perp(dir);
  const H = Math.max(D * .8, T.r * 1.15);
  let E = { x: T.x, y: T.y };
  if (v === "miss") E = V.add(E, V.mul(nrm, side * (T.r + H * .8)));
  const S = V.add(B, V.add(V.mul(dir, B.r * .7), V.mul(nrm, side * B.r * .45)));
  const W1 = V.sub(E, V.mul(dir, H * .5)), W0 = V.sub(W1, V.mul(dir, H * .7));
  const L = V.dist(S, W1), C = V.add(V.lerp(S, W1, .45), V.mul(nrm, side * Math.min(L * .35, D * 4)));
  const its = [];
  const mk = o => { const it = o.closed === false ? line(o) : poly(o); its.push(it); return it; };
  // кости плеча (снизу свечение)
  const bones = [];
  for (let i = 0; i < 4; i++) bones.push({
    glow: mk({ closed: false, stroke: CY, so: 0, sw: H * .9 }),
    b: mk({ fill: BONE, fo: 0, stroke: BONEDK, so: 0, sw: D * .03, tension: .35 }),
    hi: mk({ closed: false, stroke: "#F4FAFF", so: 0, sw: H * .05 }),
    vein: mk({ closed: false, stroke: CY2, so: 0, sw: D * .025 }),
  });
  const joints = [];
  for (let i = 1; i < 4; i++) joints.push({ j: mk({ fill: BONE2, fo: 0, stroke: BONEDK, so: 0, sw: D * .025, pts: ringPts(1, 20) }), c: mk({ fill: CY2, fo: 0, pts: ringPts(1, 14) }) });
  const hand = {
    glow: mk({ fill: CY, fo: 0, pts: ringPts(1, 28) }),
    palm: mk({ fill: BONE, fo: 0, stroke: BONEDK, so: 0, sw: D * .03, tension: .3 }),
    pv: [0, 1, 2].map(() => mk({ closed: false, stroke: CY2, so: 0, sw: D * .02 })),
    fo: [0, 1, 2, 3, 4].map(() => mk({ closed: false, stroke: BONEDK, so: 0, sw: H * .11, tension: .25 })),
    ff: [0, 1, 2, 3, 4].map(() => mk({ closed: false, stroke: BONE, so: 0, sw: H * .075, tension: .25 })),
    tip: [0, 1, 2, 3, 4].map(() => mk({ fill: CY2, fo: 0, pts: ringPts(1, 10) })),
    bolts: [0, 1, 2].map(() => mk({ closed: false, stroke: WH, so: 0, sw: D * .025 })),
  };
  const ms = p => p * DUR;
  once(0, DUR, its, (p, P) => {
    const t = ms(p), sec = t / 1000;
    const g = out3(seg(t, 250, 1250)), curl = inOut(seg(t, 1250, 1580)), pu = in2(seg(t, 1600, 1750));
    const recoil = t > 1750 && t < 2050 ? Math.sin(seg(t, 1750, 2050) * Math.PI) * H * .18 : 0;
    const dz = seg(t, 2350, 3350), shake = t > 1750 && t < 2300 ? (Math.random() - .5) * D * .04 : 0;
    const Wt = V.add(V.lerp(W0, W1, pu), V.mul(dir, -recoil + shake));
    const Cc = V.add(C, V.mul(V.sub(Wt, W1), .5));
    const J = [];
    for (let i = 0; i <= 4; i++) {
      const q = bez(S, Cc, Wt, g * i / 4), wig = Math.sin(sec * 5 + i * 1.4) * H * .07 * (i / 4) * (1 - curl * .6);
      J.push(V.add(q, V.mul(nrm, wig)));
    }
    const vis = idx => g <= .001 ? 0 : c01(1 - (dz * 1.5 - idx * .17) / .35);
    for (let i = 0; i < 4; i++) {
      const a = J[i], b = J[i + 1], wa = lerp(H * .5, H * .26, i / 4), wb = lerp(H * .5, H * .26, (i + 1) / 4) * .85;
      const al = vis(4 - i), O = bones[i];
      set(P, O.glow, { pts: [a, b], so: al * (.1 + .04 * Math.sin(sec * 9 + i)), sw: wa * 1.8 });
      set(P, O.b, { pts: bonePts(a, b, wa, wb), fo: al, so: al });
      const ofs = V.mul(V.perp(V.norm(V.sub(b, a))), wa * .12);
      set(P, O.hi, { pts: [V.add(V.lerp(a, b, .2), ofs), V.add(V.lerp(a, b, .8), ofs)], so: al * .45, sw: wa * .1 });
      set(P, O.vein, { pts: boltPts(V.lerp(a, b, .05), V.lerp(a, b, .95), .05, 6), so: al * (.55 + Math.random() * .4) });
    }
    joints.forEach((o, k) => {
      const i = k + 1, w = lerp(H * .5, H * .26, i / 4), al = vis(4 - i);
      set(P, o.j, { x: J[i].x, y: J[i].y, s: w * .45, fo: al, so: al });
      set(P, o.c, { x: J[i].x, y: J[i].y, s: w * .14 * (1 + .3 * Math.sin(sec * 8 + i)), fo: al * .9 });
    });
    const ang = V.ang(J[3], J[4]), hg = handGeom(J[4], ang, H, curl, sec, side), ah = vis(0) * c01(g * 3 - 1.6);
    const hc = V.pol(J[4], H * .28, ang);
    set(P, hand.glow, { x: hc.x, y: hc.y, s: H * (.75 + .1 * curl), fo: ah * (.1 + .12 * curl + (t > 1750 && t < 2300 ? .12 : 0)) });
    set(P, hand.palm, { pts: hg.palm, fo: ah, so: ah });
    hand.pv.forEach((it, k) => set(P, it, { pts: boltPts(J[4], hg.fingers[k + 1 > 3 ? 3 : k + 1][0], .06, 4), so: ah * (.5 + Math.random() * .4) }));
    hg.fingers.forEach((f, k) => { set(P, hand.fo[k], { pts: f, so: ah }); set(P, hand.ff[k], { pts: f, so: ah }); });
    hg.tips.forEach((tp, k) => set(P, hand.tip[k], { x: tp.x, y: tp.y, s: H * .045 * (1 + Math.random() * .5), fo: ah * (.5 + .5 * curl) }));
    const charged = t > 1500 && t < 2500;
    hand.bolts.forEach(it => {
      if (!charged || Math.random() < .35) { set(P, it, { so: 0 }); return; }
      const a1 = rnd(0, TAU), a2 = a1 + rnd(.8, 2.2);
      set(P, it, { pts: boltPts(V.pol(hc, H * .5, a1), V.pol(hc, H * .55, a2), .3, 6), so: ah * .9 });
    });
  });
  // разлом, из которого тянется рука
  rift(S, H * .55, 3500, 0, .08, .1);
  cracks(S, H * 1.2, CY, 1600, 120, { n: 6, w: .8 });
  // удар
  const hitAt = 1750;
  flash(E, Math.max(T.r * 1.5, H), v === "miss" ? CY : CY2, 700, hitAt);
  shock(E, Math.max(T.r * 2.6, H * 2.2), CY, 800, hitAt, 1.2);
  shock(E, Math.max(T.r * 1.8, H * 1.5), WH, 600, hitAt + 90, .6);
  cracks(E, Math.max(T.r * 1.9, H * 1.6), CY, 1800, hitAt, { layer: "DRAWING", n: 8 });
  sparks(E, 22, Math.max(T.r * 2.2, H * 1.8), [CY, CY2, WH], 1000, hitAt);
  shards(E, 10, Math.max(T.r * 2, H * 1.6), CY2, 1000, hitAt + 30);
  if (v === "ok") hexShield(T, T.r * 1.25, CY, 800, hitAt + 250);
  // рассыпание на искры от кисти к плечу
  for (let i = 0; i <= 4; i++) { const q = bez(S, C, W1, 1 - i / 4); sparks(q, 7, H * .9, [CY, CY2, WH], 900, 2350 + i * 170, { up: true, size: .8 }); }
}

// ──────────────────────── Плетение ────────────────────────
// У босса сплетается узел из нитей, летит к цели с шлейфом и опутывает её паутиной
export function weave(B, T, hit = true) {
  const D = DPI, dir = V.norm(V.sub(T, B)), nrm = V.perp(dir);
  const K = V.add(B, V.mul(dir, B.r + D * .6));
  const E = hit ? { x: T.x, y: T.y } : V.add(V.add(T, V.mul(nrm, (Math.random() < .5 ? -1 : 1) * (T.r + D * 1.2))), V.mul(dir, D * 2));
  const fly = Math.min(900, Math.max(380, V.dist(K, E) / D * 40)), t1 = 950, t2 = t1 + fly, DUR = t2 + 150;
  const threads = [], ribbons = [];
  for (let i = 0; i < 7; i++) threads.push({ it: line({ pts: [K, K], stroke: i % 2 ? CY2 : CY, so: 0, sw: D * .025, tension: .5 }), rot: i / 7 * Math.PI, sp: rnd(1.5, 3) * (i % 2 ? 1 : -1) });
  const glow = circle({ x: K.x, y: K.y, r: D * .5, fill: CY, fo: 0 }), orb = circle({ x: K.x, y: K.y, r: D * .2, fill: CY2, fo: 0, stroke: WH, so: 0, sw: D * .025 }), core = circle({ x: K.x, y: K.y, r: D * .09, fill: WH, fo: 0 });
  for (let k = 0; k < 3; k++) ribbons.push(line({ pts: [K, K], stroke: k ? CY : CY2, so: 0, sw: D * (k ? .025 : .04), tension: .5 }));
  const path = s => V.lerp(K, E, out2(c01(s)));
  once(0, DUR, [...threads.map(t => t.it), ...ribbons, glow, orb, core], (p, P) => {
    const t = p * DUR, sec = t / 1000;
    if (t < t1) {
      const k = seg(t, 0, t1), rx = lerp(D * 1.4, D * .22, out2(k));
      threads.forEach((o, i) => set(P, o.it, { pts: ellPts(rx * (1 - i * .04), rx * .32, o.rot + sec * o.sp, 28, K.x, K.y).concat([]), so: env(k, .15, .1) * .85 }));
      const a = out3(k);
      set(P, glow, { x: K.x, y: K.y, s: .4 + a * .9 + .1 * Math.sin(sec * 20), fo: a * .25 });
      set(P, orb, { x: K.x, y: K.y, s: .3 + a * .8, fo: a * .8, so: a });
      set(P, core, { x: K.x, y: K.y, s: .3 + a, fo: a });
      ribbons.forEach(r => set(P, r, { so: 0 }));
    } else {
      const f = seg(t, t1, t2), h = path(f);
      threads.forEach(o => set(P, o.it, { so: 0 }));
      set(P, glow, { x: h.x, y: h.y, s: 1.1, fo: .25 }); set(P, orb, { x: h.x, y: h.y, s: 1.1, fo: .85, so: 1 }); set(P, core, { x: h.x, y: h.y, s: 1.2, fo: 1 });
      ribbons.forEach((r, k) => {
        const pts = [];
        for (let j = 0; j <= 10; j++) { const s = f - j * .04, b = path(s), amp = D * .16 * (j / 10) * (1 + k * .3); pts.push(V.add(b, V.mul(nrm, Math.sin(s * 26 + k * 2.1 + sec * 10) * amp))); }
        set(P, r, { pts, so: .85 - k * .15 });
      });
    }
  });
  if (hit) {
    flash(T, T.r * 1.5, CY2, 650, t2 - 30);
    webWrap(T, t2);
    sparks(T, 14, T.r * 2, [CY, CY2, WH], 800, t2);
  } else {
    sparks(E, 16, D * 1.4, [CY, CY2, WH], 800, t2 - 20);
    shock(E, D * 1.1, CY, 500, t2 - 20, .6);
  }
}
// Паутина сжимается вокруг цели
function webWrap(T, d) {
  const D = DPI, R0 = T.r * 2.1, R1 = T.r * 1.02, spokes = [], rings = [];
  for (let i = 0; i < 10; i++) spokes.push({ it: line({ pts: [T, T], stroke: CY2, so: 0, sw: D * .022 }), a: i / 10 * TAU + rnd(-.1, .1) });
  for (let k = 1; k <= 3; k++) rings.push(line({ pts: [T, T], stroke: k === 3 ? WH : CY, so: 0, sw: D * .02, tension: .45 }));
  once(d, 1300, [...spokes.map(s => s.it), ...rings], (p, P) => {
    const R = lerp(R0, R1, out3(seg(p, 0, .55))), a = p > .7 ? (1 - p) / .3 : out2(seg(p, 0, .15));
    spokes.forEach(s => set(P, s.it, { pts: [V.pol(T, R * .08, s.a), V.pol(T, R, s.a)], so: a * .9 }));
    rings.forEach((r, k) => {
      const rr = R * (k + 1) / 3, pts = [];
      spokes.forEach((s, i) => { const n = spokes[(i + 1) % spokes.length]; pts.push(V.pol(T, rr, s.a)); pts.push(V.pol(T, rr * .86, (s.a + (n.a < s.a ? n.a + TAU : n.a)) / 2)); });
      pts.push(pts[0]);
      set(P, r, { pts, so: a * .85 });
    });
  });
}

// ──────────────────────── Волна Порядка ────────────────────────
// Из груди — конус светящихся сот, фронт волны как стекло. hits: [{x,y,r, fail, to}]
export function wave(B, aim, L, hits = []) {
  const D = DPI, ang = V.ang(B, aim), half = .4636, dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const O = V.add(B, V.mul(dir, B.r * .55)), T0 = 650, T1 = 1750, DUR = 2700;
  const s = Math.max(D * .55, L / 20), cells = [];
  const w = Math.sqrt(3) * s, n = Math.ceil(L / s) + 2;
  for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++) {
    const x = w * (q + r / 2), y = 1.5 * s * r, d = Math.hypot(x, y);
    if (d > L || d < B.r * .4) continue;
    let da = Math.atan2(y, x) - ang; da = Math.atan2(Math.sin(da), Math.cos(da));
    if (Math.abs(da) > half) continue;
    cells.push({ d, it: poly({ x: O.x + x, y: O.y + y, pts: hexPts(s * .9), fill: CY, fo: 0, stroke: CY2, so: 0, sw: D * .02, layer: "DRAWING" }) });
  }
  const sig = [0, 1].map(k => poly({ x: O.x, y: O.y, pts: hexPts(D * (k ? .45 : .8)), stroke: k ? WH : CY, so: 0, sw: D * .04 }));
  const chest = circle({ x: O.x, y: O.y, r: D * .9, fill: CY, fo: 0 });
  const front = line({ pts: [O, O], stroke: WH, so: 0, sw: D * .1 }), frontG = line({ pts: [O, O], stroke: CY, so: 0, sw: D * .55 });
  const edges = [0, 1].map(() => line({ pts: [O, O], stroke: CY, so: 0, sw: D * .03 }));
  once(0, DUR, [chest, ...sig, ...cells.map(c => c.it), frontG, front, ...edges], (p, P) => {
    const t = p * DUR, sec = t / 1000, ch = seg(t, 0, T0);
    const ca = t < T0 ? out2(ch) : Math.max(0, 1 - (t - T0) / 600);
    set(P, chest, { s: .4 + ch * .8, fo: ca * (.25 + .1 * Math.sin(sec * 30)) });
    sig.forEach((it, k) => set(P, it, { r: (k ? -1 : 1) * sec * 220, s: .3 + out3(ch) * .9, so: ca }));
    const R = L * out2(seg(t, T0, T1)), fa = t < T0 ? 0 : t < T1 ? 1 : Math.max(0, 1 - (t - T1) / 400);
    for (const c of cells) {
      const k = (R - c.d) / (L * .3);
      const a = t < T0 || k < 0 ? 0 : k < .1 ? k / .1 : Math.max(0, 1 - (k - .1) / 1.1);
      const fade = t > T1 ? Math.max(0, 1 - (t - T1) / 900) : 1;
      set(P, c.it, { fo: a * .2 * fade, so: Math.min(1, a * 1.1) * fade, sc: k < .12 ? WH : CY2 });
    }
    const arc = arcPts(O, Math.max(R, 1), ang - half, ang + half, 26);
    set(P, front, { pts: arc, so: fa * .95 }); set(P, frontG, { pts: arc, so: fa * .3 });
    set(P, edges[0], { pts: [O, V.pol(O, R, ang - half)], so: fa * .35 });
    set(P, edges[1], { pts: [O, V.pol(O, R, ang + half)], so: fa * .35 });
  });
  for (const h of hits) {
    const d = T0 + c01(V.dist(O, h) / L) * (T1 - T0);
    if (h.fail && h.to) {
      shards(h, 8, h.r * 1.6, CY2, 800, d, { dir: V.ang(B, h), spread: .6 });
      pushTrail(h, h.to, h.r, d + 80);
    } else hexShield(h, h.r * 1.25, CY, 800, d);
  }
  return T0;
}
export function pushTrail(a, b, r, d = 0) {
  const D = DPI, rings = [], n = 5;
  for (let i = 0; i < n; i++) rings.push(circle({ x: a.x, y: a.y, r: r * .95, stroke: CY2, so: 0, sw: D * .03 }));
  const ln = line({ pts: [a, a], stroke: CY, so: 0, sw: D * .08 });
  once(d, 1100, [ln, ...rings], (p, P) => {
    const m = out3(seg(p, 0, .45));
    set(P, ln, { pts: [a, V.lerp(a, b, m)], so: env(p, .05, .5) * .5 });
    rings.forEach((it, i) => { const k = i / (n - 1), q = V.lerp(a, b, k * m); set(P, it, { x: q.x, y: q.y, so: (p < .45 ? (m >= k ? .6 : 0) : .6 * (1 - (p - .45) / .55)) * (.4 + k * .6) }); });
  });
  shock(b, r * 1.8, CY, 600, d + 450, .7);
}

// ──────────────────────── Призыв Архиноидов ────────────────────────
// Из короны вылетают сферы, в точке стихийно сплетается силуэт Архиноида. Возвращает время проявления.
const FIG = [
  [[0, -.82], [0, -.12]], [[-.4, -.7], [.4, -.7]],
  [[-.4, -.7], [-.58, -.32], [-.64, .06]], [[.4, -.7], [.58, -.32], [.64, .06]],
  [[-.22, -.5], [-.78, -.6], [-1.02, -.18]], [[.22, -.5], [.78, -.6], [1.02, -.18]],
  [[-.2, -.32], [-.7, -.1], [-.86, .3]], [[.2, -.32], [.7, -.1], [.86, .3]],
  [[0, -.12], [-.26, .38], [-.3, .86]], [[0, -.12], [.26, .38], [.3, .86]],
  [[-.18, -.12], [.18, -.12]],
];
export function summon(B, pts) {
  const D = DPI, T1 = 950, T2 = 2250, DUR = 3500;
  pts.forEach((P0, idx) => {
    const S = { x: B.x + (idx ? 1 : -1) * B.r * .35, y: B.y - B.r * .8 };
    const Cc = V.add(V.lerp(S, P0, .5), { x: 0, y: -D * 3 });
    const U = D * .95, c = { x: P0.x, y: P0.y - U * .05 };
    const orb = circle({ x: S.x, y: S.y, r: D * .2, fill: CY2, fo: 0, stroke: WH, so: 0, sw: D * .02 }), og = circle({ x: S.x, y: S.y, r: D * .45, fill: CY, fo: 0 });
    const tr = [0, 1, 2, 3, 4].map(k => circle({ x: S.x, y: S.y, r: D * .12 * (1 - k * .15), fill: CY, fo: 0 }));
    const base = poly({ x: c.x, y: P0.y + U * .86, pts: hexPts(U * .9, 0).map(q => ({ x: q.x, y: q.y * .35 })), stroke: CY2, so: 0, sw: D * .03, fill: CY, fo: 0, layer: "DRAWING" });
    const head = circle({ x: c.x, y: c.y - U * 1.02, r: U * .17, stroke: CY2, so: 0, sw: D * .035, fill: CY, fo: 0 });
    const limbs = FIG.map(f => { const abs = f.map(([x, y]) => ({ x: c.x + x * U, y: c.y + y * U })); return { abs, g: line({ pts: abs, stroke: CY, so: 0, sw: D * .13, tension: .3 }), k: line({ pts: abs, stroke: WH, so: 0, sw: D * .03, tension: .3 }) }; });
    const spir = [0, 1, 2, 3, 4, 5, 6, 7].map(k => ({ it: line({ pts: [c, c], stroke: k % 2 ? CY2 : CY, so: 0, sw: D * .02, tension: .5 }), a: k / 8 * TAU }));
    once(0, DUR, [base, ...spir.map(s => s.it), ...limbs.flatMap(l => [l.g, l.k]), head, og, ...tr, orb], (p, P) => {
      const t = p * DUR, sec = t / 1000, f = seg(t, 0, T1);
      const h = bez(S, Cc, P0, inOut(f));
      const oa = t < T1 ? env(f, .1, 0) : Math.max(0, 1 - (t - T1) / 250);
      set(P, orb, { x: h.x, y: h.y, fo: oa * .9, so: oa }); set(P, og, { x: h.x, y: h.y, fo: oa * .3, s: 1 + .15 * Math.sin(sec * 25) });
      tr.forEach((it, k) => { const q = bez(S, Cc, P0, inOut(Math.max(0, f - (k + 1) * .035))); set(P, it, { x: q.x, y: q.y, fo: oa * .45 * (1 - k / 5) }); });
      const b = seg(t, T1, T1 + 300), fade = t > T2 ? Math.max(0, 1 - (t - T2) / 1100) : 1;
      set(P, base, { fo: out2(b) * .12 * fade, so: out2(b) * .8 * fade, r: sec * 30, s: .6 + out3(b) * .4 });
      const w = seg(t, T1 + 100, T2);
      spir.forEach((s, k) => {
        const pts = [];
        for (let j = 0; j <= 14; j++) { const u = j / 14, rr = U * (1.3 - u * .9) * (1 - w * .6), a = s.a + u * 4 + sec * (k % 2 ? 3 : -3); pts.push({ x: c.x + Math.cos(a) * rr, y: P0.y + U * .86 - u * U * 2 + Math.sin(a) * rr * .3 }); }
        set(P, s.it, { pts, so: env(w, .1, .25) * .7 * (t > T1 ? 1 : 0) });
      });
      const dr = out2(seg(t, T1 + 250, T2 - 100));
      limbs.forEach((l, k) => { const g = c01(dr * 1.4 - k * .04); const pts = partial(l.abs, g); const fl = t > T2 - 60 && t < T2 + 200 ? 1 : .8; set(P, l.g, { pts, so: (g > 0 ? .4 : 0) * fade * fl }); set(P, l.k, { pts, so: (g > 0 ? .95 : 0) * fade }); });
      set(P, head, { so: c01(dr * 2) * fade, fo: c01(dr * 2) * .2 * fade });
    });
    flash(c, U * 1.4, CY2, 800, T2, 1);
    shock(c, U * 2.4, CY, 800, T2, 1);
    sparks(c, 24, U * 2.2, [CY, CY2, WH], 1100, T2);
  });
  return T2;
}

// ──────────────────────── Стирание из реальности ────────────────────────
// Зарядка: глаза и сферы вспыхивают, из босса к цели тянется луч внимания (сетка — висящий эффект)
export function chargeIntro(B, T) {
  const D = DPI;
  for (let i = 0; i < 6; i++) { const q = V.pol(B, B.r * .75, -Math.PI / 2 + (i - 2.5) * .35); flash(q, D * .3, CY2, 500, i * 60, 1); }
  const ln = line({ pts: [B, B], stroke: CY2, so: 0, sw: D * .05 }), lg = line({ pts: [B, B], stroke: CY, so: 0, sw: D * .3 });
  once(300, 1300, [lg, ln], (p, P) => { const e = V.lerp(B, T, out3(seg(p, 0, .35))); set(P, ln, { pts: [B, e], so: env(p, .05, .5) }); set(P, lg, { pts: [B, e], so: env(p, .05, .5) * .25 }); });
  hexShield(T, T.r * 1.6, CY, 1000, 600);
}
// Удар: шесть лучей по очереди (fails — массив из 6 true/false), при стирании — имплозия. Возвращает момент стирания.
export function strike(T, fails, erased) {
  const D = DPI, R = Math.max(D * 3.4, T.r * 3), step = 430, t0 = 350;
  const hexR = T.r * 1.35, edges = [];
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + k * TAU / 6, b = a + TAU / 6;
    edges.push(line({ pts: [V.pol(T, hexR, a), V.pol(T, hexR, b)], stroke: CY, so: 0, sw: D * .05 }));
  }
  const total = t0 + 6 * step + 500;
  once(0, total + (erased ? 500 : 0), edges, (p, P) => {
    const t = p * (total + (erased ? 500 : 0));
    edges.forEach((it, k) => {
      const hit = t > t0 + k * step + 130, f = fails[k];
      const end = t > total - 300 ? Math.max(0, 1 - (t - (total - 300)) / 400) : 1;
      set(P, it, { so: (hit ? (f ? 1 : .45) : .2 * out2(seg(t, 0, t0))) * end, sc: hit && f ? WH : CY, sw: D * (hit && f ? .08 : .04) });
    });
  });
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k + .5) * TAU / 6, S = V.pol(T, R, a), d = t0 + k * step;
    const E = V.pol(T, T.r * .2, a);
    const g = line({ pts: [S, S], stroke: CY, so: 0, sw: D * .38 }), c = line({ pts: [S, S], stroke: WH, so: 0, sw: D * .07 });
    const src = circle({ x: S.x, y: S.y, r: D * .25, fill: CY2, fo: 0 });
    once(d, 420, [g, c, src], (p, P) => {
      const e = V.lerp(S, fails[k] ? E : V.pol(T, T.r * 1.3, a), out3(seg(p, 0, .3))), a2 = env(p, .05, .45);
      set(P, g, { pts: [S, e], so: a2 * .35 }); set(P, c, { pts: [S, e], so: a2 }); set(P, src, { fo: a2 * .8, s: 1 + Math.random() * .3 });
    });
    if (fails[k]) {
      flash(T, T.r * 1.1, WH, 380, d + 120, .9);
      shards(T, 6, T.r * 1.8, CY2, 700, d + 120);
      if (k === 0 || k === 3) cracks(T, T.r * 1.5, CY, 1500, d + 120, { n: 5, w: .8 });
    } else {
      hexShield(V.pol(T, T.r * 1.25, a), D * .45, CY, 450, d + 110);
      sparks(V.pol(T, T.r * 1.3, a), 8, D * .9, [CY, WH], 500, d + 120, { dir: a, spread: 1.1 });
    }
  }
  const tE = t0 + 6 * step + 150;
  if (erased) {
    const rings = [0, 1, 2].map(k => circle({ x: T.x, y: T.y, r: T.r * (1.8 + k * .5), stroke: k ? CY : WH, so: 0, sw: D * .05 }));
    const hole = circle({ x: T.x, y: T.y, r: T.r * 1.1, fill: "#02060F", fo: 0, stroke: CY2, so: 0, sw: D * .04 });
    once(tE, 1300, [hole, ...rings], (p, P) => {
      rings.forEach((it, k) => { const q = seg(p, k * .1, .6 + k * .1); set(P, it, { s: 1 - in2(q) * .97, so: env(q, .1, .2) }); });
      const h = p < .55 ? out3(p / .55) : 1 - in2((p - .55) / .45);
      set(P, hole, { s: h, fo: h * .9, so: h });
    });
    flash(T, T.r * 2.2, WH, 900, tE + 750, 1);
    shock(T, T.r * 3.5, CY, 900, tE + 750, 1.3);
    sparks(T, 30, T.r * 2.4, [CY, CY2, WH], 1600, tE + 800, { up: true });
  }
  return tE;
}

// ──────────────────────── Щупальце со сферой ────────────────────────
// Геометрия щупальца от A к Tip с волной (используется и в висящем эффекте)
export function tentPts(A, Tip, sec, amp, n = 16, side = 1) {
  const d = V.sub(Tip, A), L = V.len(d) || 1, nn = V.perp(V.norm(d)), pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, w = Math.sin(u * Math.PI) * (Math.sin(u * 7 - sec * 4) * .6 + side * .7) * amp;
    pts.push({ x: A.x + d.x * u + nn.x * w, y: A.y + d.y * u + nn.y * w });
  }
  return pts;
}
export const TENT = { skin: "#B5C7D6", dk: "#2C4157", seg: 5 };
// Набор объектов щупальца и функция отрисовки
export function tentacleKit() {
  const D = DPI, segs = [];
  for (let i = 0; i < TENT.seg; i++) { const w = lerp(D * .34, D * .1, i / (TENT.seg - 1)); segs.push({ o: line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: TENT.dk, so: 0, sw: w + D * .05, tension: .4 }), f: line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: TENT.skin, so: 0, sw: w, tension: .4 }) }); }
  const vein = line({ pts: [{ x: 0, y: 0 }, { x: 0, y: 0 }], stroke: CY2, so: 0, sw: D * .025, tension: .4 });
  const og = circle({ r: D * .42, fill: CY, fo: 0 }), orb = circle({ r: D * .22, fill: "#CFF8FF", fo: 0, stroke: WH, so: 0, sw: D * .025 });
  const oc = circle({ r: D * .1, fill: CY2, fo: 0 }), hl = circle({ r: D * .05, fill: "#FFFFFF", fo: 0 });
  const items = [...segs.flatMap(s => [s.o, s.f]), vein, og, orb, oc, hl];
  function draw(P, pts, a, sec) {
    const n = pts.length - 1, per = n / TENT.seg;
    segs.forEach((s, i) => { const sl = pts.slice(Math.floor(i * per), Math.min(n, Math.ceil((i + 1) * per)) + 1); set(P, s.o, { pts: sl, so: a }); set(P, s.f, { pts: sl, so: a }); });
    set(P, vein, { pts, so: a * (.5 + .3 * Math.sin(sec * 7)) });
    const tp = pts[n];
    set(P, og, { x: tp.x, y: tp.y, fo: a * (.22 + .08 * Math.sin(sec * 6)) }); set(P, orb, { x: tp.x, y: tp.y, fo: a * .45, so: a });
    set(P, oc, { x: tp.x, y: tp.y, fo: a * .85, s: 1 + .25 * Math.sin(sec * 5) }); set(P, hl, { x: tp.x - DPI * .07, y: tp.y - DPI * .08, fo: a * .9 });
  }
  return { items, draw };
}
// Сфера: щупальце хлещет по цели. fail — цель схвачена (дальше держит висящий эффект)
export function sphere(B, T, fail) {
  const D = DPI, dir = V.norm(V.sub(T, B)), nrm = V.perp(dir), side = Math.random() < .5 ? -1 : 1;
  const A = V.add(B, V.add(V.mul(dir, B.r * .55), V.mul(nrm, side * B.r * .25)));
  const E = fail ? V.pol(T, T.r * .3, V.ang(T, B)) : V.add(T, V.mul(nrm, side * (T.r + D * .7)));
  const kit = tentacleKit(), DUR = fail ? 1150 : 1500;
  once(0, DUR, kit.items, (p, P) => {
    const t = p * DUR, sec = t / 1000;
    let k = t < 650 ? backOut(seg(t, 0, 650)) : 1; if (!fail && t > 800) k = 1 - inOut(seg(t, 800, 1450));
    const tip = V.lerp(A, E, k), whip = (1 - c01(t / 650)) * D * 1.6 * side;
    const pts = tentPts(A, V.add(tip, V.mul(nrm, whip)), sec, D * .35, 16, side);
    const a = fail ? (t > 900 ? 1 - (t - 900) / 250 : out2(t / 120)) : env(p, .08, .1);
    kit.draw(P, pts, a, sec);
  });
  flash(E, T.r * 1.2, CY2, 500, 640, .8);
  sparks(E, 14, T.r * 1.8, [CY, CY2, WH], 700, 640);
  if (fail) shock(T, T.r * 1.8, CY, 600, 650, .7); else cracks(E, D * 1.1, CY, 1100, 640, { layer: "DRAWING", n: 5, w: .7 });
}

// ──────────────────────── Сдвиг ────────────────────────
// Кольцо схлопывается вокруг цели, сетка мигает, цель исчезает и возникает в точке. Возвращает момент переноса.
export function shift(T, to, fail) {
  const D = DPI, R = T.r * 1.5, tp = 620;
  const ring = circle({ x: T.x, y: T.y, r: R, stroke: CY2, so: 0, sw: D * .06 }), fill = circle({ x: T.x, y: T.y, r: R, fill: CY, fo: 0 });
  const frags = [0, 1, 2, 3, 4, 5].map(i => ({ it: poly({ x: T.x, y: T.y, pts: hexPts(D * .16), stroke: WH, so: 0, sw: D * .02, fill: CY, fo: 0 }), a: i / 6 * TAU }));
  once(0, fail ? tp + 80 : 900, [fill, ring, ...frags.map(f => f.it)], (p, P) => {
    const t = p * (fail ? tp + 80 : 900), k = fail ? in2(seg(t, 0, tp)) : out3(seg(t, 0, 380)) * .55;
    const brk = !fail && t > 400;
    set(P, ring, { s: 1 - k * .95, so: brk ? 0 : .9, r: t * .3 });
    set(P, fill, { s: 1 - k * .9, fo: brk ? 0 : .08 + k * .25 });
    frags.forEach(f => { const rr = R * (1 - k) * 1.1, a = f.a + k * 5; set(P, f.it, { x: T.x + Math.cos(a) * rr, y: T.y + Math.sin(a) * rr, r: t, fo: brk ? 0 : .35, so: brk ? 0 : .9 }); });
  });
  if (!fail) {
    shards(T, 14, R * 1.5, CY2, 800, 400);
    hexShield(T, T.r * 1.2, CY, 600, 380);
    return null;
  }
  flash(T, T.r * 1.3, WH, 400, tp - 40, 1);
  const path = line({ pts: [T, to], stroke: CY2, so: 0, sw: D * .04 });
  path.style.strokeDash = [D * .2, D * .15];
  once(tp - 40, 380, [path], (p, P) => set(P, path, { so: Math.random() * env(p, .1, .5) * .8 }));
  const r2 = circle({ x: to.x, y: to.y, r: R, stroke: CY2, so: 0, sw: D * .06 });
  once(tp + 40, 700, [r2], (p, P) => set(P, r2, { s: lerp(.05, 1.1, out3(p)), so: 1 - p }));
  flash(to, T.r * 1.3, CY2, 550, tp + 40, .9);
  hexShield(to, T.r * 1.3, CY, 650, tp + 120);
  sparks(to, 16, T.r * 2, [CY, CY2, WH], 800, tp + 40);
  return tp;
}

// ──────────────────────── Присвоение ────────────────────────
// Тонкий луч из головы с бегущими импульсами; при провале над целью загорается глаз в шестиграннике
export function appro(B, T, fail) {
  const D = DPI, H = { x: B.x, y: B.y - B.r * .55 }, E = fail ? { x: T.x, y: T.y } : V.pol(T, T.r * 1.2, V.ang(T, H));
  const g = line({ pts: [H, H], stroke: CY, so: 0, sw: D * .2 }), c = line({ pts: [H, H], stroke: WH, so: 0, sw: D * .03 });
  const dots = [0, 1, 2].map(() => circle({ x: H.x, y: H.y, r: D * .08, fill: WH, fo: 0 }));
  once(0, 1300, [g, c, ...dots], (p, P) => {
    const t = p * 1300, e = V.lerp(H, E, out3(seg(t, 0, 450))), a = env(p, .05, .3);
    set(P, g, { pts: [H, e], so: a * .3 }); set(P, c, { pts: [H, e], so: a * .9 });
    dots.forEach((it, k) => { const u = ((t / 600) + k / 3) % 1, q = V.lerp(H, e, u); set(P, it, { x: q.x, y: q.y, fo: a * Math.sin(u * Math.PI) }); });
  });
  if (fail) { flash(T, T.r * 1.2, CY2, 600, 450, .8); eyePop({ x: T.x, y: T.y - T.r - D * .45 }, D * .4, 480); }
  else { hexShield(E, D * .6, CY, 600, 440); shards(E, 10, D * 1.4, CY2, 800, 460); }
}
export function eyeShape(c, w) {
  const up = [], lo = [];
  for (let i = 0; i <= 12; i++) { const x = -w + 2 * w * i / 12, y = w * .52 * (1 - (x / w) ** 2); up.push({ x: c.x + x, y: c.y - y }); lo.push({ x: c.x - x, y: c.y + y }); }
  return up.concat(lo);
}
function eyePop(c, w, d) {
  const hx = poly({ x: c.x, y: c.y, pts: hexPts(w * 1.3), stroke: CY2, so: 0, sw: DPI * .035, fill: NAVY, fo: 0 });
  const ey = poly({ pts: eyeShape(c, w), stroke: WH, so: 0, sw: DPI * .03, fill: CY, fo: 0, tension: .2 });
  const ir = circle({ x: c.x, y: c.y, r: w * .3, fill: CY2, fo: 0 });
  once(d, 900, [hx, ey, ir], (p, P) => { const s = backOut(seg(p, 0, .4)), a = p > .7 ? (1 - p) / .3 : 1; set(P, hx, { s, so: a, fo: a * .6, r: p * 60 }); set(P, ey, { so: a * c01(p * 3), fo: a * .25 }); set(P, ir, { s: s, fo: a }); });
}

// ──────────────────────── Перенаправление ────────────────────────
// Снаряд из A в B ловится голубой сферой на полпути. fail — улетает в C; иначе сфера трескается и снаряд летит дальше
export function redirect(A, Bp, C, fail) {
  const D = DPI, S = V.lerp(A, Bp, .5), tgt = fail && C ? C : Bp, DUR = 2000, WARM = "#FFD58A";
  const orb = circle({ x: A.x, y: A.y, r: D * .15, fill: WH, fo: 0 }), og = circle({ x: A.x, y: A.y, r: D * .35, fill: WARM, fo: 0 });
  const trail = [0, 1, 2, 3, 4, 5].map(k => circle({ x: A.x, y: A.y, r: D * .12 * (1 - k * .13), fill: WARM, fo: 0 }));
  const bub = circle({ x: S.x, y: S.y, r: D * .75, fill: CY, fo: 0, stroke: CY2, so: 0, sw: D * .04 });
  const bh = hexLattice(D * .7, D * .2).map(h => poly({ x: S.x, y: S.y, pts: hexPts(D * .18, 0, h.x, h.y), stroke: CY2, so: 0, sw: D * .012 }));
  const hist = [];
  once(0, DUR, [bub, ...bh, ...trail, og, orb], (p, P) => {
    const t = p * DUR;
    let h;
    if (t < 500) h = V.lerp(A, S, out2(t / 500));
    else if (t < 1150) h = V.add(S, { x: (Math.random() - .5) * D * .12, y: (Math.random() - .5) * D * .12 });
    else h = V.lerp(S, tgt, in2(seg(t, 1150, 1650)));
    hist.unshift(h); if (hist.length > 7) hist.pop();
    const oa = t < 1650 ? 1 : 0, col = t > 600 && fail ? CY2 : WARM;
    set(P, orb, { x: h.x, y: h.y, fo: oa }); set(P, og, { x: h.x, y: h.y, fo: oa * .45, fc: col, s: 1 + .2 * Math.sin(t / 30) });
    trail.forEach((it, k) => { const q = hist[k + 1] || h; set(P, it, { x: q.x, y: q.y, fo: oa * .4 * (1 - k / 6), fc: col }); });
    const ba = t < 400 ? 0 : t < 600 ? (t - 400) / 200 : t < 1150 ? 1 : fail ? Math.max(0, 1 - (t - 1150) / 300) : (t < 1180 ? 1 : 0);
    set(P, bub, { fo: ba * .14, so: ba * .9, s: .9 + .1 * Math.sin(t / 60) });
    bh.forEach((it, i) => set(P, it, { so: ba * (.25 + .35 * Math.sin(t / 90 + i)) }));
  });
  if (!fail) { cracks(S, D * .9, CY, 700, 1150, { n: 6, w: .7 }); shards(S, 16, D * 1.6, CY2, 900, 1170); }
  else { bolt(S, C, CY2, 300, 1100, .6, .1); shock(S, D * 1.3, CY, 500, 1140, .6); }
  flash(tgt, D * .9, fail ? CY2 : WARM, 600, 1640, .9);
  sparks(tgt, 14, D * 1.5, fail ? [CY, CY2, WH] : [WARM, WH], 800, 1640);
}

// ──────────────────────── Протоколы ────────────────────────
// Включение: Ключ вспыхивает, лучи расходятся, три волны цвета Ключа
export function protoOn(K, col, B) {
  const D = DPI, R = Math.max(K.r, D * .5), rays = [];
  for (let i = 0; i < 12; i++) rays.push({ it: line({ pts: [K, K], stroke: i % 2 ? WH : col, so: 0, sw: D * (i % 2 ? .03 : .07) }), a: i / 12 * TAU, L: R * rnd(3, 5) });
  once(150, 1600, rays.map(r => r.it), (p, P) => {
    rays.forEach(r => { const a = r.a + p * .8, l = r.L * out3(seg(p, 0, .5)); set(P, r.it, { pts: [V.pol(K, R * .9, a), V.pol(K, R * .9 + l, a)], so: env(p, .08, .5) * (.6 + Math.random() * .4) }); });
  });
  flash(K, R * 2, col, 900, 0, 1);
  for (let k = 0; k < 3; k++) shock(K, R * (3 + k * 1.6), col, 1000, 150 + k * 260, 1.2 - k * .25);
  sparks(K, 26, R * 3.5, [col, WH], 1300, 100);
  if (B) { bolt(B, K, col, 500, 250, .7, .12); flash(B, B.r * .5, col, 600, 250, .6); }
}
// Выключение: свет стягивается в Ключ и гаснет
export function protoOff(K, col) {
  const R = Math.max(K.r, DPI * .5);
  const rings = [0, 1].map(k => circle({ x: K.x, y: K.y, r: R * (2.6 + k), stroke: col, so: 0, sw: DPI * .05 }));
  once(0, 800, rings, (p, P) => rings.forEach((it, k) => { const q = seg(p, k * .15, .85 + k * .15); set(P, it, { s: 1 - in2(q) * .9, so: env(q, .1, .3) * .8 }); }));
  flash(K, R * 1.2, col, 500, 650, .6);
}

// Перестановка: каждый герой схлопывается в фиолетовую точку, дуги связывают старое и новое место. moves: [{a:{x,y,r}, b:{x,y}}]
export function shuffle(moves, col = "#B56BFF") {
  const D = DPI, tp = 650;
  for (const m of moves) {
    const { a, b } = m, R = a.r * 1.5;
    const ring = circle({ x: a.x, y: a.y, r: R, stroke: col, so: 0, sw: D * .06 }), fl = circle({ x: a.x, y: a.y, r: R, fill: col, fo: 0 });
    once(0, tp + 60, [fl, ring], (p, P) => { const k = in2(p); set(P, ring, { s: 1 - k * .95, so: .95, r: p * 300 }); set(P, fl, { s: 1 - k * .9, fo: .1 + k * .3 }); });
    const mid = V.add(V.lerp(a, b, .5), V.mul(V.perp(V.norm(V.sub(b, a))), V.dist(a, b) * .25));
    const arc = []; for (let i = 0; i <= 20; i++) arc.push(bez(a, mid, b, i / 20));
    const ln = line({ pts: [a, a], stroke: col, so: 0, sw: D * .05 }), lw = line({ pts: [a, a], stroke: WH, so: 0, sw: D * .015 });
    ln.style.strokeDash = [D * .18, D * .1];
    once(tp - 200, 900, [ln, lw], (p, P) => { const pts = partial(arc, out3(seg(p, 0, .5))); set(P, ln, { pts, so: env(p, .05, .4) * .85 }); set(P, lw, { pts, so: env(p, .05, .4) * .7 }); });
    flash(a, a.r * 1.2, col, 400, tp - 30, 1);
    const r2 = circle({ x: b.x, y: b.y, r: R, stroke: col, so: 0, sw: D * .06 });
    once(tp + 60, 700, [r2], (p, P) => set(P, r2, { s: lerp(.05, 1.1, out3(p)), so: 1 - p }));
    flash(b, a.r * 1.3, col, 600, tp + 60, .9);
    sparks(b, 14, a.r * 2, [col, "#E0C2FF", WH], 800, tp + 60);
  }
  return tp;
}

// Часы Петли (геометрия циферблата)
export function clockTicks(c, R) { const o = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, l = i % 3 ? .1 : .2; o.push([V.pol(c, R * (1 - l), a), V.pol(c, R, a)]); } return o; }
// Откат Петли: стрелки крутятся назад, золотые следы тянутся к запомненным местам. moves: [{a, b, r}]
export function loopRewind(K, moves, col = "#FFD23F") {
  const D = DPI, R = Math.max(K ? K.r * 2.4 : 0, D * 1.8);
  if (K) {
    const dial = circle({ x: K.x, y: K.y, r: R, stroke: col, so: 0, sw: D * .05, fill: col, fo: 0 });
    const ticks = clockTicks(K, R).map(t => line({ pts: t, stroke: col, so: 0, sw: D * .04 }));
    const hm = line({ pts: [K, K], stroke: WH, so: 0, sw: D * .06 }), hh = line({ pts: [K, K], stroke: col, so: 0, sw: D * .09 });
    once(0, 1800, [dial, ...ticks, hh, hm], (p, P) => {
      const a = env(p, .1, .25), sp = out2(seg(p, 0, .85));
      set(P, dial, { so: a, fo: a * .08 }); ticks.forEach(t => set(P, t, { so: a }));
      set(P, hm, { pts: [K, V.pol(K, R * .85, -Math.PI / 2 - sp * TAU * 4)], so: a });
      set(P, hh, { pts: [K, V.pol(K, R * .55, -Math.PI / 2 - sp * TAU * .6)], so: a });
    });
    shock(K, R * 1.6, col, 900, 0, 1);
  }
  for (const m of moves) {
    const pts = [m.a, m.b];
    const g = line({ pts, stroke: col, so: 0, sw: D * .16 }), c = line({ pts, stroke: WH, so: 0, sw: D * .03 });
    once(200, 1300, [g, c], (p, P) => { const e = V.lerp(m.a, m.b, inOut(seg(p, 0, .7))); set(P, g, { pts: [e, m.a], so: env(p, .05, .4) * .35 }); set(P, c, { pts: [e, m.a], so: env(p, .05, .4) * .9 }); });
    flash(m.b, m.r * 1.3, col, 600, 1100, .9);
    shock(m.b, m.r * 2, col, 700, 1100, .7);
  }
  return 200;
}
// Срыв Петли: циферблат разлетается осколками, призраки лопаются
export function loopShatter(K, ghosts, col = "#FFD23F") {
  const D = DPI;
  if (K) { const R = Math.max(K.r * 2.4, D * 1.8); cracks(K, R, col, 900, 0, { n: 8 }); shards(K, 30, R * 2, col, 1300, 300, { size: 1.4 }); flash(K, R, col, 700, 300, 1); }
  for (const g of ghosts || []) { shards(g, 8, g.r * 1.6, col, 800, 350); flash(g, g.r, col, 400, 350, .6); }
}
// Тишина: тёмно-бирюзовая волна гасит звук на арене
export function silenceWave(K, dark = "#1A535C", glow = "#2FB8C4") {
  const D = DPI, R = D * 16;
  for (let k = 0; k < 3; k++) {
    const f = circle({ x: K.x, y: K.y, r: R, fill: dark, fo: 0, stroke: glow, so: 0, sw: D * .12, layer: "DRAWING", n: 72 });
    once(k * 450, 2200, [f], (p, P) => set(P, f, { s: lerp(.03, 1, out2(p)), fo: (1 - p) * .28, so: (1 - p) * .8, sw: D * .12 / Math.max(.05, lerp(.03, 1, out2(p))) }));
  }
  flash(K, Math.max(K.r * 2, D), glow, 900, 0, .8);
}
// Перекалибровка: сканирующие кольца сжимаются на боссе, поле окрашивается в цвет стихии
export function recal(B, col) {
  const D = DPI;
  for (let k = 0; k < 3; k++) {
    const r = circle({ x: B.x, y: B.y, r: B.r * 2.3, stroke: k === 1 ? WH : col, so: 0, sw: D * .05 });
    r.style.strokeDash = [D * .3, D * .12];
    once(k * 220, 900, [r], (p, P) => set(P, r, { s: lerp(1, .46, inOut(p)), so: env(p, .1, .2), r: p * 90 * (k % 2 ? -1 : 1) }));
  }
  hexShield(B, B.r * 1.1, col, 1000, 750);
  flash(B, B.r * 1.2, col, 700, 800, .6);
}

// Рубиновая Линза: тёплый конус от держателя к боссу. fail — оглушена (трещины), иначе разомкнута
export function lens(Hh, B, fail) {
  const D = DPI, ang = V.ang(Hh, B), dist = V.dist(Hh, B), nn = { x: -Math.sin(ang), y: Math.cos(ang) };
  const H0 = V.pol(Hh, Hh.r * .6, ang);
  const wedge = k => { const w = B.r * (1.15 - k * .35), far = V.pol(Hh, dist, ang); return [H0, V.add(far, V.mul(nn, w)), V.pol(Hh, dist + B.r * .3, ang), V.sub(far, V.mul(nn, w))]; };
  const cones = [0, 1, 2].map(k => poly({ pts: wedge(k), fill: k === 2 ? "#FFE6B0" : k ? LENS2 : LENS, fo: 0, tension: .15 }));
  const hr = circle({ x: Hh.x, y: Hh.y, r: Hh.r * 1.3, stroke: LENS2, so: 0, sw: D * .06, fill: LENS, fo: 0 });
  const motes = [0, 1, 2, 3, 4, 5, 6, 7].map(() => ({ it: circle({ x: Hh.x, y: Hh.y, r: D * .06, fill: "#FFF1D0", fo: 0 }), o: rnd(0, 1), w: rnd(-.6, .6) }));
  const DUR = 2200;
  once(0, DUR, [hr, ...cones, ...motes.map(m => m.it)], (p, P) => {
    const t = p * DUR, a = t < 300 ? 0 : env(seg(t, 300, 2000), .12, .35), fl = .8 + Math.random() * .2;
    set(P, hr, { fo: env(p, .05, .3) * (.15 + .1 * Math.sin(t / 50)), so: env(p, .05, .3), s: 1 + .08 * Math.sin(t / 70) });
    cones.forEach((c, k) => set(P, c, { fo: a * fl * [.12, .16, .2][k] }));
    motes.forEach(m => { const u = (t / 700 + m.o) % 1, q = V.add(V.lerp(H0, B, u), V.mul(nn, m.w * B.r * u)); set(P, m.it, { x: q.x, y: q.y, fo: a * Math.sin(u * Math.PI) }); });
  });
  if (fail) {
    cracks(B, B.r * 1.1, LENS, 2000, 900, { n: 9, w: 1.2 });
    flash(B, B.r * 1.4, LENS2, 900, 900, 1);
    shock(B, B.r * 2.2, LENS, 900, 900, 1.3);
    sparks(B, 26, B.r * 1.8, [LENS, LENS2, WH], 1100, 950);
  } else {
    hexShield(B, B.r * 1.05, CY, 800, 850);
    shards(B, 18, B.r * 1.7, CY2, 900, 1250);
    flash(B, B.r, LENS2, 600, 1250, .6);
  }
}

// ──────────────────────── Ключи ────────────────────────
// Импульс по вене от босса к Ключу
export function veinPulse(B, K, d = 0, col = CY2) {
  const S = V.pol(B, B.r * .8, V.ang(B, K)), E = V.pol(K, K.r * .8, V.ang(K, B));
  const g = line({ pts: [S, E], stroke: CY, so: 0, sw: DPI * .2 }), dot = circle({ x: S.x, y: S.y, r: DPI * .14, fill: WH, fo: 0 }), dg = circle({ x: S.x, y: S.y, r: DPI * .35, fill: col, fo: 0 });
  once(d, 650, [g, dg, dot], (p, P) => { const q = V.lerp(S, E, inOut(p)); set(P, g, { pts: boltPts(S, E, .03, 10), so: env(p, .1, .3) * .3 }); set(P, dot, { x: q.x, y: q.y, fo: env(p, .05, .1) }); set(P, dg, { x: q.x, y: q.y, fo: env(p, .05, .1) * .5 }); });
  return 600;
}
// Удар по Ключу: с Барьером — сотовый купол и импульс по вене, без — искры и трещины
export function keyHit(B, K, barrier) {
  if (barrier) {
    if (B) veinPulse(B, K, 0);
    hexShield(K, K.r * 1.6, CY, 900, B ? 450 : 0);
    sparks(K, 14, K.r * 2, [CY, CY2, WH], 700, B ? 480 : 30);
  } else {
    flash(K, K.r * 1.1, "#FFF4E0", 450, 0, .9);
    sparks(K, 20, K.r * 2.2, ["#FFE2B0", WH, CY2], 800, 0);
    cracks(K, K.r * 1.2, CY, 1200, 0, { n: 5, w: .8 });
  }
}
// Лишний урон уходит в Систему: вены на всех Ключах вспыхивают
export function veinFlare(B, keys) {
  flash(B, B.r * .9, CY2, 600, 0, .7);
  keys.forEach((K, i) => { veinPulse(B, K, 100 + i * 80); flash(K, K.r * 1.6, CY2, 700, 650 + i * 80, 1); shock(K, K.r * 2.4, CY, 700, 650 + i * 80, .8); });
}
// Ключ сломан: трещины, прорывающийся свет, взрыв, босс содрогается. Возвращает момент взрыва.
export function keyBreak(B, K, col = CY) {
  const D = DPI, R = Math.max(K.r, D * .5), tx = 1500;
  cracks(K, R * 1.3, col, tx + 200, 0, { n: 8, grow: .55, w: 1.1 });
  const beams = [];
  for (let i = 0; i < 9; i++) beams.push({ it: line({ pts: [K, K], stroke: i % 3 ? col : WH, so: 0, sw: D * rnd(.04, .1) }), a: rnd(0, TAU), L: R * rnd(1.4, 3) });
  once(600, tx - 600, beams.map(b => b.it), (p, P) => beams.forEach((b, i) => { const on = Math.random() < .3 + p * .6, l = b.L * (.4 + p * .8); set(P, b.it, { pts: [V.pol(K, R * .5, b.a), V.pol(K, R * .5 + l, b.a + Math.sin(p * 9 + i) * .05)], so: on ? .9 : .1 }); }));
  const jit = circle({ x: K.x, y: K.y, r: R * 1.1, fill: col, fo: 0 });
  once(300, tx - 300, [jit], (p, P) => set(P, jit, { x: K.x + (Math.random() - .5) * D * .1 * p, y: K.y + (Math.random() - .5) * D * .1 * p, fo: .1 + p * .4 * Math.random() }));
  flash(K, R * 3, col, 1000, tx, 1);
  flash(K, R * 1.6, WH, 700, tx, 1);
  shock(K, R * 5, col, 1100, tx, 1.6);
  shock(K, R * 3.2, WH, 800, tx + 120, .8);
  shards(K, 26, R * 4, col, 1400, tx, { size: 1.3 });
  sparks(K, 30, R * 4.5, [col, CY2, WH], 1300, tx);
  if (B) {
    bolt(K, B, CY2, 450, tx + 100, 1, .14);
    const rings = [0, 1, 2].map(k => circle({ x: B.x, y: B.y, r: B.r * (1 + k * .12), stroke: k ? CY : WH, so: 0, sw: D * .05 }));
    once(tx + 250, 1200, rings, (p, P) => rings.forEach((it, k) => set(P, it, { x: B.x + (Math.random() - .5) * D * .25 * (1 - p), y: B.y + (Math.random() - .5) * D * .25 * (1 - p), so: (1 - p) * .8 })));
    cracks(B, B.r, CY, 1300, tx + 250, { n: 6, w: 1 });
  }
  return tx;
}
// Обнажённое ядро: столб света из груди, трещины по телу
export function coreBurst(B) {
  const D = DPI, R = B.r, rays = [];
  const build = circle({ x: B.x, y: B.y, r: R * .5, fill: WH, fo: 0 });
  once(0, 1100, [build], (p, P) => set(P, build, { s: .2 + out2(p) * .8, fo: in2(p) * .8 }));
  cracks(B, R * 1.1, CY2, 2600, 200, { n: 10, grow: .4, w: 1.3 });
  for (let i = 0; i < 16; i++) rays.push({ it: line({ pts: [B, B], stroke: i % 2 ? WH : CY2, so: 0, sw: D * (i % 2 ? .05 : .14) }), a: i / 16 * TAU, L: R * rnd(2.2, 3.4) });
  once(1000, 2000, rays.map(r => r.it), (p, P) => rays.forEach(r => { const a = r.a + p * .6, l = r.L * out3(seg(p, 0, .4)); set(P, r.it, { pts: [V.pol(B, R * .3, a), V.pol(B, R * .3 + l, a)], so: env(p, .05, .5) * (.6 + Math.random() * .4) }); }));
  flash(B, R * 2.4, CY2, 1200, 1000, 1);
  for (let k = 0; k < 3; k++) shock(B, R * (3 + k), k ? CY : WH, 1100, 1000 + k * 200, 1.5 - k * .3);
  sparks(B, 36, R * 3, [CY, CY2, WH], 1500, 1050);
}
