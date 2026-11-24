// Мост Kenku FM → Owlbear Rodeo.
// Нужен, если панель расширения пишет «Нет связи», хотя Kenku запущен и Remote включён.
// Принимает запросы на 127.0.0.1:3334, пересылает их в Kenku (127.0.0.1:3333)
// и добавляет заголовки, без которых браузер не пускает сайт к программе на компьютере.
// Запуск: двойной клик по start-bridge.bat (Windows) или `node kenku-bridge.mjs`.
// В панели расширения укажи адрес http://127.0.0.1:3334
import http from "node:http";

const TARGET = (process.env.KENKU || "http://127.0.0.1:3333").replace(/\/+$/, "");
const PORT = +process.env.PORT || 3334;

let last = "";
const note = m => { if (m !== last) { last = m; console.log(new Date().toLocaleTimeString(), m); } };

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
    note(r.ok ? "Owlbear подключился, Kenku отвечает — всё работает." : "Kenku ответил ошибкой " + r.status);
  } catch (e) {
    res.writeHead(502, { ...h, "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Kenku FM не отвечает: " + e.message }));
    note("Owlbear подключился, но Kenku FM не отвечает. Проверь в Kenku: Settings → Remote.");
  }
}).on("error", e => {
  console.log(e.code === "EADDRINUSE" ? `Порт ${PORT} занят — наверное, мост уже запущен в другом окне.` : e.message);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Мост запущен: http://127.0.0.1:${PORT} → Kenku ${TARGET}`);
  console.log("Не закрывай это окно, пока играете. Можно свернуть.");
  console.log("Жду, когда подключится Owlbear…");
});
