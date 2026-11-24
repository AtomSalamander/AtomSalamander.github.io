// Движок анимаций: рисует локальные объекты на карте у каждого игрока
// (не синхронизируются по сети — поэтому анимация плавная и не нагружает комнату).
import OBR, { buildEffect, buildCurve, buildImage } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { GLYPHS } from "./glyphs.js";

import { makeAstra } from "./astra/player.js";
import { brushes } from "./astra/grimoire/brush.js";
import { finish } from "./astra/grimoire/finish.js";
const astra = makeAstra(OBR, buildEffect);

let DPI = 150;
export async function grid() { try { DPI = (await OBR.scene.grid.getDpi()) || DPI; } catch (e) {} return DPI; }

const now = () => performance.now();
const c01 = p => Math.min(1, Math.max(0, p));
const out3 = p => 1 - Math.pow(1 - c01(p), 3);
const TAU = Math.PI * 2;

// ── цикл анимации (setTimeout, т.к. фоновое окно скрыто и requestAnimationFrame там не идёт) ──
// One clock and one batch for all ordinary FX. A queued cast is tied to its scene epoch.
const anims=new Set(), live=new Map();let queued=[],epoch=0,timer=null,nextTick=Infinity,busy=false;
let pivot={x:0,y:0},calibration=null;
async function remove(ids){if(!ids.length)return;for(let n=0;n<2;n++)try{await OBR.scene.local.deleteItems(ids);return;}catch(e){if(n)console.warn('[fx] cleanup',e);}}
async function calibrate(){
 if(calibration)return calibration;const stamp=epoch;
 calibration=(async()=>{const probe=buildEffect().effectType('STANDALONE').width(32).height(32).position({x:0,y:0}).sksl('half4 main(float2 p){return half4(0); }').build();probe.visible=false;probe.locked=true;probe.disableHit=true;
  try{await OBR.scene.local.addItems([probe]);if(stamp!==epoch)return;const b=await OBR.scene.local.getItemBounds([probe.id]);if(stamp===epoch&&b.width>0&&b.height>0&&Number.isFinite(b.center.x+b.center.y))pivot={x:.5-b.center.x/32,y:.5-b.center.y/32};}
  catch{/* Default standalone origin: top left. */}finally{await remove([probe.id]);}})();return calibration;
}
async function addTracked(items,stamp){if(stamp!==epoch)return false;const ids=items.map(i=>i.id);
 try{await OBR.scene.local.addItems(items);}catch(e){await remove(ids);throw e;}
 if(stamp!==epoch){await remove(ids);return false;}for(const it of items)live.set(it.id,it);return true;
}
function schedule(ms){const at=now()+ms;if(busy||nextTick<=at)return;clearTimeout(timer);nextTick=at;timer=setTimeout(tick,ms);}
function kick(){schedule(0);}
function spawn(delay,items,anim){if(!items.length)return;const t0=now()+Math.max(0,delay||0);queued.push({items,anim,t0});schedule(Math.max(0,t0-now()));}
function changes(it,q){const d={};if(q.pos)d.position=q.pos;else if(q.x!=null)d.position={x:q.x,y:q.y};if(q.pts)d.points=q.pts;if(q.s!=null)d.scale={x:q.s,y:q.s};if(q.r!=null)d.rotation=q.r;
 if(q.phase)d.uniforms=it.uniforms.map(u=>u.name==='phase'?{name:u.name,value:q.phase}:q.axis&&u.name==='axis'?{name:u.name,value:q.axis}:u);
 if(q.fo!=null||q.so!=null||q.fc||q.sc){const orig=it.style||it.text?.style;if(orig){const st={...orig};if(q.fo!=null)st.fillOpacity=c01(q.fo);if(q.so!=null)st.strokeOpacity=c01(q.so);if(q.fc)st.fillColor=q.fc;if(q.sc)st.strokeColor=q.sc;if(it.style)d.style=st;else d.text={...it.text,style:st};}}
 return d;}
async function tick(){nextTick=Infinity;timer=null;busy=true;const stamp=epoch,begin=now();
 try{const due=queued.filter(g=>g.t0<=begin&&begin<g.t0+g.anim.dur);queued=queued.filter(g=>g.t0>begin);
  if(due.length){if(!await addTracked(due.flatMap(g=>g.items),stamp))return;for(const g of due)anims.add({...g.anim,t0:g.t0,ids:g.items.map(i=>i.id)});}
  const t=now(),P=new Map(),dead=[];for(const a of anims){const dt=t-a.t0;if((a.until!=null&&t>=a.until)||(!a.loop&&dt>=a.dur)){anims.delete(a);dead.push(...a.ids);continue;}
   if(a.loop&&a.next>t)continue;if(a.loop)a.next=t+50;
   try{a.f(a.loop?dt/1000:c01(dt/a.dur),P);}catch(e){console.warn('[fx] frame',e);anims.delete(a);dead.push(...a.ids);}}
  for(const id of dead){P.delete(id);live.delete(id);}if(dead.length)await remove(dead);if(stamp!==epoch)return;
  const src=[],patch=new Map();for(const [id,q] of P){const it=live.get(id);if(!it)continue;src.push(it);patch.set(id,changes(it,q));}
  if(src.length){await OBR.scene.local.updateItems(src,ds=>{for(const it of ds)Object.assign(it,patch.get(it.id));});for(const it of src)if(live.has(it.id))live.set(it.id,{...it,...patch.get(it.id)});}
 }catch(e){console.warn('[fx] local frame',e);}finally{busy=false;const interval=[...anims].some(a=>!a.loop)?33:51;
  if(anims.size||queued.length)schedule(Math.max(1,Math.min(anims.size?Math.max(4,interval-(now()-begin)):Infinity,queued.reduce((dt,g)=>Math.min(dt,g.t0-now()),Infinity))));}}

const brush=brushes({buildEffect,spawn,dpi:()=>DPI,anchor:()=>pivot});

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
  ...brush.cast,
  projectile(A,B,o,delay){
    const shape=SHAPES[o.shape], length=(o.length||(o.size||.3)*3)*DPI;
    const parts=shape?shape(length,o).map((v,k)=>({it:poly({x:A.x,y:A.y,pts:v.pts,fill:v.fill,stroke:v.stroke,sw:v.sw,fo:0,so:0,z:Date.now()+20+k}),fo:v.fo??1,so:v.stroke?1:0})):[];
    return brush.flight(A,B,o,delay,parts);
  },
  // «Буквы имени»: буквы вырываются из цели, складываются в слово над ней, дрожат и по одной
  // улетают по спирали к заклинателю (A — цель, B — заклинатель). Возвращает время прилёта последней буквы.
  // С outward: true (см. play) всё наоборот: A — заклинатель, B — цель; слово (text) летит в цель.
  // Пробел в text — пустое место между словами («КО МНЕ!»).
  letters(A, B, o, delay) {
    const word = [...String(o.text || A.name || "ИМЯ").toUpperCase()].map(ch => ch === "Й" ? "И" : ch).filter(ch => ch === " " || GLYPHS[ch]).slice(0, o.max || 10);
    while (word.length && word[word.length - 1] === " ") word.pop();
    while (word.length && word[0] === " ") word.shift();
    if (!word.length) word.push(..."ИМЯ");
    const n = word.length, fs = Math.round((o.size || 0.38) * DPI), gap = fs * 0.78;
    const tUp = o.up || 650, tHold = o.hold || 450, stag = o.stagger ?? 110;
    const dist = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const tFly = Math.max(650, dist / DPI / (o.speed || 7) * 1000);
    const total = tUp + tHold + stag * (n - 1) + tFly;
    const ghosts = o.ghosts ?? 2, z = Date.now() + 40;
    const L = word.map((ch, k) => {
      if (ch === " ") return { ch };
      const sx = A.x + (k - (n - 1) / 2) * gap, sy = A.y - (A.r || DPI / 2) * (o.lift ?? 0.95) - (k % 2 ? 0.08 : 0) * DPI;   // lift — высота слова над токеном (в радиусах)
      const bend = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.9) * DPI;
      const spin = (Math.random() * 2 - 1) * 260, ph = Math.random() * TAU;
      const mk = (fo, gz) => glyph({ ch, fs, x: A.x, y: A.y, color: o.color || "#ece8ff", stroke: o.stroke || "#1d1038", font: o.font, z: gz });
      const g = poly({ x: A.x, y: A.y, pts: starPts(fs * .66, 4, .22), fill: o.glow || "#a78bfa", fo: 0, n: 14, z: z + k * 10 });
      const main = mk(0, z + k * 10 + 5), gh = [];
      const sh = glyph({ ch, fs, x: A.x, y: A.y, color: o.stroke || "#1d1038", z: z + k * 10 + 4 });
      for (let j = 1; j <= ghosts; j++) gh.push(mk(0, z + k * 10 + 5 - j));
      return { ch, k, sx, sy, bend, spin, ph, g, main, sh, gh };
    }).filter(l => l.ch !== " ");
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
        return { x: l.sx + Math.sin(tm * 0.019 + l.ph) * j, y: l.sy + Math.cos(tm * 0.023 + l.ph) * j,
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
      const ill = 0.95 + 0.05 * Math.cos(tm * 0.006 + Math.sin(tm * 0.002));   // лёгкое «дрожание» иллюзии
      let A = ap * (1 - out) * ill;
      if (o.glitch && out > 0) A *= 1 - out * (0.52 + 0.40 * Math.sin(tm * 0.021));   // иллюзия «рвётся»
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
    const ops = [0.26, 0.91, 0.84];
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
        const A0 = c01(tl / 80) * A1, sh = 0.79 + 0.21 * Math.sin(tm * 0.007 + s.ph);
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
  const stamp=epoch;await grid();
  const info = await tokens(ids);if(stamp!==epoch)return;
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
  const stamp=epoch, astraEpoch = astra.epoch();
  await grid();
  const info = await tokens([...new Set([cId, ...tIds].filter(Boolean))]);
  const C = cId && info[cId] ? { id: cId, ...info[cId] } : null;
  let T = tIds.filter(id => info[id]).map(id => ({ id, ...info[id] }));
  const pt0 = opt.pt || (Array.isArray(opt.pts) && opt.pts[0]) || null;   // несколько точек (Метеоритный дождь) — первая считается «точкой области»
  const PT = pt0 && isFinite(pt0.x) && isFinite(pt0.y) ? { id: "@pt", x: +pt0.x, y: +pt0.y, r: DPI / 2 } : null;
  if (!T.length && C && !PT) T = [C];
  if (!T.length && PT && opt.asTarget) T = [PT];   // направленное заклинание «в место» — точка как цель
  if (!T.length && !PT) return hits;
  // точка области: прицел, а без него — центр целей (кроме заклинателя)
  const pointOf = () => {
    if (PT) return PT;
    const L = T.filter(t => !C || t.id !== C.id), S = L.length ? L : T;
    return { id: "@pt", x: S.reduce((s, t) => s + t.x, 0) / S.length, y: S.reduce((s, t) => s + t.y, 0) / S.length, r: S[0].r };
  };
  if(stamp!==epoch)return hits;
  if(A.id!=="meteor-swarm-astra")await calibrate();
  if(stamp!==epoch)return hits;
  for (const step of A.cast || []) {
    const st={...step,finish:step.finish??finish(A.id,A.visualElement)};
    if (st.fx === "astra-solar-rift") {
      const points = Array.isArray(opt.pts) && opt.pts.length ? opt.pts : [pointOf()];
      Object.assign(hits, await astra.run(points, T, DPI, A.area?.radius || 40, st, astraEpoch));
      continue;
    }
    const fn = FX[st.fx]; if (!fn) { console.warn("[fx] неизвестный эффект", st.fx); continue; }
    const d0 = st.delay || 0, stag = st.stagger || 0;
    if (st.fx === "cone" || (st.to === "point" && (st.fx === "projectile" || st.fx === "beam" || st.fx === "bolt" || st.fx === "threads" || st.fx === "seam"))) {
      if (!C) continue;   // один снаряд / один конус в точку области; цели «загораются» в момент попадания
      const h = d0 + fn(C, pointOf(), st, d0);
      hits["@pt"] = Math.max(hits["@pt"] || 0, h);
      T.forEach(t => { hits[t.id] = Math.max(hits[t.id] || 0, h); });
      continue;
    }
    if (st.fx === "letters") {   // от цели к заклинателю; outward: true — от заклинателя к цели (это и есть «попадание»)
      if (!C) continue;
      T.forEach((t, k) => {
        if (t.id === C.id && !st.outward) return;
        const d = d0 + stag * k + (st.after === "hit" ? hits[t.id] || 0 : 0);
        if (st.outward) hits[t.id] = Math.max(hits[t.id] || 0, d + fn(C, t, st, d));
        else ret[t.id] = Math.max(ret[t.id] || 0, d + fn(t, C, st, d));
      });
      continue;
    }
    if (st.fx === "watch" || st.fx === "pillar") {   // часы / столп света у каждой цели; их hitAt — момент попадания
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
export async function startAura(parts, tok, abilityId, el) {
  const stamp=epoch;await Promise.all([grid(),calibrate()]);
  const T = (await tokens([tok]))[tok];
  if (!T) throw new Error("token not found");
  const items = [], fs = [], z = Date.now();
  const appear = t => c01(t / 0.5);
  for (const raw of parts || []) {
    const p={...raw,finish:finish(abilityId,el)};
    const col = p.color || "#b48cff", per = p.period || 2, pu = p.pulse ?? 0.04, op = p.opacity, sp = p.spin || 0;
    const wave = t => Math.sin(t * TAU / per);
    const fl = t => 1 - (p.flicker || 0) * Math.pow(0.5 + 0.5 * Math.sin(t * 7.3 + Math.sin(t * 2.1) * 3), 4);   // «мерцание»
    const plate=brush.aura(p,T,tok,z+items.length);
    if(plate){items.push(plate.it);fs.push(plate.f);
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
      const geom = (u, fa, t) => {
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
          const ang = b.a + fan + u*.072*Math.sin(t*TAU/per2-f*1.8), len = S * (0.7 + 0.9 * Math.pow(f, 1.2)) * (0.4 + 0.6 * u), wid = S * (0.09 + 0.05 * f);
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
        const G = geom(u, fa, t);
        for (const w of WL) {
          const m = q => ({ x: q.x * w.sd, y: q.y + lift });
          const mem = [G.sh, G.el, G.wr, G.tp, ...G.fe.slice().reverse().map(f => ({ x: f.b.x + Math.cos(f.ang) * f.len * 0.92, y: f.b.y + Math.sin(f.ang) * f.len * 0.92 }))].map(m);
          P.set(w.mem.id, { pts: mem, fo: A * (p.membrane ?? 0.55), so: A * 0.4 });
          for (const f of w.fe) {
            const g = G.fe[f.k], sh2 = 0.5 + 0.5 * Math.sin(t * 2.4 - f.k * 0.6);
            if (f.bon) P.set(f.it.id, { pts: [g.b, { x: g.b.x + Math.cos(g.ang) * g.len * 0.5, y: g.b.y + Math.sin(g.ang) * g.len * 0.5 + S * 0.02 }, { x: g.b.x + Math.cos(g.ang) * g.len * 0.85, y: g.b.y + Math.sin(g.ang) * g.len * 0.85 }].map(m), so: A * 0.85 });
            else P.set(f.it.id, { pts: blade(g.b, g.ang, g.len, g.wid).map(m), fo: A * (p.fill ?? 0.92), so: A * (0.18 + 0.69 * Math.pow(sh2, 3)) });
          }
          const arm = [G.sh, G.el, G.wr, G.tp].map(m);
          P.set(w.arm.id, { pts: arm, so: A * 0.95 }); P.set(w.armHi.id, { pts: arm, so: A * 0.35 });
          const ca = Math.atan2(G.tp.y - G.wr.y, G.tp.x - G.wr.x), cl = S * 0.22;
          P.set(w.claw.id, { pts: [{ x: G.tp.x + Math.sin(ca) * S * 0.03, y: G.tp.y - Math.cos(ca) * S * 0.03 }, { x: G.tp.x + Math.cos(ca - 0.5) * cl, y: G.tp.y + Math.sin(ca - 0.5) * cl }, { x: G.tp.x - Math.sin(ca) * S * 0.03, y: G.tp.y + Math.cos(ca) * S * 0.03 }].map(m), fo: A, so: A });
        }
      });
    } else if (p.fx === "shard") {
      // Осколок Линзы: парящий кристалл над токеном, лучи, блик и круг света (p.light — радиус в клетках, 10 фт = 2),
      // внутри которого «идёт время»: медленно вращается циферблат, поднимаются пылинки
      const o = op ?? 1, c2 = p.color2 || "#ff7a2e", core = p.core || "#fff4dc", L = p.layer || "MOUNT";
      const R = (p.light ?? 2) * DPI, h = T.r * (p.size || 0.5), hy = -T.r * (p.height ?? 0.95), lo = p.lightOpacity ?? 1;
      const cfg = { x: T.x, y: T.y, attach: tok };
      const dial=brush.item('lens',T,R,R*2.15,R*2.15,{...p,attach:tok,layer:L,z:z+items.length},[(p.clock??24)*Math.PI/180,0,0]);items.push(dial);
      const nR = p.rays ?? 7, rays = [];
      for (let k = 0; k < nR; k++) { const it = poly({ ...cfg, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], fill: k % 2 ? col : core, z: z + items.length }); items.push(it); rays.push({ it, k }); }
      const halo = poly({ ...cfg, pts: ringPts(h * 1.25, 28, 0, hy), fill: col, z: z + items.length }); items.push(halo);
      const halo2 = poly({ ...cfg, pts: ringPts(h * 0.75, 24, 0, hy), fill: core, z: z + items.length }); items.push(halo2);
      // кристалл со сколом снизу: контур, светлая грань, ребро
      const BODY = [[0, -1], [0.5, -0.4], [0.42, 0.42], [0.16, 0.62], [0.06, 0.86], [-0.14, 0.58], [-0.44, 0.44], [-0.5, -0.32]];
      const FACE = [[0, -1], [-0.5, -0.32], [-0.44, 0.44], [-0.14, 0.58], [-0.02, 0.05]];
      const RIDGE = [[0, -1], [-0.02, 0.05], [0.06, 0.86]];
      const body = poly({ ...cfg, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], fill: col, stroke: c2, sw: DPI * 0.02, z: z + items.length }); items.push(body);
      const face = poly({ ...cfg, pts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], fill: core, z: z + items.length }); items.push(face);
      const ridge = poly({ ...cfg, pts: [{ x: 0, y: 0 }, { x: 1, y: 1 }], stroke: core, sw: DPI * 0.012, closed: false, z: z + items.length }); items.push(ridge);
      const glint = poly({ ...cfg, pts: starPts(1, 4, 0.2), fill: "#ffffff", z: z + items.length }); items.push(glint);
      fs.push((t, P) => {
        const ap = Math.max(0.01, out3(c01(t / 0.9))), A = o * c01(t / 0.5) * fl(t), br = 0.85 + 0.15 * wave(t);
        P.set(dial.id,brush.phase(ap,t,A*lo));
        const bob = Math.sin(t * TAU / 3.2) * h * 0.12, cy = hy + bob, ang = t * 1.15, cs = Math.cos(ang);
        const kx = (0.42 + 0.58 * Math.abs(cs)) * (cs < 0 ? -1 : 1) * h * 0.85, map = L2 => L2.map(([u, v]) => ({ x: u * kx, y: cy + v * h }));
        for (const q of rays) {
          const a = q.k / nR * TAU + t * 0.22, len = h * (1.9 + 0.6 * Math.sin(t * 1.9 + q.k * 2.1)) * ap, wd = 0.07;
          P.set(q.it.id, { pts: [{ x: Math.cos(a + wd) * h * 0.3, y: cy + Math.sin(a + wd) * h * 0.3 }, { x: Math.cos(a) * len, y: cy + Math.sin(a) * len }, { x: Math.cos(a - wd) * h * 0.3, y: cy + Math.sin(a - wd) * h * 0.3 }],
            fo: A * 0.2 * (0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(t * 1.6 + q.k * 2.4), 2)) });
        }
        P.set(halo.id, { pts: ringPts(h * 1.25 * (1 + 0.08 * wave(t)), 28, 0, cy), fo: 0.22 * A * br });
        P.set(halo2.id, { pts: ringPts(h * 0.75 * (1 + 0.1 * wave(t)), 24, 0, cy), fo: 0.3 * A * br });
        P.set(body.id, { pts: map(BODY), fo: 0.88 * A, so: 0.9 * A });
        P.set(face.id, { pts: map(FACE), fo: A * (0.25 + 0.6 * Math.pow(Math.max(0, Math.sin(ang * 2)), 2)) });
        P.set(ridge.id, { pts: map(RIDGE), so: 0.7 * A });
        const g = ((t + 0.4) % (p.glintEvery || 2.8)) / 0.5;
        P.set(glint.id, g < 1 ? { pts: starPts(h * 0.55 * Math.sin(Math.PI * g) + 0.5, 4, 0.18, g * 0.7, kx * 0.05, cy - h * 0.95), fo: A * Math.sin(Math.PI * g) } : { fo: 0 });
      });
    } else if (p.fx === "image") {
      const it = picture({ x: T.x, y: T.y, url: p.url, cells: (p.size || 1.5) * T.r * 2 / DPI, px: p.px, pxh: p.pxh, mime: p.mime, attach: tok, layer: p.layer, s: 0.01, z: z + items.length });
      items.push(it);
      fs.push((t, P) => P.set(it.id, { s: Math.max(0.01, out3(appear(t))) * (1 + pu * wave(t)), r: sp * t }));
    }
  }
  if (!items.length) throw new Error("empty aura");
  if(!await addTracked(items,stamp))throw Error("scene changed");
  const a = { ids: items.map(i => i.id), loop: true, t0: now(), f: (t, P) => fs.forEach(f => f(t, P)) };
  anims.add(a); kick();
  return { tok, a };
}
// Зона в точке (Тьма): висит, пока её не снимут. Rc — радиус в клетках; quick — без «разливания» (смена радиуса)
// tok — id токена: зона прикрепляется к нему и двигается вместе с ним (pt — его текущий центр)
export async function startZone(p, pt, Rc, quick, tok) {
  const stamp=epoch;await Promise.all([grid(),calibrate()]);
  const R=Math.max(1,Rc*DPI),fade=p.fade||1400,enter=quick?350:(p.grow||900);
  const c={x:+pt.x,y:+pt.y},it=brush.zoneItem(c,R,{...p,finish:p.ripples?'echo':'shade',attach:tok});
  if(!await addTracked([it],stamp))throw Error('scene changed');
  const a={ids:[it.id],loop:true,t0:now(),f:(t,P)=>{const q=c01(t*1000/enter);const alpha=a.until==null?1:c01((a.until-now())/fade);
    P.set(it.id,brush.phase(.035+.965*out3(q),t,q*alpha*(p.opacity??.95)));}};anims.add(a);kick();return {tok:tok||null,pt:c,a,fade};
}
export function stopAura(r,del=true){if(!r)return;if(del&&r.fade&&anims.has(r.a)){r.a.until=now()+r.fade;kick();return;}
 anims.delete(r.a);for(const id of r.a.ids)live.delete(id);if(del)void remove(r.a.ids);}
export function stopAll(){astra.stop();epoch++;queued=[];anims.clear();clearTimeout(timer);timer=null;nextTick=Infinity;
 const ids=[...live.keys()];live.clear();void remove(ids);calibration=null;pivot={x:0,y:0};}

// ── Петля времени ──
// Снимок позиций: короткая голубая «вспышка затвора» на каждом токене (pts: [{x,y,r}])
export async function loopMark(pts=[],o={}){
 const stamp=epoch;await Promise.all([grid(),calibrate()]);if(stamp!==epoch)return;
 for(const q of pts.slice(0,80))brush.cast.sigil(q,{color:o.color||'#69caf3',finish:'ward',radius:q.r*1.17/DPI,duration:900,points:4,runes:8,spin:-36},0);
}
// Keep the logic-facing instant of the rewind opaque (the GM moves the tokens underneath).
export const LOOP_PEAK=1500, LOOP_HOLD=260;
export async function loopFlash(moves=[],o={}){
 const stamp=epoch;await Promise.all([grid(),calibrate()]);const E=LOOP_PEAK+LOOP_HOLD+1900;
 let c=moves[0]?.a||{x:0,y:0},w=DPI*32,h=DPI*20;
 try{const [W,H]=await Promise.all([OBR.viewport.getWidth(),OBR.viewport.getHeight()]);const [a,b]=await Promise.all([OBR.viewport.inverseTransformPoint({x:0,y:0}),OBR.viewport.inverseTransformPoint({x:W,y:H})]);c={x:(a.x+b.x)/2,y:(a.y+b.y)/2};w=Math.max(1,Math.abs(b.x-a.x));h=Math.max(1,Math.abs(b.y-a.y));}catch{}
 if(stamp!==epoch)return LOOP_PEAK;
 const opt={...o,color:o.color||'#70bcf3',core:'#ebfaff',finish:'ward'};
 const it=brush.item('dial',c,Math.min(w,h)*.30,w*1.15,h*1.15,{...opt,layer:'POINTER'});
 // All plates in the same acknowledged batch: the return value starts the GM timer.
 const routes=moves.slice(0,60).filter(m=>Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y)>DPI*.2).map(m=>{const R=DPI*.040,L=Math.hypot(m.b.x-m.a.x,m.b.y-m.a.y);return brush.pathItem('beam',m.a,m.b,R,opt,[L/R,1,.8],5*R);});
 const items=[...routes,it];try{if(!await addTracked(items,stamp))return LOOP_PEAK;}catch(e){if(stamp!==epoch)return LOOP_PEAK;it.layer='ATTACHMENT';if(!await addTracked(items,stamp))return LOOP_PEAK;}
 anims.add({ids:items.map(x=>x.id),dur:E,t0:now(),f:(p,P)=>{const ms=p*E,t=ms/1000;
 P.set(it.id,brush.phase(p,t,c01(ms/280)*c01((E-ms)/460)));for(const q of routes)P.set(q.id,brush.phase(c01(ms/LOOP_PEAK),t,c01(ms/240)*c01((LOOP_PEAK-ms)/180)));}});kick();return LOOP_PEAK;
}
