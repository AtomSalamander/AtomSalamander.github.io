// Мост для Kenku FM: нужен, только если панель пишет «Нет связи», а Kenku точно запущен с включённым Remote.
// Пересылает запросы с 127.0.0.1:3334 в Kenku (127.0.0.1:3333) и добавляет заголовки, которые просит браузер.
// Запуск: node kenku-bridge.mjs   (нужен Node.js 18+). В панели укажи адрес http://127.0.0.1:3334
import http from "node:http";

const TARGET = (process.env.KENKU || "http://127.0.0.1:3333").replace(/\/+$/, "");
const PORT = +process.env.PORT || 3334;

http.createServer(async (req, res) => {
  const h = {
    "Access-Control-Allow-Origin": req.headers.origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] || "*",
    "Access-Control-Allow-Private-Network": "true",
    "Vary": "Origin",
  };
  if (req.method === "OPTIONS") { res.writeHead(204, h); return res.end(); }
  if (req.method !== "GET" || !req.url.startsWith("/v1/")) { res.writeHead(404, h); return res.end(); }
  try {
    const r = await fetch(TARGET + req.url, { cache: "no-store" });
    const body = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { ...h, "Content-Type": r.headers.get("content-type") || "application/json" });
    res.end(body);
  } catch (e) {
    res.writeHead(502, { ...h, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Kenku FM не отвечает: " + e.message }));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Мост запущен: http://127.0.0.1:${PORT} → ${TARGET}. Не закрывай это окно.`));
