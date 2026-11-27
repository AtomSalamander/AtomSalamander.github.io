// Двойник Owlbear для player-end.mjs: фон мастера, комната, один игрок. Остальные вызовы — пустые заглушки.
export { buildEffect, buildCurve, buildImage } from "./sdk-fixture.mjs";
export const room = {};
const msg = [], meta = [];
const clone = x => JSON.parse(JSON.stringify(x));
export async function send(data, connectionId) { for (const [ch, f] of msg) if (ch === "com.dnd-fx/msg") await f({ data: clone(data), connectionId }); }
export async function metaChanged() { for (const f of meta) await f(clone(room)); }
const noop = new Proxy(function () {}, { get: (_, k) => (k === "then" ? undefined : noop), apply: () => Promise.resolve(undefined) });
const api = {
  onReady: f => setTimeout(f, 0),
  player: { id: "GM", getRole: async () => "GM", getConnectionId: async () => "gm-conn", onChange: () => () => {} },
  party: { getPlayers: async () => [{ id: "P", connectionId: "player-conn", role: "PLAYER", name: "Игрок" }], onChange: () => () => {} },
  room: {
    getMetadata: async () => clone(room),
    setMetadata: async m => { Object.assign(room, clone(m)); await metaChanged(); },
    onMetadataChange: f => { meta.push(f); return () => {}; },
  },
  broadcast: { onMessage: (ch, f) => { msg.push([ch, f]); return () => {}; }, sendMessage: async () => {} },
  scene: new Proxy({ isReady: async () => false, onReadyChange: () => () => {} }, { get: (t, k) => (k in t ? t[k] : noop) }),
};
export default new Proxy(api, { get: (t, k) => (k in t ? t[k] : noop) });
