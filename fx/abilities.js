// ✨ СПОСОБНОСТИ
// Сюда добавляются новые заклинания и умения боссов. Формат описан в README.md.
//
// cast  — анимация применения (шаги идут по порядку, after:"hit" = в момент попадания)
// aura  — висящий эффект на токене (необязательно)
// auraOn — "targets" (на целях, по умолчанию) или "caster"
// until — сколько держится по умолчанию: {who:"target"|"caster", when:"s"(начало)|"e"(конец)|"x"(вручную), n:какой ход}
//         n: 1 = следующий ход, 0 (только для "e") = конец текущего, 10 = «1 минута»
// В панели мастер всё равно может поменять длительность перед применением.
//
// area     — заклинание по области (как в BG3): нужен только «Кто», точку выбирают кликом по карте.
//            {shape:"sphere", radius: футы, range: футы} или {shape:"cone", length: футы}
// elements — список стихий из ELEMENTS; в шагах можно писать цвета "$c1" "$c2" "$c3" "$d",
//            шаг с el:"fire" (или [..]) играет только для этой стихии, per:{lightning:{...}} — доп. опции шага.

// Палитры стихий: c1 — основной, c2 — светлый, c3 — ядро/вспышка, d — дым/тёмный
export const ELEMENTS = {
  fire:      { name: "🔥 Огонь",         c1: "#ff5a10", c2: "#ffb347", c3: "#fff1b0", d: "#3a2a22" },
  cold:      { name: "❄️ Холод",         c1: "#3fa9ff", c2: "#a8e4ff", c3: "#ffffff", d: "#5d7f99" },
  acid:      { name: "🧪 Кислота",       c1: "#6fd62a", c2: "#c6ff6a", c3: "#f2ffd8", d: "#3c5a14" },
  lightning: { name: "⚡ Электричество", c1: "#4f7dff", c2: "#ffe45c", c3: "#ffffff", d: "#2c3466" },
  poison:    { name: "☠️ Яд",            c1: "#2fae4a", c2: "#9be36b", c3: "#e4ffd6", d: "#24502a" },
  thunder:   { name: "🔊 Звук",          c1: "#9d8cff", c2: "#d9d1ff", c3: "#ffffff", d: "#3a3366" },
  psychic:   { name: "🧠 Психическая",   c1: "#ff4fc4", c2: "#ffb0ea", c3: "#ffffff", d: "#4a1442" },
};
export const elOf = (A, el) => A && Array.isArray(A.elements) && A.elements.length ? (A.elements.includes(el) ? el : A.elements[0]) : null;

// Перекрасить способность под стихию (возвращает копию; без elements — как есть)
export function paint(A, el) {
  const key = elOf(A, el); if (!key) return A;
  const pal = ELEMENTS[key] || {};
  const sub = v => typeof v === "string" ? (v[0] === "$" && pal[v.slice(1)] ? pal[v.slice(1)] : v)
    : Array.isArray(v) ? v.map(sub)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)])) : v;
  const steps = list => Array.isArray(list) ? list
    .filter(s => !s.el || [].concat(s.el).includes(key))
    .map(s => { const { per, ...r } = s; return sub(per && per[key] ? { ...r, ...per[key] } : r); }) : list;
  return { ...A, cast: steps(A.cast), castSave: steps(A.castSave), aura: steps(A.aura) };
}

export const ABILITIES = [
  // ─── Арка 7 · Шариты ───
  {
    id: "niala-name-theft", name: "Похищение имени", icon: "🫥", group: "Арка 7 · Мать Ниала",
    save: "Мдр СЛ 14",
    // Провал: тёмная нить хватает цель, из неё вырываются буквы её имени, складываются в слово,
    // дрожат и по одной улетают по спирали к Ниале, которая их «втягивает»
    cast: [
      { fx: "beam", color: "#3b1f63", core: "#cfc6ff", width: 0.06, duration: 2600, hitAt: 250 },
      { fx: "area", at: "targets", after: "hit", color: "#140b26", edge: "#9d8cff", radius: 0.95, opacity: 0.55, duration: 1500 },
      { fx: "burst", at: "targets", after: "hit", color: "#a78bfa", core: "#f5f3ff", radius: 0.85, sparks: 12 },
      { fx: "rise", at: "targets", after: "hit", delay: 120, color: "#d9d4ff", core: "#ffffff", count: 16, height: 0.8, duration: 1100 },
      // буквы имени цели (берутся из имени токена; можно задать вручную: text: "ИМЯ")
      { fx: "letters", after: "hit", delay: 150, color: "#ece8ff", stroke: "#1d1038", glow: "#a78bfa", size: 0.38, speed: 7, ghosts: 2 },
      { fx: "implode", at: "caster", after: "return", delay: -700, color: "#7c3aed", core: "#ede9fe", radius: 1.1, sparks: 14, duration: 800 },
      { fx: "burst", at: "caster", after: "return", color: "#6d28d9", core: "#e9e4ff", radius: 0.7, sparks: 8, flash: 0.6 },
    ],
    // Успех: нить рвётся, имя остаётся у цели — половина урона, без эффекта
    castSave: [
      { fx: "beam", color: "#3b1f63", core: "#cfc6ff", width: 0.05, duration: 600, hitAt: 220 },
      { fx: "burst", at: "targets", after: "hit", color: "#a78bfa", core: "#f5f3ff", radius: 0.6, sparks: 6, flash: 0.5 },
      { fx: "rise", at: "targets", after: "hit", delay: 100, color: "#d9d4ff", count: 6, height: 0.4, duration: 800 },
    ],
    // «Забытая»: блеклая серая пелена, мерцающий обрывочный круг, гаснущие искры
    aura: [
      { fx: "glow", color: "#3b3355", size: 1.35, opacity: 0.4, flicker: 0.5 },
      { fx: "ring", color: "#8f86b8", size: 1.12, width: 0.04, dash: true, spin: 12, opacity: 0.65, flicker: 0.7 },
      { fx: "orbit", color: "#cfc8ff", count: 5, size: 0.045, radius: 0.92, speed: -25, opacity: 0.75, flicker: 0.8 },
      { fx: "wisps", color: "#2a2140", color2: "#4a3f6b", count: 4, size: 0.3, radius: 0.9, speed: -15, opacity: 0.25 },
    ],
    until: { who: "target", when: "e", n: 1 },
  },

  // ─── Арка 7 · Тёмная юстициарша ───
  {
    id: "justiciar-shadow-net", name: "Сеть теней", icon: "🕸️", group: "Арка 7 · Тёмная юстициарша",
    attack: true,
    // Попадание: у руки юстициарши сгущается тьма, из пальцев веером вылетают пять нитей чистой тьмы,
    // извиваясь летят к цели, обвиваются вокруг неё и сплетаются в сеть; потом отрываются от руки
    cast: [
      { fx: "implode", at: "caster", color: "#6d28d9", core: "#d8ccff", fill: "#07030f", radius: 0.7, sparks: 8, duration: 420 },
      { fx: "threads", delay: 260, count: 5, speed: 9, wrap: 0.9, wrapTime: 480, hold: 550, fade: 650, color: "#7c3aed", dark: "#07030f", core: "#c4b5fd" },
      { fx: "web", at: "targets", after: "hit", color: "#7c3aed", core: "#ede9fe", radius: 0.7, spokes: 9, rings: 4, unfold: 380, twist: -160, duration: 1500 },
      { fx: "smoke", at: "targets", after: "hit", delay: 150, color: "#0b0616", color2: "#24123f", radius: 0.75, count: 7, size: 0.3, rise: 0.1, opacity: 0.4, duration: 1500 },
      { fx: "shock", at: "targets", after: "hit", delay: 380, color: "#c4b5fd", radius: 0.95, rings: 2, width: 0.035, duration: 500 },
      { fx: "burst", at: "targets", after: "hit", delay: 380, color: "#6d28d9", core: "#ede9fe", radius: 0.6, sparks: 10, flash: 0.35, duration: 550 },
    ],
    // Промах: нити пролетают мимо, хватают пустоту за целью и втягиваются обратно в руку; недоплетённая сеть рассыпается
    castSave: [
      { fx: "implode", at: "caster", color: "#6d28d9", core: "#d8ccff", fill: "#07030f", radius: 0.7, sparks: 8, duration: 420 },
      { fx: "threads", delay: 260, miss: true, overshoot: 1.2, side: 0.4, count: 5, speed: 9, wrap: 0.35, wrapTime: 300, hold: 150, fade: 700, retract: true, color: "#7c3aed", dark: "#07030f", core: "#c4b5fd" },
      { fx: "web", at: "miss", after: "hit", color: "#7c3aed", core: "#ede9fe", radius: 0.5, spokes: 8, rings: 3, duration: 900, hold: 0.35 },
      { fx: "smoke", at: "miss", after: "hit", delay: 250, color: "#0b0616", color2: "#24123f", radius: 0.6, count: 6, size: 0.28, rise: 0.25, opacity: 0.4, duration: 1300 },
    ],
    // «Опутан»: на цели висит светящаяся сеть теней, под ней — тёмная лужа, вокруг клубится тьма;
    // по нитям бегут блики, сеть время от времени дёргается
    aura: [
      { fx: "glow", color: "#1a0b33", size: 1.45, opacity: 0.4 },
      { fx: "web", color: "#7c3aed", core: "#e9ddff", size: 1.2, spokes: 9, rings: 4, opacity: 0.9 },
      { fx: "wisps", color: "#0b0616", color2: "#2a1250", count: 5, size: 0.3, radius: 0.95, speed: -12, opacity: 0.35 },
      { fx: "orbit", color: "#c4b5fd", color2: "#7c3aed", count: 3, size: 0.035, radius: 1.15, speed: 30, opacity: 0.7, flicker: 0.6 },
    ],
    auraDelay: 450,
    until: { who: "target", when: "x", n: 1 },
  },
  {
    id: "justiciar-net-pull", name: "Подтянуть сетью", icon: "🪝", group: "Арка 7 · Тёмная юстициарша",
    cast: [
      { fx: "implode", at: "caster", color: "#6d28d9", core: "#d8ccff", fill: "#07030f", radius: 0.6, sparks: 6, duration: 300 },
      { fx: "threads", delay: 150, count: 4, speed: 18, amp: 0.1, wrap: 0.45, wrapTime: 260, hold: 180, fade: 520, lag: 25, retract: true, color: "#7c3aed", dark: "#07030f", core: "#c4b5fd" },
      { fx: "web", at: "targets", after: "hit", color: "#7c3aed", core: "#ede9fe", radius: 0.6, spokes: 9, rings: 3, unfold: 160, twist: 40, duration: 700, hold: 0.4 },
      { fx: "shock", at: "targets", after: "hit", color: "#c4b5fd", radius: 0.8, rings: 2, width: 0.04, duration: 450 },
      { fx: "implode", at: "caster", after: "hit", delay: 300, color: "#6d28d9", core: "#d8ccff", radius: 0.7, sparks: 8, duration: 500 },
    ],
    pull: 10, pullDelay: 230,   // подтянуть цели на 10 фт к заклинателю через 230 мс после «попадания»
  },

  // ─── Гуур'Дэж ───
  {
    id: "guurdezh-swing-watch", name: "Качнуть часы", icon: "🕰️", group: "Гуур'Дэж",
    save: "Мдр СЛ 15",
    // Провал: рядом с целью возникают иллюзорные часы на цепочке, качаются, на циферблате крутится спираль,
    // расходятся волны; затем огромная спираль закручивается вокруг цели и стягивается в неё
    cast: [
      { fx: "watch", color: "#e8c15a", edge: "#6b4a12", face: "#fff6dc", glow: "#c084fc", size: 0.23, length: 0.75, swing: 30, period: 1100, duration: 3000, hitAt: 1500 },
      { fx: "spiral", at: "targets", after: "hit", color: "#a855f7", color2: "#f0abfc", radius: 1.4, turns: 2.5, spin: 600, duration: 1400 },
      { fx: "implode", at: "targets", after: "hit", delay: 500, color: "#c084fc", core: "#fdf4ff", radius: 1.2, sparks: 12, duration: 900 },
      { fx: "shock", at: "targets", after: "hit", delay: 1250, color: "#e9d5ff", radius: 1.0, rings: 2, duration: 600 },
      { fx: "rise", at: "targets", after: "hit", delay: 1250, color: "#e9d5ff", core: "#fff6dc", count: 10, height: 0.6, duration: 1000 },
    ],
    // Успех: часы качаются, но цель отводит взгляд — иллюзия рвётся и гаснет
    castSave: [
      { fx: "watch", color: "#e8c15a", edge: "#6b4a12", face: "#fff6dc", glow: "#c084fc", size: 0.23, length: 0.75, swing: 30, period: 1100, duration: 2000, hitAt: 1150, glitch: true },
      { fx: "burst", at: "targets", after: "hit", color: "#c084fc", core: "#fdf4ff", radius: 0.6, sparks: 8, stars: true, flash: 0.4 },
    ],
    // «Гипноз»: спираль под целью, сходящиеся кольца, тикающие часы над головой, золотые искорки
    aura: [
      { fx: "glow", color: "#6d28d9", size: 1.3, opacity: 0.22 },
      { fx: "hypno", color: "#a855f7", color2: "#f0abfc", size: 1.2, turns: 2.2, spin: -80, opacity: 0.55, clockColor: "#e8c15a" },
      { fx: "orbit", color: "#f5d77a", color2: "#f0abfc", count: 4, size: 0.04, radius: 1.0, speed: 45, opacity: 0.85, flicker: 0.4 },
    ],
    until: { who: "target", when: "e", n: 1 },
  },

  // ─── Примеры (можно удалить, когда появятся свои) ───
  {
    id: "firebolt", name: "Огненный снаряд", icon: "🔥", group: "Примеры",
    attack: true,
    cast: [
      { fx: "projectile", color: "#ff5a10", core: "#ffe08a", size: 0.34, speed: 13, trail: 7, embers: 10 },
      { fx: "burst", at: "targets", after: "hit", color: "#ff7a1a", core: "#fff1b0", radius: 0.85, sparks: 12 },
      { fx: "shock", at: "targets", after: "hit", color: "#ffb347", radius: 1.1, rings: 1, duration: 450 },
      { fx: "embers", at: "targets", after: "hit", color: "#ffb347", color2: "#ff4d10", count: 10, height: 0.9, duration: 1300 },
      { fx: "smoke", at: "targets", after: "hit", delay: 120, color: "#3d3530", color2: "#5a4c44", count: 5, radius: 0.7, size: 0.28, opacity: 0.4, duration: 1600 },
    ],
    castSave: [   // промах
      { fx: "projectile", miss: true, overshoot: 1.5, color: "#ff5a10", core: "#ffe08a", size: 0.34, speed: 13, trail: 7, embers: 8 },
      { fx: "burst", at: "miss", after: "hit", color: "#ff7a1a", core: "#fff1b0", radius: 0.5, sparks: 6, flash: 0.3 },
      { fx: "smoke", at: "miss", after: "hit", delay: 80, color: "#3d3530", color2: "#5a4c44", count: 4, radius: 0.45, size: 0.22, opacity: 0.4, duration: 1200 },
    ],
  },
  {
    id: "fireball", name: "Огненный шар", icon: "☄️", group: "Примеры",
    save: "Лов", area: { shape: "sphere", radius: 20, range: 150 },
    cast: [
      { fx: "projectile", to: "point", color: "#ff8a1a", core: "#fff1b0", size: 0.22, speed: 9, arc: 1, trail: 10, embers: 14 },
      { fx: "burst", at: "center", after: "hit", color: "#ffd36b", core: "#ffffff", radius: 2.2, sparks: 0, duration: 450 },
      { fx: "area", at: "center", after: "hit", color: "#ff4a0a", edge: "#ffb347", radius: 4, opacity: 0.45, duration: 1800 },
      { fx: "area", at: "center", after: "hit", color: "#ffd36b", edge: "#fff1b0", radius: 2.4, opacity: 0.4, duration: 900 },
      { fx: "shock", at: "center", after: "hit", color: "#ffe2a0", radius: 4.6, rings: 2, width: 0.07, duration: 800 },
      { fx: "debris", at: "center", after: "hit", color: "#2b1d14", color2: "#5c3b22", hot: "#ff8a1a", radius: 3.6, count: 16, size: 0.11, duration: 1200 },
      { fx: "smoke", at: "center", after: "hit", delay: 350, color: "#2e2622", color2: "#4b3f38", radius: 3.6, count: 14, size: 0.7, rise: 0.8, opacity: 0.5, duration: 3000 },
      { fx: "embers", at: "center", after: "hit", delay: 200, spread: 3.5, count: 24, height: 1.4, duration: 2200 },
      { fx: "burst", at: "targets", after: "hit", delay: 120, stagger: 60, color: "#ff7a1a", radius: 0.8, sparks: 8 },
    ],
  },
  {
    id: "heal", name: "Лечение", icon: "💚", group: "Примеры",
    cast: [
      { fx: "sigil", at: "targets", color: "#5ee0a0", rune: "#c9ffe4", radius: 1, points: 7, runes: 6, duration: 1700, spin: 40, fill: 0.1 },
      { fx: "burst", at: "targets", delay: 200, color: "#5ee0a0", core: "#e8fff2", radius: 0.9, sparks: 0, flash: 0.5 },
      { fx: "shock", at: "targets", delay: 200, color: "#a8f5cf", radius: 1.2, rings: 2, duration: 900 },
      { fx: "rise", at: "targets", delay: 150, color: "#7be3b9", core: "#ffffff", count: 18, height: 1.6, duration: 1700, glyph: "+", glyphEvery: 3 },
    ],
  },
  {
    id: "curse", name: "Проклятие", icon: "🕯️", group: "Примеры",
    cast: [
      { fx: "bolt", wave: true, color: "#6b21a8", core: "#e9d5ff", width: 0.05, jag: 0.22, freq: 2.5, duration: 1100, grow: 0.3 },
      { fx: "sigil", at: "targets", after: "hit", color: "#a24bff", rune: "#e0c3ff", radius: 1.1, points: 5, runes: 8, duration: 1900, spin: 50 },
      { fx: "implode", at: "targets", after: "hit", delay: 300, color: "#7c3aed", core: "#f0d9ff", radius: 1.3, sparks: 14, duration: 900 },
      { fx: "smoke", at: "targets", after: "hit", delay: 900, color: "#1e1030", color2: "#3b1f5c", radius: 0.8, count: 6, size: 0.3, rise: 0.6, opacity: 0.45, duration: 1600 },
    ],
    aura: [
      { fx: "sigil", color: "#a24bff", rune: "#d6b3ff", size: 1.2, runes: 6, spin: 18, opacity: 0.7, fill: 0.06, flicker: 0.2 },
      { fx: "wisps", color: "#2a1145", color2: "#4c1d7a", count: 4, size: 0.3, radius: 0.9, opacity: 0.35 },
      { fx: "orbit", color: "#d6b3ff", count: 3, size: 0.05, speed: -70 },
    ],
    until: { who: "caster", when: "e", n: 1 },
  },
  {
    id: "stun", name: "Оглушение", icon: "💫", group: "Примеры",
    cast: [
      { fx: "bolt", from: "sky", color: "#ffe066", core: "#ffffff", width: 0.07, jag: 0.35, duration: 380, grow: 0.12, height: 4 },
      { fx: "burst", at: "targets", after: "hit", color: "#ffd84a", core: "#ffffff", radius: 0.9, sparks: 10, stars: true },
      { fx: "shock", at: "targets", after: "hit", color: "#fff3b0", radius: 1.4, rings: 3, duration: 650 },
    ],
    aura: [{ fx: "stars", color: "#ffe066", color2: "#ffffff", count: 3, size: 0.1, speed: 150 }],
    until: { who: "target", when: "e", n: 1 },
  },
  {
    id: "shield", name: "Щит веры", icon: "🛡️", group: "Примеры",
    cast: [
      { fx: "rise", at: "targets", color: "#ffd36b", core: "#fffbe6", count: 12, height: 1.2, duration: 1200 },
      { fx: "implode", at: "targets", color: "#ffd36b", core: "#fffbe6", fill: "#fff4cc", radius: 1.8, sparks: 18, duration: 750 },
      { fx: "shock", at: "targets", delay: 700, color: "#fff1c2", radius: 1.6, rings: 2, duration: 700 },
      { fx: "burst", at: "targets", delay: 700, color: "#ffd36b", core: "#fffbe6", radius: 1.1, sparks: 8, flash: 0.5 },
    ],
    auraDelay: 650,   // купол появляется, когда искры собрались
    aura: [
      { fx: "glow", color: "#ffd36b", size: 1.4, opacity: 0.18 },
      { fx: "dome", color: "#ffcf5a", grid: "#ffe39a", highlight: "#fffbe6", size: 1.35, cells: 3.4 },
    ],
    until: { who: "target", when: "x" },
  },
  {
    id: "boss-dusk", name: "Сумрачная кара", icon: "🌑", group: "Босс (пример)",
    cast: [
      { fx: "bolt", color: "#3a1060", core: "#ff7ad9", width: 0.08, jag: 0.4, segments: 11, duration: 900, grow: 0.15, flick: 60 },
      { fx: "area", at: "targets", after: "hit", color: "#2a0a45", edge: "#ff7ad9", radius: 1.5, opacity: 0.45, duration: 1200 },
      { fx: "shock", at: "targets", after: "hit", color: "#ff7ad9", radius: 1.8, rings: 2, duration: 700 },
      { fx: "debris", at: "targets", after: "hit", color: "#1a0826", color2: "#3a1060", hot: "#ff4fb8", radius: 1.6, count: 12, size: 0.1 },
      { fx: "smoke", at: "targets", after: "hit", delay: 150, color: "#14061f", color2: "#2d0b45", radius: 1.4, count: 9, size: 0.45, opacity: 0.55, duration: 2200 },
      { fx: "burst", at: "targets", after: "hit", delay: 100, color: "#c040ff", core: "#ffd0f5", radius: 1.1, sparks: 14 },
    ],
    aura: [
      { fx: "glow", color: "#5a0f8a", size: 1.4, opacity: 0.35 },
      { fx: "wisps", color: "#14061f", color2: "#3a1060", count: 5, size: 0.32, radius: 0.95, speed: -20, opacity: 0.4 },
      { fx: "ring", color: "#ff4fb8", size: 1.12, width: 0.045, dash: true, spin: -55 },
    ],
    until: { who: "caster", when: "s", n: 1 },
  },
  {
    id: "chromatic-spear", name: "Стихийное копьё", icon: "🔱", group: "Заклинания",
    attack: true,
    cast: [
      { fx: "projectile", shape: "spear", color: "#c9b8ff", core: "#ffffff", color2: "#ffe08a", length: 1.1, size: 0.3, speed: 10, trail: 0,
        glow: 0.3, glowColors: ["#ff6a1a", "#7fd6ff", "#7be33a", "#ffe45c", "#b7a6ff"],
        ribbons: ["#ff6a1a", "#7fd6ff", "#7be33a", "#ffe45c", "#b7a6ff"], ribbonLen: 9, ribbonAmp: 0.16, embers: 8 },
      { fx: "burst", at: "targets", after: "hit", color: "#ffffff", core: "#ffffff", radius: 0.7, sparks: 0, flash: 0.6, duration: 450 },
      { fx: "burst", at: "targets", after: "hit", color: "#ff6a1a", core: "#ffe08a", radius: 0.85, sparks: 8 },
      { fx: "debris", at: "targets", after: "hit", delay: 120, color: "#bfe9ff", color2: "#ffffff", hot: "#7fd6ff", radius: 1.1, count: 9, size: 0.09 },
      { fx: "smoke", at: "targets", after: "hit", delay: 220, color: "#2f6a14", color2: "#7be33a", radius: 0.7, count: 5, size: 0.25, rise: 0.3, opacity: 0.45, duration: 1300 },
      { fx: "bolt", from: "sky", after: "hit", delay: 300, color: "#ffe45c", core: "#ffffff", width: 0.05, jag: 0.35, duration: 380, grow: 0.12, height: 1.6 },
      { fx: "shock", at: "targets", after: "hit", delay: 420, color: "#b7a6ff", radius: 1.5, rings: 3, width: 0.05, duration: 650 },
      { fx: "embers", at: "targets", after: "hit", delay: 200, color: "#ffb347", color2: "#7fd6ff", count: 10, height: 0.8, duration: 1200 },
    ],
    castSave: [   // промах
      { fx: "projectile", shape: "spear", miss: true, overshoot: 1.6, color: "#c9b8ff", core: "#ffffff", color2: "#ffe08a", length: 1.1, size: 0.3, speed: 10, trail: 0,
        glow: 0.3, glowColors: ["#ff6a1a", "#7fd6ff", "#7be33a", "#ffe45c", "#b7a6ff"],
        ribbons: ["#ff6a1a", "#7fd6ff", "#7be33a", "#ffe45c", "#b7a6ff"], ribbonLen: 9, ribbonAmp: 0.16, embers: 6 },
      { fx: "burst", at: "miss", after: "hit", color: "#c9b8ff", core: "#ffffff", radius: 0.5, sparks: 6, flash: 0.3 },
      { fx: "shock", at: "miss", after: "hit", color: "#b7a6ff", radius: 0.8, rings: 1, duration: 450 },
    ],
  },
  {
    id: "sorcerous-burst", name: "Чародейский выброс", icon: "💥", group: "Заклинания",
    attack: true,
    elements: ["fire", "cold", "acid", "lightning", "poison", "thunder", "psychic"],
    cast: [
      { fx: "burst", at: "caster", color: "$c1", core: "$c3", radius: 0.55, sparks: 6, flash: 0.35, duration: 380 },
      { fx: "projectile", delay: 120, color: "$c1", core: "$c3", size: 0.26, speed: 15, arc: 0.35, trail: 8, embers: 10 },
      { fx: "projectile", delay: 190, color: "$c2", core: "$c3", size: 0.16, speed: 15, arc: -0.35, trail: 6, embers: 4 },
      { fx: "burst", at: "targets", after: "hit", color: "$c1", core: "$c3", radius: 0.85, sparks: 10 },
      { fx: "shock", at: "targets", after: "hit", color: "$c2", radius: 1.15, rings: 2, duration: 550 },
      { fx: "burst", at: "targets", after: "hit", delay: 260, color: "$c2", core: "$c3", radius: 0.55, sparks: 6, flash: 0.3, duration: 420 },   // «взрывающаяся» восьмёрка
      { fx: "embers", at: "targets", after: "hit", delay: 120, color: "$c2", color2: "$c1", core: "$c3", count: 10, height: 0.8, duration: 1200 },
      { fx: "smoke", el: ["fire", "acid", "poison"], at: "targets", after: "hit", delay: 200, color: "$d", color2: "$c1", radius: 0.6, count: 5, size: 0.24, rise: 0.3, opacity: 0.4, duration: 1300 },
      { fx: "debris", el: "cold", at: "targets", after: "hit", color: "#bfe9ff", color2: "#ffffff", hot: "#7fd6ff", radius: 1, count: 9, size: 0.08 },
      { fx: "bolt", el: "lightning", from: "sky", after: "hit", delay: 80, color: "$c2", core: "#ffffff", width: 0.05, jag: 0.35, duration: 380, grow: 0.12, height: 1.6 },
      { fx: "shock", el: "thunder", at: "targets", after: "hit", delay: 150, color: "$c3", radius: 1.8, rings: 3, width: 0.05, duration: 700 },
      { fx: "spiral", el: "psychic", at: "targets", after: "hit", color: "$c1", color2: "$c2", radius: 0.9, duration: 1000 },
    ],
    castSave: [   // промах
      { fx: "burst", at: "caster", color: "$c1", core: "$c3", radius: 0.55, sparks: 6, flash: 0.35, duration: 380 },
      { fx: "projectile", miss: true, delay: 120, overshoot: 1.5, color: "$c1", core: "$c3", size: 0.26, speed: 15, arc: 0.35, trail: 8, embers: 8 },
      { fx: "burst", at: "miss", after: "hit", color: "$c1", core: "$c3", radius: 0.5, sparks: 6, flash: 0.3 },
      { fx: "shock", at: "miss", after: "hit", color: "$c2", radius: 0.8, rings: 1, duration: 450 },
    ],
  },
  {
    id: "dragons-breath", name: "Дыхание дракона", icon: "🐉", group: "Заклинания",
    save: "Лов", area: { shape: "cone", length: 15 },
    elements: ["fire", "cold", "acid", "lightning", "poison"],
    cast: [
      { fx: "burst", at: "caster", color: "$c1", core: "$c3", radius: 0.6, sparks: 0, flash: 0.45, duration: 350 },
      { fx: "cone", delay: 120, color: "$c1", color2: "$c2", core: "$c3", length: 3, count: 42, duration: 1700,
        per: { lightning: { bolts: 6 }, cold: { count: 50, size: 0.18 }, poison: { size: 0.3, duration: 2100 } } },
      { fx: "burst", at: "targets", after: "hit", stagger: 70, color: "$c1", core: "$c3", radius: 0.7, sparks: 6 },
      { fx: "embers", el: ["fire", "lightning"], at: "targets", after: "hit", color: "$c2", color2: "$c1", core: "$c3", count: 8, height: 0.8, duration: 1200 },
      { fx: "debris", el: "cold", at: "targets", after: "hit", color: "#bfe9ff", color2: "#ffffff", hot: "#7fd6ff", radius: 0.9, count: 8, size: 0.08 },
      { fx: "smoke", at: "point", after: "hit", delay: 450, color: "$d", color2: "$c1", radius: 1.3, count: 9, size: 0.45, rise: 0.4, opacity: 0.35, duration: 2300 },
    ],
  },
  {
    id: "dragons-breath-buff", name: "Дыхание дракона — наделение", icon: "🐲", group: "Заклинания",
    elements: ["fire", "cold", "acid", "lightning", "poison"],
    cast: [
      { fx: "sigil", at: "targets", color: "$c1", rune: "$c3", radius: 0.9, points: 6, runes: 5, duration: 1400, spin: 60, fill: 0.1 },
      { fx: "rise", at: "targets", delay: 150, color: "$c2", core: "$c3", count: 14, height: 1.3, duration: 1400 },
      { fx: "burst", at: "targets", delay: 250, color: "$c1", core: "$c3", radius: 0.8, sparks: 0, flash: 0.4 },
    ],
    aura: [
      { fx: "glow", color: "$c1", size: 1.25, opacity: 0.28, flicker: 0.3 },
      { fx: "wisps", color: "$c1", color2: "$c2", count: 4, size: 0.18, radius: 0.85, speed: 35, opacity: 0.45 },
    ],
    auraDelay: 300,
    until: { who: "caster", when: "x", n: 10 },
  },
  {
    id: "bow-shot", name: "Выстрел из лука", icon: "🏹", group: "Оружие",
    attack: true,
    cast: [
      { fx: "projectile", shape: "arrow", length: 0.85, size: 0.12, speed: 26, arc: 0.3, trail: 4, color: "#e8e2d0", core: "#ffffff", stick: 1300 },
      { fx: "burst", at: "targets", after: "hit", color: "#e8dcc0", core: "#ffffff", radius: 0.45, sparks: 6, flash: 0.3, duration: 450 },
      { fx: "debris", at: "targets", after: "hit", color: "#8b5a2b", color2: "#c9a36b", hot: "#e8dcc0", radius: 0.6, count: 5, size: 0.05, duration: 600 },
      { fx: "shock", at: "targets", after: "hit", color: "#ffffff", radius: 0.6, rings: 1, width: 0.03, duration: 350 },
    ],
    castSave: [   // промах
      { fx: "projectile", shape: "arrow", miss: true, overshoot: 1.3, side: 0.3, length: 0.85, size: 0.12, speed: 26, arc: 0.3, trail: 4, color: "#e8e2d0", core: "#ffffff", stick: 1500 },
      { fx: "smoke", at: "miss", after: "hit", color: "#6b5a45", color2: "#9c8a70", radius: 0.35, count: 4, size: 0.16, rise: 0.15, opacity: 0.4, duration: 900 },
    ],
  },
  {
    id: "darkness", name: "Тьма", icon: "🌑", group: "Заклинания",
    area: { shape: "sphere", radius: 15, range: 60, adjust: [5, 60, 5] },
    zone: { fx: "gloom" },
    attachable: true,   // можно прикрепить к токену (предмету) — зона ездит вместе с ним
    zoneDelay: 550,
    cast: [
      { fx: "implode", at: "center", color: "#8a5cff", core: "#e9ddff", fill: "#05030a", radius: 1.6, sparks: 22, duration: 700 },
      { fx: "shock", at: "center", delay: 600, color: "#6d46c9", radius: 3.4, rings: 3, width: 0.06, opacity: 0.7, duration: 900 },
      { fx: "smoke", at: "center", delay: 650, color: "#0b0714", color2: "#1d1233", radius: 2.6, count: 14, size: 0.7, rise: 0.15, opacity: 0.4, duration: 3200, zo: 30 },
      { fx: "smoke", at: "center", delay: 2600, color: "#0b0714", color2: "#241640", radius: 2.8, count: 10, size: 0.65, rise: 0.2, opacity: 0.3, duration: 3000, zo: 30 },
    ],
  },
  {
    id: "mage-armor", name: "Доспехи мага", icon: "🔮", group: "Заклинания",
    cast: [
      { fx: "sigil", at: "targets", color: "#5b8cff", rune: "#d6e4ff", radius: 1.15, points: 6, runes: 10, spin: 60, fill: 0.08, duration: 1900 },
      { fx: "rise", at: "targets", delay: 200, color: "#8fb4ff", core: "#ffffff", count: 16, height: 1.3, duration: 1500 },
      { fx: "spiral", at: "targets", delay: 350, color: "#6f97ff", color2: "#cfe0ff", radius: 1.4, turns: 2, spin: -420, width: 0.04, opacity: 0.85, duration: 1100 },
      { fx: "implode", at: "targets", delay: 500, color: "#7aa2ff", core: "#eef3ff", fill: "#0b1640", radius: 1.5, sparks: 16, duration: 800 },
      { fx: "shock", at: "targets", delay: 1250, color: "#cfe0ff", radius: 1.5, rings: 2, width: 0.045, duration: 700 },
      { fx: "burst", at: "targets", delay: 1250, color: "#7aa2ff", core: "#ffffff", radius: 1.0, sparks: 10, stars: true, flash: 0.45 },
    ],
    auraDelay: 1250,   // поле появляется, когда спираль сомкнулась
    aura: [
      { fx: "glow", color: "#4f7dff", size: 1.3, opacity: 0.16, period: 3 },
      { fx: "ring", color: "#9db8ff", size: 1.08, width: 0.035, dash: true, spin: 18, opacity: 0.6, period: 3, flicker: 0.2 },
      { fx: "ring", color: "#cfe0ff", size: 1.17, width: 0.018, spin: -10, opacity: 0.3, period: 4 },
      { fx: "orbit", color: "#e6eeff", color2: "#7aa2ff", count: 4, size: 0.035, radius: 1.12, speed: 35, opacity: 0.85 },
    ],
    until: { who: "target", when: "x" },
  },
  {
    id: "armor-of-richter", name: "Доспех Рихтера", icon: "🪨", group: "Заклинания",
    cast: [
      { fx: "sigil", at: "targets", color: "#a08a5c", rune: "#efe2c4", radius: 1.1, points: 4, runes: 6, spin: 30, fill: 0.1, duration: 1500 },
      { fx: "implode", at: "targets", delay: 100, color: "#8c7f6b", core: "#e8f4ff", fill: "#2a241c", radius: 1.7, sparks: 20, duration: 850 },
      { fx: "smoke", at: "targets", delay: 700, color: "#6b604f", color2: "#9a8e78", radius: 0.9, count: 8, size: 0.3, rise: 0.2, opacity: 0.45, duration: 1500 },
      { fx: "shock", at: "targets", delay: 750, color: "#c9bfa8", radius: 1.3, rings: 2, width: 0.06, duration: 600 },
      { fx: "debris", at: "targets", delay: 750, color: "#5e5446", color2: "#8a7d66", hot: "#d8f0ff", radius: 1.0, count: 10, size: 0.08, height: 0.4, duration: 900 },
      { fx: "burst", at: "targets", delay: 950, color: "#bfe6ff", core: "#ffffff", radius: 0.7, sparks: 7, stars: true, flash: 0.35 },
    ],
    auraDelay: 750,   // пластины слетаются в момент удара
    aura: [
      { fx: "glow", color: "#6b5d48", size: 1.3, opacity: 0.2, period: 3 },
      { fx: "plates", color: "#7d705c", color2: "#93856d", edge: "#d6cbb2", glint: "#e6f6ff", count: 8, radius: 0.95, width: 0.2, glints: 4 },
    ],
    until: { who: "target", when: "x" },
  },
  {
    id: "shield-spell", name: "Щит", icon: "🔰", group: "Заклинания",
    self: true,
    cast: [
      { fx: "shock", at: "targets", color: "#bfe3ff", radius: 1.7, rings: 3, width: 0.05, duration: 500 },
      { fx: "burst", at: "targets", color: "#7fc8ff", core: "#ffffff", radius: 1.25, sparks: 12, stars: true, flash: 0.7, duration: 500 },
      { fx: "implode", at: "targets", color: "#9fd6ff", core: "#ffffff", fill: "#0a2036", radius: 1.4, sparks: 10, duration: 450 },
    ],
    auraDelay: 120,
    aura: [
      { fx: "glow", color: "#7fc8ff", size: 1.45, opacity: 0.12 },
      { fx: "dome", color: "#7fc8ff", grid: "#cfeaff", highlight: "#ffffff", size: 1.4, cells: 3, fill: 0.1, opacity: 0.85 },
    ],
    until: { who: "caster", when: "s", n: 1 },
  },
  {
    id: "shadow-step", name: "Шаг в тень", icon: "🐦‍⬛", group: "Шадар-кай",
    area: { shape: "sphere", radius: 2.5, range: 30 },
    teleport: true, teleportDelay: 520,
    cast: [
      // отправление: тень сжимается в точку, токен «тает», чёрные перья и дым
      { fx: "implode", at: "caster", color: "#5b4a7a", core: "#cfc6e6", fill: "#07050d", radius: 1.3, sparks: 16, duration: 560 },
      { fx: "smoke", at: "caster", color: "#0d0b14", color2: "#2a2340", radius: 0.9, count: 10, size: 0.36, opacity: 0.6, rise: 0.35, duration: 1500, delay: 120 },
      { fx: "rise", at: "caster", color: "#15121f", core: "#6c5f8f", count: 12, height: 1.6, duration: 1300, delay: 200 },
      { fx: "shock", at: "caster", color: "#8d7fb8", radius: 1.2, rings: 1, width: 0.04, opacity: 0.5, duration: 450, delay: 380 },
      // прибытие: из клубов тени проступает призрачный силуэт
      { fx: "area", at: "point", color: "#0b0912", edge: "#6c5f8f", radius: 0.75, opacity: 0.45, duration: 1200, delay: 380 },
      { fx: "smoke", at: "point", color: "#0d0b14", color2: "#3a3158", radius: 1.1, count: 12, size: 0.38, opacity: 0.55, rise: 0.4, duration: 1700, delay: 480 },
      { fx: "burst", at: "point", color: "#6c5f8f", core: "#e6e1f5", radius: 1.1, sparks: 12, flash: 0.35, duration: 650, delay: 560 },
      { fx: "shock", at: "point", color: "#b9b0d8", radius: 1.5, rings: 2, width: 0.04, opacity: 0.7, duration: 600, delay: 580 },
      { fx: "rise", at: "point", color: "#15121f", core: "#9a8fc0", count: 10, height: 1.3, duration: 1300, delay: 650 },
    ],
    // призрачный облик (3+ уровень): бледное свечение, дрожащий контур и клубы тени
    auraOn: "caster", auraDelay: 650,
    aura: [
      { fx: "glow", color: "#d9d3f0", size: 1.25, opacity: 0.22, pulse: 0.08, period: 2.6, flicker: 0.5 },
      { fx: "ring", color: "#cfc6e6", size: 1.08, width: 0.035, dash: true, opacity: 0.55, spin: -12, flicker: 0.6 },
      { fx: "wisps", color: "#0d0b14", color2: "#4a4068", count: 5, radius: 0.9, size: 0.32, opacity: 0.4, speed: 18, flicker: 0.3 },
    ],
    until: { who: "caster", when: "s", n: 1 },
  },
  // ── Ролен · Ключ Порога ──
  {
    id: "rolen-resonance", name: "Резонанс", icon: "💠", group: "Ролен · Ключ Порога",
    self: true, auraOn: "caster", auraDelay: 450, until: { who: "caster", when: "e", n: 10 },
    // браслет тянет свет к себе → вспышка → вены загораются от кисти к плечу (само зажигание — в ауре «arm»)
    cast: [
      { fx: "implode", at: "caster", color: "#38c8ff", core: "#e8fbff", radius: 1.6, sparks: 14, duration: 600 },
      { fx: "sigil", at: "caster", delay: 100, color: "#38c8ff", rune: "#e8fbff", radius: 0.95, points: 6, runes: 8, spin: 60, duration: 1300 },
      { fx: "burst", at: "caster", delay: 420, color: "#9eeaff", core: "#ffffff", radius: 0.9, sparks: 10, flash: 0.6 },
      { fx: "shock", at: "caster", delay: 440, color: "#38c8ff", radius: 2, rings: 2, width: 0.04, opacity: 0.8, duration: 900 },
      { fx: "rise", at: "caster", delay: 600, color: "#9eeaff", count: 10, height: 1, duration: 1400 },
    ],
    aura: [
      { fx: "glow", color: "#38c8ff", size: 3, opacity: 0.09, period: 3.5, pulse: 0.03 },
      { fx: "glow", color: "#9eeaff", size: 1.3, opacity: 0.2, period: 2.2, flicker: 0.2 },
      { fx: "arcs", color: "#38c8ff", core: "#e8fbff", count: 6, radius: 1.08, width: 0.028, rate: 1.4 },
      { fx: "ring", color: "#38c8ff", size: 1.1, width: 0.025, dash: true, spin: 18, opacity: 0.4, flicker: 0.25 },
      { fx: "orbit", color: "#9eeaff", color2: "#ffffff", count: 3, radius: 1.12, size: 0.04, speed: 80 },
    ],
  },
  {
    id: "rolen-seam", name: "Шов Порога", icon: "🐦‍⬛", group: "Ролен · Ключ Порога",
    save: "Лов", area: { shape: "sphere", radius: 2.5, range: 30, line: 5 }, teleport: true, teleportDelay: 420,
    cast: [
      { fx: "implode", at: "caster", color: "#38c8ff", radius: 1.4, sparks: 12, duration: 420 },
      { fx: "smoke", at: "caster", delay: 250, color: "#0b0912", color2: "#1c2a3a", radius: 1.2, count: 9, size: 0.5, rise: 0.4, opacity: 0.6, duration: 1600 },
      { fx: "rise", at: "caster", delay: 300, color: "#0b0912", count: 8, height: 1, duration: 1300 },
      { fx: "seam", to: "point", delay: 330, color: "#38c8ff", core: "#e8fbff", width: 0.08, veins: 1.6, veinLen: 0.65, pulse: 1.1, duration: 3400 },
      { fx: "burst", at: "targets", after: "hit", delay: 60, stagger: 80, color: "#38c8ff", core: "#ffffff", radius: 0.8, sparks: 10, flash: 1 },
      { fx: "shock", at: "targets", after: "hit", delay: 60, stagger: 80, color: "#9eeaff", radius: 1.1, rings: 1, width: 0.04, duration: 600 },
      { fx: "burst", at: "center", after: "hit", delay: 150, color: "#9eeaff", core: "#ffffff", radius: 1.2, sparks: 14 },
      { fx: "shock", at: "center", after: "hit", delay: 170, color: "#38c8ff", radius: 1.8, rings: 2, width: 0.05, duration: 800 },
    ],
  },
  {
    id: "rolen-awakening", name: "Пробуждение Порога", icon: "🪽", group: "Ролен · Ключ Порога",
    self: true, auraOn: "caster", auraDelay: 1000, until: { who: "caster", when: "e", n: 10 },
    // рунный круг Ключа, тени и свет стягиваются к Ролену → вспышка, разлетаются чёрные перья и костяная крошка, раскрываются крылья
    cast: [
      { fx: "sigil", at: "caster", color: "#38c8ff", rune: "#e8fbff", radius: 1.45, points: 7, runes: 12, spin: 35, fill: 0.08, duration: 2300 },
      { fx: "implode", at: "caster", delay: 100, color: "#5fd6ff", core: "#e8fbff", fill: "#05070d", radius: 1.7, sparks: 22, duration: 850 },
      { fx: "smoke", at: "caster", delay: 150, color: "#07060c", color2: "#1a2433", radius: 1.1, count: 9, size: 0.38, rise: 0.15, opacity: 0.45, duration: 1300 },
      { fx: "spiral", at: "caster", delay: 250, color: "#38c8ff", color2: "#bff4ff", radius: 1.5, turns: 2, spin: -380, width: 0.035, opacity: 0.8, duration: 900 },
      { fx: "burst", at: "caster", delay: 900, color: "#38c8ff", core: "#ffffff", radius: 1.15, sparks: 16, stars: true, flash: 0.55 },
      { fx: "shock", at: "caster", delay: 910, color: "#bff4ff", radius: 2.2, rings: 3, width: 0.045, opacity: 0.8, duration: 900 },
      { fx: "debris", at: "caster", delay: 920, color: "#0b0912", color2: "#d8d0bf", hot: "#38c8ff", radius: 1.8, count: 14, size: 0.09, duration: 1100 },
      { fx: "rise", at: "caster", delay: 950, color: "#15121f", core: "#5fd6ff", count: 14, height: 1.5, duration: 1600 },
      { fx: "embers", at: "caster", delay: 1000, color: "#38c8ff", color2: "#e8fbff", spread: 1.3, count: 14, height: 1.1, duration: 1800 },
    ],
    aura: [
      { fx: "wings", color: "#0a0910", edge: "#38c8ff", bone: "#d8d0bf", shade: "#121826", size: 1.25, feathers: 11, period: 3.4 },
      { fx: "glow", color: "#38c8ff", size: 1.5, opacity: 0.18, period: 3 },
      { fx: "wisps", color: "#0b0912", color2: "#1a2433", count: 4, size: 0.4, radius: 0.9, speed: 18, opacity: 0.3 },
      { fx: "arcs", color: "#38c8ff", core: "#e8fbff", count: 6, radius: 1.12, width: 0.03, rate: 1.2 },
      { fx: "ring", color: "#9eeaff", size: 1.14, width: 0.035, spin: -10, opacity: 0.6 },
      { fx: "orbit", color: "#9eeaff", color2: "#ffffff", count: 4, radius: 1.15, size: 0.05, speed: 60 },
    ],
  },
];

export const ABIL = Object.fromEntries(ABILITIES.map(a => [a.id, a]));

// Как целиться: "area" — область (нужен только заклинатель);
// "dir" — направленное от заклинателя: клик по токену ИЛИ по месту; "tok" — клик только по токену.
// Радиус регулируемой области (A.area.adjust = [мин, макс, шаг], в футах)
export function radOf(A, r) {
  const ar = A && A.area; if (!ar || !ar.adjust) return null;
  const [lo, hi, st] = ar.adjust, v = Math.round((+r || ar.radius) / st) * st;
  return Math.max(lo, Math.min(hi, v));
}
// Способность с другим радиусом: превью прицела и все шаги «в центре» масштабируются
export function sized(A, r) {
  const v = radOf(A, r); if (!v || v === A.area.radius) return A;
  const k = v / A.area.radius, f = L => (L || []).map(s => s.at === "center" && s.radius ? { ...s, radius: s.radius * k } : s);
  return { ...A, area: { ...A.area, radius: v }, cast: f(A.cast), ...(A.castSave ? { castSave: f(A.castSave) } : {}) };
}
export function aimKind(A) {
  if (!A) return null;
  if (A.self) return "self";   // на себя — без прицела
  if (A.area) return "area";
  const dir = (A.cast || []).some(s => s.fx === "projectile" || s.fx === "beam" || s.fx === "letters" || s.fx === "threads" || (s.fx === "bolt" && s.from !== "sky"));
  return dir ? "dir" : "tok";
}
