// Логика ходов: превращает изменения инициативы в события «начало/конец хода»
// и решает, какие эффекты закончились. Без зависимостей от Owlbear.

export function norm(s) {
  return String(s || "").toLowerCase().replace(/ё/g, "е")
    .replace(/\s*[×x]\s*\d+\s*$/u, "")     // «Гоблин ×3»
    .replace(/[\s#№]*\d+\s*$/u, "")         // «Гоблин 2», «Гоблин #2»
    .replace(/\s+/g, " ").trim();
}
export const sameName = (a, b) => { const x = norm(a), y = norm(b); return !!x && x === y; };

// Найти участника инициативы по имени токена
export function matchChip(name, chips) {
  const x = norm(name); if (!x || !Array.isArray(chips)) return null;
  let c = chips.find(c => norm(c.n) === x);
  if (!c) c = chips.find(c => { const y = norm(c.n); return y && (x.startsWith(y) || y.startsWith(x)); });
  return c ? String(c.n) : null;
}

export const samePos = (a, b) => (!a && !b) || (!!a && !!b && a.r === b.r && a.i === b.i && a.w === b.w);

// prev — прошлая позиция {r, i, w}; P — данные трекера {r, chips:[{n, on}]}
export function turnEvents(prev, P) {
  const chips = P && Array.isArray(P.chips) ? P.chips : [];
  const i = chips.findIndex(c => c && c.on);
  if (i < 0) return { pos: prev || null, events: [] };
  const r = Number(P.r) || 1, pos = { r, i, w: String(chips[i].n) };
  if (!prev) return { pos, events: [] };
  if (samePos(prev, pos)) return { pos, events: [] };
  const N = chips.length;
  let j = chips.findIndex(c => String(c.n) === prev.w);
  if (j < 0) j = Math.min(prev.i, N - 1);
  const steps = (r - prev.r) * N + (i - j);
  if (steps <= 0) return { pos, events: [] };        // откат назад или новый бой — не трогаем
  const ev = [{ t: "e", w: prev.w }];
  if (steps <= N * 2) for (let k = 1; k < steps; k++) {
    const w = String(chips[(j + k) % N].n);
    ev.push({ t: "s", w }, { t: "e", w });
  }
  ev.push({ t: "s", w: pos.w });
  return { pos, events: ev };
}

// Эффект: {w: чей ход, m: "s" начало | "e" конец | "x" вручную, n: какой по счёту ход, k: сколько ходов уже началось}
export function applyEvents(list, events) {
  const keep = [], gone = []; let touched = false;
  for (const e of list) {
    let alive = true;
    if (e.m === "s" || e.m === "e") for (const ev of events) {
      if (!sameName(ev.w, e.w)) continue;
      if (ev.t === "s") {
        e.k = (e.k || 0) + 1; touched = true;
        if (e.m === "s" && e.k >= (e.n || 1)) { alive = false; break; }
      } else if (e.m === "e" && (e.k || 0) >= (e.n ?? 1)) { alive = false; break; }
    }
    (alive ? keep : gone).push(e);
  }
  return { keep, gone, touched: touched || gone.length > 0 };
}

export function untilText(e) {
  if (e.m !== "s" && e.m !== "e") return "пока не снимут";
  const n = e.n ?? 1, w = e.w;
  if (e.m === "e" && n === 0) return `до конца этого хода: ${w}`;
  const which = n === 1 ? "следующего" : `${n}-го`;
  const left = n > 1 ? ` (прошло ${Math.min(e.k || 0, n)}/${n})` : "";
  return `до ${e.m === "s" ? "начала" : "конца"} ${which} хода: ${w}${left}`;
}
