// Общие константы расширения «Музыка»
export const NS = "music";
export const META = `${NS}/now`;          // ключ метаданных комнаты: что сейчас играет
export const CH = `${NS}/local`;          // локальный канал между окнами расширения
export const POP = `${NS}/plate`;         // id плашки
export const POP_MOVE = `${NS}/move`;     // id слоя перемещения
export const SDK = "https://esm.sh/@owlbear-rodeo/sdk@3";

// ключи localStorage (у каждого игрока свои)
export const LS_CFG = `${NS}.cfg.v1`;       // настройки мастера
export const LS_POS = `${NS}.pos.v1`;       // положение плашки
export const LS_SEEN = `${NS}.seen.v1`;     // последний трек, который уже показывали крупно
export const LS_HIDDEN = `${NS}.hidden.v1`; // трек, плашку которого закрыли
export const LS_HIST = `${NS}.hist.v1`;     // недавние треки мастера

export const DEF_CFG = { big: 6 };
export const HIST_MAX = 12;

// Положение: отступ правого нижнего угла плашки от правого нижнего угла экрана
export const DEF_POS = { right: 16, bottom: 92 };

// PAD — прозрачный отступ вокруг плашки внутри окна (место для свечения)
export const PAD = 12;
export const PLATE = { big: { w: 404, h: 116 }, small: { w: 284, h: 44 } };
export const SIZE = {
  big: { w: PLATE.big.w + PAD * 2, h: PLATE.big.h + PAD * 2 },
  small: { w: PLATE.small.w + PAD * 2, h: PLATE.small.h + PAD * 2 },
};

export const BIG_CHOICES = [4, 6, 10]; // сколько секунд плашка остаётся крупной
