// Общие константы расширения «Легендарные действия»
export const NS = "legendary";
export const CH = `${NS}/announce`;      // канал broadcast
export const POP = `${NS}/banner`;       // id всплывающей надписи
export const STORE = `${NS}.v1`;         // ключ localStorage панели

// Цветовые темы надписи: a — акцент, b — второй тон градиента, g — свечение
export const THEMES = {
  gold:   { name: "Золото",   a: "#F3D27A", b: "#C8912F", g: "#E8B44F" },
  blood:  { name: "Кровь",    a: "#FF8A7A", b: "#C8322B", g: "#E2453A" },
  arcane: { name: "Аркана",   a: "#D9B8FF", b: "#8C5BEA", g: "#A877FF" },
  frost:  { name: "Лёд",      a: "#BDEBFF", b: "#4FA9E0", g: "#6CC6F5" },
  venom:  { name: "Яд",       a: "#C9F59A", b: "#5FB53A", g: "#86D85A" },
  shadow: { name: "Тень",     a: "#E6E1F0", b: "#8A8598", g: "#B4AEC4" },
};

export const DURATIONS = [3, 5, 7, 10];  // секунды показа
