// Local preview for the website when Postgres and Redis are unavailable.
// Public turbine data is read only; chat is an isolated, in-memory demonstration.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { fetchLatestNews } from "../server/news/feed.js";
import { buildLibrary } from "../server/knowledge/library.js";
import { previewAnswer } from "./preview-chat.mjs";

const PORT = 4100;
const LIVE_ORIGIN = "https://ace.klardatalabs.com";
const ALLOWED = new Set(["/api/state", "/api/environment"]);
let news = { items: [], updatedAt: null, stale: true };
let nextNewsRefresh = 0;
const sessions = new Map();

const sessionFor = (req) => sessions.get(req.headers.authorization?.replace(/^Bearer /, ""));

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > 4000) throw new Error("Request too long");
  }
  return JSON.parse(body || "{}");
}

async function readMessage(req) {
  const message = (await readBody(req)).message;
  if (typeof message !== "string" || !message.trim() || message.length > 600) throw new Error("Invalid message");
  return message.trim();
}

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
  if (path === "/api/chat/session" && req.method === "POST") {
    const token = randomUUID();
    sessions.set(token, { messages: [], at: Date.now() });
    return send(res, 200, { token, preview: true });
  }
  if (path === "/api/chat/history" && req.method === "GET") {
    const session = sessionFor(req);
    return session ? send(res, 200, { messages: session.messages, preview: true }) : send(res, 401, { error: "Preview session expired" });
  }
  if (path === "/api/chat/session" && req.method === "DELETE") {
    const token = req.headers.authorization?.replace(/^Bearer /, "");
    sessions.delete(token);
    return send(res, 200, { ok: true });
  }
  if (path === "/api/chat/stream" && req.method === "POST") {
    const session = sessionFor(req);
    if (!session) return send(res, 401, { error: "Preview session expired" });
    let message;
    try { message = await readMessage(req); } catch { return send(res, 400, { error: "Enter a question up to 600 characters." }); }
    const reply = previewAnswer(message);
    session.messages.push({ role: "user", content: message }, { role: "assistant", content: reply });
    res.writeHead(200, { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" });
    res.write(`event: token\ndata: ${JSON.stringify({ t: reply })}\n\n`);
    res.end("event: done\ndata: {}\n\n");
    return;
  }
  if (req.method !== "GET") return send(res, 405, { error: "Unavailable in local preview" });
  if (path === "/api/research/library") return send(res, 200, buildLibrary([], "unavailable"));
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
