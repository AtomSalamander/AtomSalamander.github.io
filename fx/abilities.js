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
    // Провал: тёмная нить хватает цель, из неё вырываются серебряные «буквы» имени и улетают к Ниале
    cast: [
      { fx: "beam", color: "#3b1f63", core: "#cfc6ff", width: 0.06, duration: 1000, hitAt: 250 },
      { fx: "area", at: "targets", after: "hit", color: "#140b26", edge: "#9d8cff", radius: 0.95, opacity: 0.55, duration: 1500 },
      { fx: "burst", at: "targets", after: "hit", color: "#a78bfa", core: "#f5f3ff", radius: 0.85, sparks: 12 },
      { fx: "rise", at: "targets", after: "hit", delay: 120, color: "#d9d4ff", core: "#ffffff", count: 16, height: 0.8, duration: 1100 },
      { fx: "projectile", reverse: true, after: "hit", delay: 450, color: "#c9c2ff", core: "#ffffff", size: 0.16, speed: 8, arc: 0.7, trail: 9 },
      { fx: "projectile", reverse: true, after: "hit", delay: 580, color: "#8b7bd8", core: "#eeeaff", size: 0.11, speed: 8, arc: -0.5, trail: 7 },
      { fx: "burst", at: "caster", after: "return", color: "#6d28d9", core: "#e9e4ff", radius: 0.6, sparks: 6, flash: 0.5 },
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
    ],
    until: { who: "target", when: "e", n: 1 },
  },

  // ─── Примеры (можно удалить, когда появятся свои) ───
  {
    id: "firebolt", name: "Огненный снаряд", icon: "🔥", group: "Примеры",
    desc: "Сгусток огня летит в цель и взрывается искрами.",
    cast: [
      { fx: "projectile", color: "#ff6a1a", core: "#ffe08a", size: 0.35, speed: 14, trail: 6 },
      { fx: "burst", at: "targets", after: "hit", color: "#ff7a1a", core: "#ffe08a", radius: 0.9, sparks: 10 },
    ],
  },
  {
    id: "fireball", name: "Огненный шар", icon: "☄️", group: "Примеры",
    desc: "Летит по дуге в центр целей и взрывается сферой 20 фт.",
    cast: [
      { fx: "projectile", color: "#ff8a1a", core: "#fff1b0", size: 0.25, speed: 10, arc: 0.8, trail: 8 },
      { fx: "area", at: "center", after: "hit", color: "#ff5a10", edge: "#ffd36b", radius: 4, opacity: 0.35, duration: 1500 },
      { fx: "burst", at: "targets", after: "hit", delay: 120, stagger: 60, color: "#ff7a1a", radius: 0.8, sparks: 8 },
    ],
  },
  {
    id: "heal", name: "Лечение", icon: "💚", group: "Примеры",
    desc: "Зелёные искры поднимаются над целью.",
    cast: [
      { fx: "burst", at: "targets", color: "#5ee0a0", core: "#e8fff2", radius: 0.8, sparks: 0, flash: 0.6 },
      { fx: "rise", at: "targets", color: "#7be3b9", count: 14, height: 1.5 },
    ],
  },
  {
    id: "curse", name: "Проклятие", icon: "🕯️", group: "Примеры",
    desc: "Луч порчи, на цели крутится рунический круг. До конца следующего хода заклинателя.",
    cast: [
      { fx: "beam", color: "#9b4dff", core: "#f0d9ff", width: 0.1, duration: 700 },
      { fx: "burst", at: "targets", after: "hit", color: "#9b4dff", core: "#f0d9ff", radius: 0.7, sparks: 6 },
    ],
    aura: [
      { fx: "ring", color: "#a24bff", size: 1.15, width: 0.05, dash: true, spin: 40 },
      { fx: "orbit", color: "#d6b3ff", count: 3, size: 0.06, speed: -70 },
    ],
    until: { who: "caster", when: "e", n: 1 },
  },
  {
    id: "stun", name: "Оглушение", icon: "💫", group: "Примеры",
    desc: "Вспышка и звёздочки над головой. До конца следующего хода цели.",
    cast: [{ fx: "burst", at: "targets", color: "#ffd84a", core: "#ffffff", radius: 0.9, sparks: 8 }],
    aura: [{ fx: "orbit", color: "#ffe066", color2: "#ffffff", count: 4, size: 0.07, radius: 0.75, speed: 140 }],
    until: { who: "target", when: "e", n: 1 },
  },
  {
    id: "shield", name: "Щит веры", icon: "🛡️", group: "Примеры",
    desc: "Золотое сияние вокруг цели. Держится, пока не снимут (концентрация).",
    cast: [{ fx: "rise", at: "targets", color: "#ffd36b", core: "#fffbe6", count: 10, height: 1.2 }],
    aura: [
      { fx: "glow", color: "#ffd36b", size: 1.35, opacity: 0.25 },
      { fx: "ring", color: "#ffe9a8", size: 1.08, width: 0.035, pulse: 0.03, opacity: 0.8 },
    ],
    until: { who: "target", when: "x" },
  },
  {
    id: "boss-dusk", name: "Сумрачная кара", icon: "🌑", group: "Босс (пример)",
    desc: "Луч тьмы, взрыв теней и метка на цели до начала следующего хода босса.",
    cast: [
      { fx: "beam", color: "#3a1060", core: "#ff7ad9", width: 0.16, duration: 900, hitAt: 200 },
      { fx: "area", at: "targets", after: "hit", color: "#2a0a45", edge: "#ff7ad9", radius: 1.5, opacity: 0.45, duration: 1200 },
      { fx: "burst", at: "targets", after: "hit", delay: 100, color: "#c040ff", core: "#ffd0f5", radius: 1.1, sparks: 14 },
    ],
    aura: [
      { fx: "glow", color: "#5a0f8a", size: 1.4, opacity: 0.35 },
      { fx: "ring", color: "#ff4fb8", size: 1.12, width: 0.045, dash: true, spin: -55 },
    ],
    until: { who: "caster", when: "s", n: 1 },
  },
];

export const ABIL = Object.fromEntries(ABILITIES.map(a => [a.id, a]));
