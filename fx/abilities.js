// ✨ СПОСОБНОСТИ
// Сюда добавляются новые заклинания и умения боссов. Формат описан в README.md.
//
// cast  — анимация применения (шаги идут по порядку, after:"hit" = в момент попадания)
// aura  — висящий эффект на токене (необязательно)
// auraOn — "targets" (на целях, по умолчанию) или "caster"
// until — сколько держится по умолчанию: {who:"target"|"caster", when:"s"(начало)|"e"(конец)|"x"(вручную), n:какой ход}
//         n: 1 = следующий ход, 0 (только для "e") = конец текущего, 10 = «1 минута»
// В панели мастер всё равно может поменять длительность перед применением.

export const ABILITIES = [
  // ─── Арка 7 · Шариты ───
  {
    id: "niala-name-theft", name: "Похищение имени", icon: "🫥", group: "Арка 7 · Мать Ниала",
    desc: "Перезарядка 5–6, 30 фт. Мдр СЛ 14, 4к8 психического. Провал: до конца следующего хода цели союзники не могут выбрать её целью (и лечением).",
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

  // ─── Примеры (можно удалить, когда появятся свои) ───
  {
    id: "firebolt", name: "Огненный снаряд", icon: "🔥", group: "Примеры",
    desc: "Сгусток огня с искрами летит в цель: вспышка, ударное кольцо, угольки и дымок.",
    cast: [
      { fx: "projectile", color: "#ff5a10", core: "#ffe08a", size: 0.34, speed: 13, trail: 7, embers: 10 },
      { fx: "burst", at: "targets", after: "hit", color: "#ff7a1a", core: "#fff1b0", radius: 0.85, sparks: 12 },
      { fx: "shock", at: "targets", after: "hit", color: "#ffb347", radius: 1.1, rings: 1, duration: 450 },
      { fx: "embers", at: "targets", after: "hit", color: "#ffb347", color2: "#ff4d10", count: 10, height: 0.9, duration: 1300 },
      { fx: "smoke", at: "targets", after: "hit", delay: 120, color: "#3d3530", color2: "#5a4c44", count: 5, radius: 0.7, size: 0.28, opacity: 0.4, duration: 1600 },
    ],
  },
  {
    id: "fireball", name: "Огненный шар", icon: "☄️", group: "Примеры",
    desc: "Бусина огня летит по дуге и взрывается сферой 20 фт: вспышка, волны, обломки, угли и густой дым.",
    cast: [
      { fx: "projectile", color: "#ff8a1a", core: "#fff1b0", size: 0.22, speed: 9, arc: 1, trail: 10, embers: 14 },
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
    desc: "Под целью проступает зелёный круг, вверх поднимаются искры и плюсики, мягкая волна света.",
    cast: [
      { fx: "sigil", at: "targets", color: "#5ee0a0", rune: "#c9ffe4", radius: 1, points: 7, runes: 6, duration: 1700, spin: 40, fill: 0.1 },
      { fx: "burst", at: "targets", delay: 200, color: "#5ee0a0", core: "#e8fff2", radius: 0.9, sparks: 0, flash: 0.5 },
      { fx: "shock", at: "targets", delay: 200, color: "#a8f5cf", radius: 1.2, rings: 2, duration: 900 },
      { fx: "rise", at: "targets", delay: 150, color: "#7be3b9", core: "#ffffff", count: 18, height: 1.6, duration: 1700, glyph: "+", glyphEvery: 3 },
    ],
  },
  {
    id: "curse", name: "Проклятие", icon: "🕯️", group: "Примеры",
    desc: "Извивающееся щупальце порчи, под целью рисуется рунический круг, вокруг клубится тьма. До конца следующего хода заклинателя.",
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
    desc: "Молния с неба, звёздная вспышка и волны; над головой кружатся звёздочки. До конца следующего хода цели.",
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
    desc: "Золотые искры стягиваются к цели, и вокруг неё вырастает сияющий купол с сотами. Держится, пока не снимут (концентрация).",
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
    desc: "Тёмная молния, взрыв теней с осколками и дымом, метка на цели до начала следующего хода босса.",
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
    desc: "1 ур., 90 фт. Дальнобойная атака заклинанием. Попадание: по 1к4 огнём, холодом, кислотой, электричеством и звуком (+2к4 за уровень ячейки выше 1-го).",
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
    id: "bow-shot", name: "Выстрел из лука", icon: "🏹", group: "Оружие",
    desc: "Стрела летит по лёгкой дуге и втыкается в цель. Промах — пролетает мимо и втыкается в землю.",
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
];

export const ABIL = Object.fromEntries(ABILITIES.map(a => [a.id, a]));
