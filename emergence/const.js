// Общие ключи расширения «Эмерджентность»
export const NS = "com.emergence";
export const STATE = NS + "/state";              // состояние боя (метаданные комнаты)
export const CH = NS + "/msg";                   // канал сообщений
export const INIT = "com.dnd-tracker/initiative"; // данные трекера инициативы

// Палитра Эмерджентности (по арту)
export const PAL = {
  cy: "#00D4FF", cy2: "#4DF3FF", navy: "#0A2342", white: "#E9FDFF",
  bone: "#C9D3DC", bone2: "#9DB0C0", boneDk: "#3C4F63",
  lens: "#FF6B35", lens2: "#FFB84D",
};

// Протоколы: цвет Ключа и яркий цвет для тревоги
export const PROTO = {
  div:  { name: "Разделения",  short: "Разделение", key: "Ключ Стены",        color: "#D0F4FF", glow: "#BFEFFF", icon: "🧱" },
  perm: { name: "Перестановки", short: "Перестановка", key: "Ключ Пространства", color: "#9D4EDD", glow: "#B56BFF", icon: "🔀" },
  loop: { name: "Петли",        short: "Петля", key: "Ключ Времени",          color: "#FFD23F", glow: "#FFD23F", icon: "⏳" },
  sil:  { name: "Тишины",       short: "Тишина", key: "Ключ Молчания",        color: "#1A535C", glow: "#2FB8C4", icon: "🔇" },
};

// Типы урона для Перекалибровки
export const DMG = {
  fire: ["огонь", "#FF6A1A"], cold: ["холод", "#9FE6FF"], lightning: ["молния", "#A8B8FF"],
  thunder: ["звук", "#D7C9FF"], acid: ["кислота", "#8CFF3A"], poison: ["яд", "#5FD45A"],
  necrotic: ["некротическая энергия", "#8A5CFF"], radiant: ["излучение", "#FFE066"],
  psychic: ["психическая", "#FF5AD1"], force: ["силовое поле", "#C9A8FF"],
  bludgeoning: ["дробящий", "#D8D8D8"], piercing: ["колющий", "#D8D8D8"], slashing: ["рубящий", "#D8D8D8"],
};

// Висящие эффекты: название и иконка (для списка в панели)
export const EFF = {
  nets:   { name: "Голубые нити (скорость 0)", icon: "🕸" },
  weave:  { name: "Плетение: без реакций", icon: "🧶" },
  charge: { name: "Стирание: зарядка", icon: "🎯" },
  grab:   { name: "Сфера: схвачен", icon: "🐙" },
  appro:  { name: "Присвоение", icon: "👁" },
  stun:   { name: "Линза: оглушена", icon: "💫" },
  open:   { name: "Линза: разомкнута", icon: "⛔" },
  recal:  { name: "Перекалибровка", icon: "🧬" },
  core:   { name: "Обнажённое ядро", icon: "💠" },
};

export function normState(s) {
  const o = s && typeof s === "object" ? s : {};
  return JSON.parse(JSON.stringify({
    v: 1,
    boss: o.boss || null,
    proto: o.proto || null,
    keys: o.keys || {},
    broken: o.broken || {},
    last: o.last || {},
    veins: o.veins !== false,
    autoLoop: o.autoLoop !== false,
    e: Array.isArray(o.e) ? o.e : [],
    p: o.p || null,
    bn: o.bn || "",
    pk: o.pk || null,
    wall: o.wall || null,
    snap: Array.isArray(o.snap) ? o.snap : null,
  }));
}
