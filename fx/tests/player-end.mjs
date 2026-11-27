// node fx/tests/player-end.mjs — игрок снимает эффекты только разрешённых ему способностей; проверяет фон мастера.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
registerHooks({ resolve(s, c, next) { return s === "https://esm.sh/@owlbear-rodeo/sdk@3" ? { url: new URL("./end-fixture.mjs", import.meta.url).href, shortCircuit: true } : next(s, c); } });
globalThis.window = globalThis; globalThis.addEventListener = () => {};
const ls = new Map(); globalThis.localStorage = { getItem: k => ls.get(k) ?? null, setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) };
const { canEnd, STATE, ALLOW, CH } = await import("../const.js");
const fx = await import("./end-fixture.mjs");
const wait = (ms = 30) => new Promise(r => setTimeout(r, ms));

assert.equal(canEnd({ a: "bless" }, new Set(["bless"]), false), true);
assert.equal(canEnd({ a: "curse" }, new Set(["bless"]), false), false);
assert.equal(canEnd({ a: "curse" }, new Set(), true), true);

const e = (id, a) => ({ id, a, tok: "T", tn: "Токен", s: "e", n: 1 });
fx.room[ALLOW] = ["bless", "shield"];
fx.room[STATE] = { v: 1, e: [e("e1", "bless"), e("e2", "curse"), e("e3", "shield"), e("e4", "darkness")], p: null };
await import("../background.js");
await wait(60);
const ids = () => fx.room[STATE].e.map(x => x.id);
// Игрок: разрешённый эффект снимается, запрещённый — нет (даже если прислать оба сразу).
await fx.send({ op: "del", ids: ["e1", "e2"] }, "player-conn"); await wait();
assert.deepEqual(ids(), ["e2", "e3", "e4"]);
// «Снять все», радиус и привязку игрок не может.
await fx.send({ op: "clear" }, "player-conn"); await wait();
assert.deepEqual(ids(), ["e2", "e3", "e4"]);
// Мастер галочку снял — игрок больше не может снять «Щит».
fx.room[ALLOW] = ["bless"]; await fx.metaChanged(); await wait();
await fx.send({ op: "del", ids: ["e3"] }, "player-conn"); await wait();
assert.deepEqual(ids(), ["e2", "e3", "e4"]);
// Мастер снимает любой.
await fx.send({ op: "del", ids: ["e2", "e4"] }, "gm-conn"); await wait();
assert.deepEqual(ids(), ["e3"]);
console.log("fx player end: игрок снимает только отмеченные способности, мастер — любые OK");
process.exit(0);
