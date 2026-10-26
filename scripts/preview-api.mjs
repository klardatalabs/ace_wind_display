// Read-only local preview for the website when Postgres and Redis are unavailable.
// It fetches public turbine readings and the same curated news used in production.
import { createServer } from "node:http";
import { fetchLatestNews } from "../server/news/feed.js";

const PORT = 4100;
const LIVE_ORIGIN = "https://ace.klardatalabs.com";
const ALLOWED = new Set(["/api/state", "/api/environment"]);
let news = { items: [], updatedAt: null, stale: true };
let nextNewsRefresh = 0;

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function refreshNews() {
  if (Date.now() < nextNewsRefresh) return;
  nextNewsRefresh = Date.now() + 15 * 60_000;
  try {
    news = { items: await fetchLatestNews(), updatedAt: new Date().toISOString(), stale: false };
  } catch {
    news = { ...news, stale: true };
  }
}

createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1").pathname;
  if (req.method !== "GET") return send(res, 405, { error: "Preview is read-only" });
  if (path === "/api/news") {
    await refreshNews();
    return send(res, 200, news);
  }
  if (!ALLOWED.has(path)) return send(res, 404, { error: "Unavailable in local preview" });
  try {
    const upstream = await fetch(`${LIVE_ORIGIN}${path}`, { signal: AbortSignal.timeout(10_000) });
    if (!upstream.ok) return send(res, 503, { error: "Public live data is unavailable" });
    return send(res, 200, await upstream.json());
  } catch {
    return send(res, 503, { error: "Public live data is unavailable" });
  }
}).listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`Read-only preview API on http://127.0.0.1:${PORT}\n`);
});
