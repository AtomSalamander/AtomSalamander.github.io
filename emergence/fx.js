// Одноразовые анимации способностей Эмерджентности. Всё рисуется векторно локальными объектами.
// Координаты — в пикселях сцены; токен = {x, y, r}.
import {
  DPI, TAU, V, c01, out3, out2, in2, inOut, backOut, lerp, rnd, env, seg, bez, spawn,
  poly, line, circle, ringPts, ellPts, hexPts, arcPts, starPts, shardPts, boltPts, crackSet, partial, offs,
} from "./engine.js";
import { eraseGrade } from './loom.js';
import { ERASE,lensGeometry } from './targeting.js';
import { film,rail,pullScene } from './astra.js';
import { PAL } from "./const.js";

const { cy: CY, cy2: CY2, navy: NAVY, white: WH, bone: BONE, bone2: BONE2, boneDk: BONEDK, lens: LENS, lens2: LENS2 } = PAL;
const set = (P, it, q) => P.set(it.id, q);
const once = (delay, dur, items, f) => spawn(delay, items, { dur, f });

// ──────────────────────── базовые эффекты ────────────────────────
export function flash(c, R, col = CY, dur = 650, d = 0, peak = .85) {
  return film('flash',c,R,dur,d,{col,alpha:peak,gain:p=>Math.min(1,p*45)});
}
export function shock(c, R, col = CY, dur = 700, d = 0, w = 1) {
  return film('shock',c,R,dur,d,{col,opt:[Math.max(.012,DPI*.048*w/R),0,0]});
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
  // Keep the directed spray on punches; radial chips share a single plate.
  if(o.dir==null)return film('flecks',c,R,dur,d,{col,pad:3.2,opt:[n,Math.min(.21,DPI*.135*(o.size||1)/R),.18]});
  const list=Array.from({length:n},(_,i)=>({it:poly({pts:shardPts(DPI*rnd(.06,.15)),fill:i%3?col:WH,fo:0}),ang:o.dir+rnd(-1,1)*(o.spread??.7),len:R*rnd(.4,1.1),rot:rnd(-240,240)}));
  return once(d,dur,list.map(v=>v.it),(p,P)=>{for(const v of list){const q=V.pol(c,v.len*out3(p),v.ang);set(P,v.it,{...q,r:v.rot*p,fo:env(p,.04,.5)});}});
}
export function cracks(c, R, col = CY, dur = 1400, d = 0, o = {}) {
  return film('crack',c,R,dur,d,{col,layer:o.layer,gain:p=>env(p,.035,.36)});
}
export function bolt(A, B, col = CY, dur = 400, d = 0, w = 1, jag = .16) {
  return rail('bolt',A,B,DPI,dur,d,{col,margin:DPI*(jag*2+.37),vec:L=>[L,jag,.043*w]});
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
  return film('shield',c,R,dur,d,{col});
}
// Разлом: тёмная дыра с голубой кромкой (как дыра в груди на арте)
export function rift(c, R, dur, d = 0, open = .12, close = .15) {
  return film('iris',c,R,dur,d,{pad:3.1,gain:p=>p<open?out3(p/open):p>1-close?1-in2((p-1+close)/close):1});
}

// ──────────────────────── скелетная рука ────────────────────────
// Разлом остаётся на месте. Ключица вращает головку плеча вокруг разлома.
// На замахе углы костей задают силуэт; только на вылете решаем цепь до костяшек.
function touchRig(portal, impact, side, hand, hitAt) {
  const axis = V.ang(portal, impact), reach = V.dist(portal, impact);
  const angle = degrees => axis + side * degrees * Math.PI / 180;
  const clav = Math.min(hand * .91, reach * .27), kn = hand * .555;
  const shoulder = yaw => V.pol(portal, clav, angle(yaw));
  const range = V.dist(shoulder(43), impact);
  const margin = Math.min(.25 * hand, .067 * range);
  const bones = range + margin - kn;
  const upper = bones * .52, fore = bones - upper;
  const smooth = u => u * u * (3 - 2 * u);
  const phase = (t,a,b) => smooth(seg(t,a,b));
  const ready = 1580, release = 1655;

  // Три разных дуги. Плечевой пояс начинает уходить назад раньше плечевой кости;
  // согнутый локоть оказывается ЗА плечом, а кисть остаётся на оси предплечья.
  function chamber(t) {
    const A = shoulder(lerp(77, 151, phase(t, 670, 1440)));
    const El = V.pol(A, upper, angle(lerp(78, 158, phase(t, 740, 1510))));
    const a = angle(lerp(-5, 20, phase(t, 825, ready)));
    return { A, El, W: V.pol(El, fore, a), K: V.pol(El, fore + kn, a), a };
  }
  const loaded = chamber(ready), dir = V.norm(V.sub(impact, loaded.K));
  const normal = V.mul(V.perp(dir), side);
  function pose(t) {
    const g = out3(seg(t, 200, 800));
    if (t <= ready) {
      const q = chamber(t);
      // Только материализация меняет длину костей; к началу замаха рука в полном масштабе.
      return { A: V.lerp(portal,q.A,g), El: V.lerp(portal,q.El,g), W: V.lerp(portal,q.W,g), a: q.a, g };
    }
    // Плечо уже разворачивается вперёд, пока кулак на мгновение остаётся в задней точке.
    const recover = phase(t, hitAt + 140, hitAt + 560);
    const A = shoulder(lerp(151, 43, phase(t, ready, hitAt - 28)) + 10 * recover);
    const u = seg(t, release, hitAt), travel = u * u * (2.25 - 1.25 * u);
    const through = phase(t, hitAt + 60, hitAt + 125);
    const after = margin * (.60 * through - 1.75 * recover);
    const K = V.add(V.add(V.lerp(loaded.K, impact, travel), V.mul(dir, after)),
      V.mul(normal, Math.min(hand * .16, range * .05) * Math.sin(Math.PI * travel)));

    // IK до ударной грани, а не до свободной кисти: запястье не заламывается у токена.
    const distal = fore + kn, raw = V.dist(A,K), aim = raw > 1e-6 ? V.norm(V.sub(K,A)) : dir;
    const d = Math.max(Math.abs(upper - distal) + 1e-6, Math.min(upper + distal - 1e-6, raw));
    const x = (upper * upper - distal * distal + d * d) / (2 * d);
    const y = side * Math.sqrt(Math.max(0, upper * upper - x * x));
    const El = V.add(A, V.add(V.mul(aim,x), V.mul(V.perp(aim),y)));
    const a = V.ang(El, V.add(A,V.mul(aim,d)));
    return { A, El, W: V.pol(El,fore,a), a, g };
  }
  return { pose, dir, loaded };
}

// Кость: анатомическая сужающаяся форма с утолщениями на суставах
function bonePts(a, b, wa, wb) {
  const L = V.dist(a, b);
  if (L < 1) return [{ x: a.x, y: a.y }, { x: a.x + 1, y: a.y }, { x: a.x, y: a.y + 1 }];
  const d = V.norm(V.sub(b, a)), n = V.perp(d), m1 = V.lerp(a, b, .28), m2 = V.lerp(a, b, .72), k = Math.min(DPI * .06, L * .12);
  const P = (o, nn, w) => ({ x: o.x + n.x * nn * w, y: o.y + n.y * nn * w });
  return [
    V.sub(a, V.mul(d, k)), P(a, .55, wa), P(m1, .3, wa), P(m2, .3, wb), P(b, .55, wb), V.add(b, V.mul(d, k)),
    P(b, -.55, wb), P(m2, -.3, wb), P(m1, -.3, wa), P(a, -.55, wa),
  ];
}

// Кисть в локальных координатах (x — вперёд). curl 0 — раскрытая ладонь, 1 — массивный кулак.
function handGeom(W, ang, H, curl, t, side) {
  const T = p => { const q = V.rot({ x: p.x * H, y: p.y * H * side }, ang); return { x: W.x + q.x, y: W.y + q.y }; };
  const sW = lerp(1, 1.15, curl);
  const palm = [
    [-.12, -.17 * sW], [.08, -.25 * sW], [.35, -.27 * sW],
    [lerp(.42, .48, curl), -.13 * sW], [lerp(.43, .49, curl), .06 * sW],
    [.37, .24 * sW], [.10, .26 * sW], [-.12, .17 * sW],
  ].map(([x, y]) => T({ x, y }));
  const fingers = [], knuckles = [];
  const by = [-.20, -.07, .07, .20], lenK = [.90, 1.10, 1.02, .82], spread = [-.26, -.09, .09, .26];
  for (let f = 0; f < 4; f++) {
    const bx = lerp(.39 - Math.abs(by[f]) * .14, .44 - Math.abs(by[f]) * .06, curl);
    const byC = by[f] * lerp(1, 1.08, curl);
    const base = { x: bx, y: byC };
    const a0 = spread[f] * (1 - curl * .92) + Math.sin(t * 5 + f) * .055 * (1 - curl);
    const L = [.34, .28, .22];
    let po = { ...base }; const openPts = [po];
    for (let k = 0; k < 3; k++) {
      const l = L[k] * lenK[f];
      po = { x: po.x + Math.cos(a0) * l, y: po.y + Math.sin(a0) * l };
      openPts.push(po);
    }
    const closedPts = [
      base,
      { x: bx + .12, y: byC * .98 },
      { x: bx + .04, y: byC * .94 },
      { x: bx - .11, y: byC * .90 },
    ];
    const pts = openPts.map((p, k) => T({ x: lerp(p.x, closedPts[k].x, curl), y: lerp(p.y, closedPts[k].y, curl) }));
    fingers.push(pts);
    knuckles.push(curl > .5 ? pts[1] : pts[3]);
  }
  const thOpen = [{ x: .06, y: -.24 }, { x: .24, y: -.46 }, { x: .42, y: -.54 }];
  const thClosed = [{ x: .08, y: -.27 }, { x: .31, y: -.29 }, { x: .35, y: -.08 }];
  const th = thOpen.map((p, k) => T({ x: lerp(p.x, thClosed[k].x, curl), y: lerp(p.y, thClosed[k].y, curl) }));
  fingers.push(th);
  knuckles.push(th[2]);
  return { palm, fingers, tips: knuckles };
}

// Пролом реальности в точке удара: тёмная воронка-провал, раскол пространства, разлетающиеся гексы матрицы и направленный фронт
function realityFracture(E, punchAng, R, d, v) {
  const D = DPI;
  // 1. Мгновенный чёрный провал реальности с рваной белой/циановой кромкой
  const voidCore = poly({ x: E.x, y: E.y, pts: starPts(R * .95, R * .50, 9, rnd(0, TAU)), fill: "#02060F", fo: 0, stroke: WH, so: 0, sw: D * .055 });
  const voidRim = poly({ x: E.x, y: E.y, pts: starPts(R * 1.18, R * .66, 9, rnd(0, TAU)), stroke: CY2, so: 0, sw: D * .045 });
  once(d, 440, [voidRim, voidCore], (p, P) => {
    const s = p < .22 ? lerp(.15, 1.15, out3(p / .22)) : lerp(1.15, .04, in2((p - .22) / .78));
    const a = p < .22 ? 1 : 1 - (p - .22) / .78;
    set(P, voidCore, { s, fo: a * .96, so: a, r: p * 35 });
    set(P, voidRim, { s: s * 1.1, so: a * .88, r: -p * 55 });
  });
  // 2. Диагональный пространственный разлом-вспышка поперёк удара (как треснувший экран реальности)
  const slashA = punchAng + Math.PI / 2 + rnd(-.25, .25);
  const slashS = V.pol(E, R * 1.75, slashA), slashE = V.pol(E, R * 1.75, slashA + Math.PI);
  const sDark = line({ pts: [E, E], stroke: "#02060F", so: 0, sw: D * .22 });
  const sGlow = line({ pts: [E, E], stroke: CY2, so: 0, sw: D * .12 });
  const sCore = line({ pts: [E, E], stroke: WH, so: 0, sw: D * .04 });
  const sPts = boltPts(slashS, slashE, .11, 10);
  once(d, 680, [sDark, sGlow, sCore], (p, P) => {
    const g = out3(seg(p, 0, .2)), a = p < .25 ? 1 : 1 - (p - .25) / .75;
    const pts = sPts.map(q => V.lerp(E, q, g));
    set(P, sDark, { pts, so: a * .85 });
    set(P, sGlow, { pts, so: a * .75 });
    set(P, sCore, { pts, so: a });
  });
  // 3. Разлетающиеся гексы матрицы пространства (Система ломает сетку реальности)
  const hexes = [];
  for (let i = 0; i < 10; i++) {
    const cone = i < 6 ? punchAng + rnd(-.85, .85) : rnd(0, TAU);
    const r0 = R * rnd(.15, .52), dist = R * rnd(1.35, 2.85), sz = D * rnd(.17, .31);
    hexes.push({
      it: poly({ x: E.x, y: E.y, pts: hexPts(sz), fill: i % 3 ? CY : "#02060F", fo: 0, stroke: i % 2 ? WH : CY2, so: 0, sw: D * .026 }),
      a: cone, r0, dist, sp: rnd(-260, 260),
    });
  }
  once(d, 980, hexes.map(h => h.it), (p, P) => {
    const e = out3(p), a = env(p, .04, .55);
    for (const h of hexes) {
      const rr = h.r0 + h.dist * e;
      set(P, h.it, { x: E.x + Math.cos(h.a) * rr, y: E.y + Math.sin(h.a) * rr, r: h.sp * p, s: lerp(1.15, .35, p), fo: a * .34, so: a * .95 });
    }
  });
  // 4. Направленная эллиптическая ударная волна (сминает пространство по вектору удара)
  const w1 = poly({ x: E.x, y: E.y, pts: ellPts(R * .42, R * 1.18, punchAng, 36), stroke: CY2, so: 0, sw: D * .085 });
  const w2 = poly({ x: E.x, y: E.y, pts: ellPts(R * .32, R * .92, punchAng, 32), stroke: WH, so: 0, sw: D * .038 });
  once(d + 20, 640, [w1, w2], (p, P) => {
    const e = out3(p), shift = R * (v === "miss" ? 1.4 : 1.9) * e, a = 1 - p;
    const cx = E.x + Math.cos(punchAng) * shift, cy = E.y + Math.sin(punchAng) * shift;
    set(P, w1, { x: cx, y: cy, s: lerp(.3, 1.6, e), so: a * .88 });
    set(P, w2, { x: cx, y: cy, s: lerp(.25, 1.45, e), so: a * .96 });
  });
}

// Касание Системы: из разлома рядом с боссом вырастает костяная рука с локтевым суставом,
// складывается на замахе за плечом босса, затем разворачивается от плеча до костяшек.
// v: "fail" — попала и спасбросок провален (нити висят отдельным эффектом), "ok" — попала, спасбросок успешен, "miss" — промах
export function touch(B, T, v = "fail") {
  const D = DPI, DUR = 3750;
  const hitAt = 1850;
  const dir = V.dist(T,B) > 1e-6 ? V.norm(V.sub(T,B)) : { x: 1, y: 0 };
  const side = Math.random() < .5 ? -1 : 1, nrm = V.perp(dir);
  const H = Math.max(D * .9, T.r * 1.25);
  let E = { x: T.x, y: T.y };
  if (v === "miss") E = V.add(E, V.add(V.mul(nrm, side * (T.r + H * .85)), V.mul(dir, H * .35)));
  const S = V.add(B, V.add(V.mul(dir, -B.r * .25), V.mul(nrm, side * Math.max(B.r * .85, D * .65))));
  // При перекрывающихся токенах кисть должна помещаться между разломом и точкой контакта.
  const handSize = Math.min(H, .73 * V.dist(S,E));
  const rig = touchRig(S, E, side, handSize, hitAt);
  const punchDir = rig.dir, punchAng = Math.atan2(punchDir.y, punchDir.x), W_peak = rig.loaded.K;

  const its = [];
  const mk = o => { const it = o.closed === false ? line(o) : poly(o); its.push(it); return it; };

  // Шлейф-разрыв пространства вдоль траектории удара (самый нижний слой)
  const smearVoid = mk({ fill: "#02060F", fo: 0, stroke: CY, so: 0, sw: D * .045 });
  const smearGlow = mk({ closed: false, stroke: CY2, so: 0, sw: H * .75 });
  const speedLines = [0, 1, 2, 3, 4].map(() => mk({ closed: false, stroke: WH, so: 0, sw: D * .032 }));

  // Короткая ключица связывает подвижное плечо с неподвижным устьем разлома.
  const clavicle = mk({ fill: BONE2, stroke: BONEDK, sw: D * .028, tension: .24 });
  const shoulderCap = mk({ fill: BONE, stroke: BONEDK, sw: D * .028, tension: .28 });
  // 2 звена руки: плечо (0) и предплечье (1, с двойной костью)
  const bones = [0, 1].map(() => ({
    glow: mk({ closed: false, stroke: CY, so: 0, sw: H * .85 }),
    b: mk({ fill: BONE, fo: 0, stroke: BONEDK, so: 0, sw: D * .032, tension: .32 }),
    hi: mk({ closed: false, stroke: "#F4FAFF", so: 0, sw: H * .05 }),
    vein: mk({ closed: false, stroke: CY2, so: 0, sw: D * .028 }),
  }));
  const ulna = mk({ fill: BONE2, fo: 0, stroke: BONEDK, so: 0, sw: D * .025, tension: .3 });

  // Локтевой сустав (с острым костяным гребнем и светящимся ядром) + запястье
  const elbow = {
    spur: mk({ fill: BONE2, fo: 0, stroke: BONEDK, so: 0, sw: D * .028 }),
    j: mk({ fill: BONE, fo: 0, stroke: BONEDK, so: 0, sw: D * .03, pts: ringPts(1, 22) }),
    c: mk({ fill: CY2, fo: 0, pts: ringPts(1, 14) }),
  };
  const wrist = {
    j: mk({ fill: BONE2, fo: 0, stroke: BONEDK, so: 0, sw: D * .025, pts: ringPts(1, 18) }),
    c: mk({ fill: CY2, fo: 0, pts: ringPts(1, 12) }),
  };

  // Искажение пространства ПОД кулаком (обнимает кулак ореолом сингулярности, не скрывая костяшки)
  const singHalo = mk({ fill: "#02060F", fo: 0, stroke: CY2, so: 0, sw: D * .045, pts: ringPts(1, 28) });
  const warpRings = [0, 1].map(k => mk({ stroke: k ? WH : CY2, so: 0, sw: D * (k ? .026 : .042), pts: hexPts(1) }));
  const pullLines = [0, 1, 2, 3, 4, 5].map(k => ({
    it: mk({ closed: false, stroke: k % 2 ? WH : CY2, so: 0, sw: D * .022 }),
    a: k / 6 * TAU + rnd(-.22, .22), r: H * rnd(1.5, 2.35),
  }));

  // Кисть / Кулак (поверх сингулярности, всегда чётко читается)
  const hand = {
    glow: mk({ fill: CY, fo: 0, pts: ringPts(1, 28) }),
    knuckGlow: mk({ fill: WH, fo: 0, pts: ringPts(1, 18) }),
    palm: mk({ fill: BONE, fo: 0, stroke: BONEDK, so: 0, sw: D * .032, tension: .28 }),
    pv: [0, 1, 2].map(() => mk({ closed: false, stroke: CY2, so: 0, sw: D * .022 })),
    fo: [0, 1, 2, 3, 4].map(() => mk({ closed: false, stroke: BONEDK, so: 0, sw: H * .12, tension: .25 })),
    ff: [0, 1, 2, 3, 4].map(() => mk({ closed: false, stroke: BONE, so: 0, sw: H * .082, tension: .25 })),
    tip: [0, 1, 2, 3, 4].map(() => mk({ fill: CY2, fo: 0, pts: ringPts(1, 10) })),
    bolts: [0, 1, 2, 3].map(() => mk({ closed: false, stroke: WH, so: 0, sw: D * .028 })),
  };

  once(0, DUR, its, (p, P) => {
    const t = p * DUR, sec = t / 1000;
    const { A, El, W, a: handAng, g } = rig.pose(t);
    const dz = seg(t, 2500, 3550), rec = inOut(seg(t, hitAt + 140, hitAt + 560));
    const curl = c01(inOut(seg(t, 650, 1160)) - rec * .35);

    const vis = idx => g <= .001 ? 0 : c01(1 - (dz * 1.45 - idx * .28) / .38);
    const alArm0 = vis(2), alArm1 = vis(1), alHand = vis(0) * c01(g * 2.5 - .35);

    // Плечо и предплечье
    set(P, clavicle, { pts: bonePts(S, A, handSize * .30, handSize * .44), fo: alArm0, so: alArm0 });
    // Несимметричная суставная чашка: по её силуэту виден поворот плечевой кости.
    const capAng = V.ang(A, El);
    const cap = [[-.21,-.17],[-.07,-.28],[.18,-.23],[.28,-.08],[.15,.18],[-.08,.25],[-.23,.10]]
      .map(([x,y]) => V.add(A, V.rot({x:x*handSize*g, y:y*handSize*g*side}, capAng)));
    set(P, shoulderCap, { pts: cap, fo: alArm0, so: alArm0 });
    const segs = [[A, El, H * .46, H * .34, alArm0], [El, W, H * .32, H * .21, alArm1]];
    segs.forEach(([a, b, wa, wb, al], i) => {
      const O = bones[i];
      const chargeGlow = (t > 1150 && t < hitAt + 250) ? .08 : 0;
      set(P, O.glow, { pts: [a, b], so: al * (.09 + chargeGlow + .03 * Math.sin(sec * 10 + i)), sw: wa * 1.8 });
      set(P, O.b, { pts: bonePts(a, b, wa, wb), fo: al, so: al });
      const nn = V.perp(V.norm(V.sub(b, a))), ofs = V.mul(nn, wa * .14 * side);
      set(P, O.hi, { pts: [V.add(V.lerp(a, b, .18), ofs), V.add(V.lerp(a, b, .82), ofs)], so: al * .48, sw: wa * .09 });
      set(P, O.vein, { pts: boltPts(V.lerp(a, b, .06), V.lerp(a, b, .94), .06, 7), so: al * (.55 + Math.random() * .42) });
    });

    // Вторая кость предплечья (анатомическая пара)
    const fDir = V.norm(V.sub(W, El)), fNrm = V.perp(fDir);
    const uA = V.add(V.lerp(El, W, .08), V.mul(fNrm, -side * H * .13));
    const uB = V.add(V.lerp(El, W, .92), V.mul(fNrm, -side * H * .07));
    set(P, ulna, { pts: bonePts(uA, uB, H * .14, H * .10), fo: alArm1, so: alArm1 });

    // Локоть + острый костяной гребень по внешней биссектрисе сгиба
    const v1 = V.norm(V.sub(A, El)), v2 = V.norm(V.sub(W, El));
    let bis = V.sub({ x: 0, y: 0 }, V.add(v1, v2));
    bis = V.len(bis) > .05 ? V.norm(bis) : V.mul(fNrm, side);
    const bPerp = V.perp(bis);
    const spurPts = [
      V.add(El, V.mul(bPerp, H * .18)),
      V.add(El, V.mul(bis, H * .38)),
      V.sub(El, V.mul(bPerp, H * .18)),
    ];
    const alEl = Math.max(alArm0, alArm1);
    set(P, elbow.spur, { pts: spurPts, fo: alEl, so: alEl });
    set(P, elbow.j, { x: El.x, y: El.y, s: H * .22, fo: alEl, so: alEl });
    set(P, elbow.c, { x: El.x, y: El.y, s: H * .085 * (1 + .35 * Math.sin(sec * 10)), fo: alEl * .95 });

    // Запястье
    set(P, wrist.j, { x: W.x, y: W.y, s: H * .14, fo: alArm1, so: alArm1 });
    set(P, wrist.c, { x: W.x, y: W.y, s: H * .055, fo: alArm1 * .85 });

    const h = handSize * g;
    const hg = handGeom(W, handAng, h, curl, sec, side);
    const hc = V.pol(W, h * .28, handAng);
    const knuckC = V.pol(W, h * .555, handAng);

    // Искажение пространства ПОД кулаком (1150 – 1750 мс)
    const warpP = seg(t, 1150, 1740);
    if (warpP > 0 && warpP < 1) {
      const sEnv = t < 1670 ? out2(seg(t, 1150, 1500)) : 1 - seg(t, 1670, 1740);
      const haloR = H * lerp(.95, .64, seg(t, 1150, 1670));
      set(P, singHalo, { x: hc.x, y: hc.y, s: haloR, fo: sEnv * .55, so: sEnv * .9 });
      warpRings.forEach((it, k) => {
        const cyc = ((t - 1150) / 310 + k * .5) % 1;
        const rr = H * lerp(2.0, .42, in2(cyc));
        set(P, it, { x: hc.x, y: hc.y, s: rr, r: (k ? -1 : 1) * sec * 190, so: env(cyc, .12, .18) * sEnv * .92 });
      });
      pullLines.forEach(pl => {
        const a = pl.a + sec * .95, rOut = pl.r * lerp(1.15, .62, seg(t, 1150, 1670));
        set(P, pl.it, { pts: boltPts(V.pol(hc, rOut, a), V.pol(hc, H * .48, a), .09, 5), so: sEnv * (.45 + Math.random() * .45) });
      });
    } else {
      set(P, singHalo, { fo: 0, so: 0 });
      warpRings.forEach(it => set(P, it, { so: 0 }));
      pullLines.forEach(pl => set(P, pl.it, { so: 0 }));
    }

    // Отрисовка кисти/кулака
    const chGlow = t > 1150 && t < hitAt + 280 ? .09 : 0;
    set(P, hand.glow, { x: hc.x, y: hc.y, s: H * (.72 + .16 * curl), fo: alHand * (.08 + .07 * curl + chGlow) });
    const kPeak = t > 1350 && t < hitAt + 140 ? env(seg(t, 1350, hitAt + 140), .25, .25) : 0;
    set(P, hand.knuckGlow, { x: knuckC.x, y: knuckC.y, s: H * (.22 + .16 * kPeak), fo: alHand * kPeak * .55 });
    set(P, hand.palm, { pts: hg.palm, fo: alHand, so: alHand });
    hand.pv.forEach((it, k) => set(P, it, { pts: boltPts(W, hg.fingers[k + 1][0], .06, 4), so: alHand * (.55 + Math.random() * .4) }));
    hg.fingers.forEach((f, k) => { set(P, hand.fo[k], { pts: f, so: alHand }); set(P, hand.ff[k], { pts: f, so: alHand }); });
    hg.tips.forEach((tp, k) => set(P, hand.tip[k], { x: tp.x, y: tp.y, s: H * (.05 + .022 * curl) * (1 + Math.random() * .4), fo: alHand * (.55 + .45 * curl) }));

    // Молнии вокруг кулака и между локтем и кулаком
    const charged = t > 1150 && t < 2450;
    hand.bolts.forEach((it, k) => {
      if (!charged || Math.random() < .26) { set(P, it, { so: 0 }); return; }
      if (k === 3) {
        set(P, it, { pts: boltPts(El, hc, .22, 7), so: alHand * .85 });
      } else {
        const a1 = rnd(0, TAU), a2 = a1 + rnd(.9, 2.3);
        set(P, it, { pts: boltPts(V.pol(hc, H * .56, a1), V.pol(hc, H * .64, a2), .30, 6), so: alHand * .95 });
      }
    });

    // Шлейф-разрыв пространства во время выстрела кулака (1690 – 2220 мс)
    const smP = seg(t, 1690, 2220);
    if (smP > 0 && smP < 1) {
      const smA = t < hitAt ? out2(seg(t, 1690, hitAt)) : 1 - out2(seg(t, hitAt, 2220));
      const head = t < hitAt ? knuckC : E;
      const tail = V.lerp(W_peak, head, t < hitAt ? .02 : seg(t, hitAt, 2220) * .72);
      const pNrm = V.perp(punchDir);
      const wHead = H * .62 * smA, wTail = H * .06;
      const wedge = [
        V.add(tail, V.mul(pNrm, wTail)), V.add(head, V.mul(pNrm, wHead)),
        V.add(head, V.mul(punchDir, H * .22)),
        V.sub(head, V.mul(pNrm, wHead)), V.sub(tail, V.mul(pNrm, wTail)),
      ];
      set(P, smearVoid, { pts: wedge, fo: smA * .78, so: smA * .95 });
      set(P, smearGlow, { pts: [tail, head], so: smA * .42, sw: H * .85 * smA });
      speedLines.forEach((it, k) => {
        const off = (k - 2) * H * .30;
        const a0 = V.add(V.lerp(tail, head, .06 + (k % 2) * .12), V.mul(pNrm, off));
        const a1 = V.add(head, V.mul(pNrm, off * .65));
        set(P, it, { pts: [a0, a1], so: smA * (.72 + Math.random() * .28) });
      });
    } else {
      set(P, smearVoid, { fo: 0, so: 0 });
      set(P, smearGlow, { so: 0 });
      speedLines.forEach(it => set(P, it, { so: 0 }));
    }
  });

  // Разлом у плеча, из которого вырывается рука
  rift(S, H * .58, 3650, 0, .08, .12);
  cracks(S, H * 1.15, CY, 1450, 80, { n: 6, w: .75 });

  // Удар: пролом реальности + направленный выброс энергии
  const impR = Math.max(T.r * 1.55, H * 1.15);
  realityFracture(E, punchAng, impR, hitAt, v);
  flash(E, Math.max(T.r * 1.85, H * 1.4), v === "miss" ? CY : WH, 650, hitAt, 1);
  shock(E, Math.max(T.r * 3.1, H * 2.75), CY, 850, hitAt, 1.35);
  shock(E, Math.max(T.r * 2.1, H * 1.8), WH, 620, hitAt + 75, .75);
  cracks(E, Math.max(T.r * 2.2, H * 1.9), CY, 2100, hitAt, { layer: "DRAWING", n: 9, w: 1.1 });
  sparks(E, 26, Math.max(T.r * 2.6, H * 2.2), [CY, CY2, WH], 1050, hitAt, { dir: punchAng, spread: 1.1 });
  shards(E, 14, Math.max(T.r * 2.4, H * 2.0), CY2, 1050, hitAt + 20, { dir: punchAng, spread: 1.25 });
  if (v === "ok") hexShield(T, T.r * 1.3, CY, 850, hitAt + 220);

  // Рассыпание на искры от кисти через локоть к плечу
  const { A: Ae, El: Ee, W: We } = rig.pose(DUR);
  const dissPts = [We, V.lerp(We, Ee, .5), Ee, V.lerp(Ee, Ae, .5), S];
  dissPts.forEach((q, i) => sparks(q, 8, H * .95, [CY, CY2, WH], 950, 2500 + i * 185, { up: true, size: .85 }));
}

// ──────────────────────── Плетение ────────────────────────
// The five strands remain connected to the caster; no projectile, head or flying orb.
export function weave(B,T,hit=true){const D=DPI,theta=V.ang(B,T),S=V.pol(B,B.r*.60,theta);
 const side=theta+Math.PI/2,E=hit?T:V.pol(T,T.r+D*.7,side);
 film('seal',B,Math.max(D*.6,B.r*1.24),1250,0,{col:CY2,opt:[5,0,0],alpha:.68});
 rail('loomBeam',S,E,Math.max(D*.68,B.r*.42),1980,200,{col:CY2,margin:D*1.25,gain:p=>env(p,.075,.31)});
 const contact=520;
 if(hit){webWrap(T,contact);flash(T,T.r*.9,CY2,450,contact,.44);}
 else{sparks(E,9,D*.67,[CY,CY2,WH],650,contact,{dir:theta,spread:.4});}
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
  film('iris',O,D*.76,1100,0,{pad:3.1});
  film('crown',B,Math.max(B.r*1.63,D*.96),1100,0,{col:CY2});
  const cc=V.add(O,V.mul(dir,L*.5));
  film('wave',cc,L,DUR,0,{axis:dir,w:L*(Math.abs(dir.x)+Math.abs(dir.y)+.12),h:L*(Math.abs(dir.y)+Math.abs(dir.x)+.12),col:CY,opt:[Math.min(27,Math.max(7,L/D*1.5)),0,0],layer:'DRAWING',gain:(p,t)=>t<.65?0:t<1.75?1:Math.max(0,1-(t-1.75)/.64)});
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
  film('crown',B,Math.max(B.r*1.8,DPI),1900,0,{col:CY2});
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
  film('crown',B,Math.max(B.r*2,DPI),1900,0,{col:CY2});
  const D = DPI;
  for (let i = 0; i < 6; i++) { const q = V.pol(B, B.r * .75, -Math.PI / 2 + (i - 2.5) * .35); flash(q, D * .3, CY2, 500, i * 60, 1); }
  const ln = line({ pts: [B, B], stroke: CY2, so: 0, sw: D * .05 }), lg = line({ pts: [B, B], stroke: CY, so: 0, sw: D * .3 });
  once(300, 1300, [lg, ln], (p, P) => { const e = V.lerp(B, T, out3(seg(p, 0, .35))); set(P, ln, { pts: [B, e], so: env(p, .05, .5) }); set(P, lg, { pts: [B, e], so: env(p, .05, .5) * .25 }); });
  hexShield(T, T.r * 1.6, CY, 1000, 600);
}
// A single collapse. No count, random failure mask or sequence of hits enters the visual score.
export function strike(T,erased,follow){const D=DPI,R=Math.max(D*3.7,T.r*4.2),sz=Math.max(D*1.04,T.r*1.75);
 pullScene(T,R,ERASE.total,eraseGrade,follow);
 film('unravel',T,R,ERASE.total,0,{follow,pad:2.28,col:CY2,z:1000110,gain:(p,t)=>1-smoothFade(t,5.28,5.58)});
 film('eventHorizon',T,sz,ERASE.total,0,{follow,pad:3.65,col:CY2,z:1000111,opt:[erased?1:0,0,0],gain:()=>1});
 film('residue',T,R*.76,2210,ERASE.peak,{follow,pad:2.2,col:CY2,z:1000109,gain:p=>env(p,.025,.47)});
 return ERASE.peak;
}
function smoothFade(t,a,b){const u=c01((t-a)/(b-a));return u*u*(3-2*u);}

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
  film('crown',B,Math.max(B.r*1.58,DPI*.9),1050,0,{col:CY});
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
  film('crown',B,Math.max(B.r*1.66,DPI*.88),1300,0,{col:CY2});
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
  film('shield',V.lerp(A,Bp,.5),DPI*.78,910,370,{col:CY2});
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
  film('seal',K,Math.max(K.r,DPI*.5)*2,2100,0,{col,opt:[({'#BFEFFF':6,'#B56BFF':3,'#FFD23F':12,'#2FB8C4':4})[col.toUpperCase()]||6,0,0]});
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
  if(K)film('seal',K,Math.max(K.r*2.7,DPI*2),1500,0,{col,opt:[12,0,0]});
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
export function lens(Hh,B,fail,L=DPI*6){
 const {u,center,reaches}=lensGeometry(Hh,B,L),ax=Math.abs(u.x),ay=Math.abs(u.y);
 film('iris',Hh,Hh.r*.72,1700,0,{col:LENS2,pad:3});
 film('rubyCone',center,L,2200,0,{axis:u,w:L*(ax+ay+.03),h:L*(ay+ax+.03),col:LENS,layer:'DRAWING',gain:p=>env(p,.12,.31)});
 if(!reaches)return false;
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
  return true;
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
  film('iris',K,Math.max(K.r,DPI*.5),1450,0,{col,pad:3.1});
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
// A standalone scene relic, never an attack/portrait effect on the boss.
export function coreBurst(K){const R=Math.max(K.r,DPI*.45);
 film('relic',K,R*1.58,3450,0,{col:CY2,z:1000105});
 film('seal',K,R*1.52,2350,0,{col:CY,opt:[4,0,0],alpha:.75});
 const H=Math.min(R*4.6,DPI*7.5),c={x:K.x,y:K.y-H*.45};
 film('column',c,R*.85,2400,620,{w:R*2.65,h:H*1.4,opt:[H/(R*.85),0,0],col:CY2});
 shock(K,R*2.35,CY,1100,760,.75);
}
