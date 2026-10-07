// Ask Ace — anonymous phone chat opened from a hoarding's QR code.
//
// POST   /api/chat/session   -> mint a private session token for this browser tab
// GET    /api/chat/history   -> this session's transcript (restores context after reload)
// DELETE /api/chat/session   -> forget this session's conversation
// POST   /api/chat/stream    -> send a message, receive the reply as Server-Sent Events

import { Router } from "express";
import { createSession, requireChatSession } from "../chat/session.js";
import { getHistory, appendMessages, clearHistory } from "../chat/historyStore.js";
import { cleanMessage } from "../chat/guard.js";
import { runAgent } from "../chat/agent.js";
import { checkRateLimit } from "../db/redisClient.js";
import { config } from "../config/env.js";

const router = Router();
const inFlight = new Set(); // one reply at a time per session keeps history ordered

router.post("/session", async (req, res) => {
  const rl = await checkRateLimit(`ww:rl:newsession:${req.ip}`, 20, 60);
  if (!rl.allowed) return res.status(429).json({ error: "Too many new chats — please wait a moment." });
  const { token, screen } = createSession(req.body?.screen);
  res.json({ token, screen });
});

router.get("/history", requireChatSession, async (req, res) => {
  const messages = await getHistory(req.chatSession.sid);
  res.json({ screen: req.chatSession.screen, messages: messages.map(({ role, content, sources }) => ({ role, content, sources })) });
});

router.delete("/session", requireChatSession, async (req, res) => {
  await clearHistory(req.chatSession.sid);
  res.json({ ok: true });
});

router.post("/stream", requireChatSession, async (req, res) => {
  const { sid, screen } = req.chatSession;
  const cleaned = cleanMessage(req.body?.message);
  if (!cleaned.ok) return res.status(400).json({ error: cleaned.error });

  const [perSession, perIp] = await Promise.all([
    checkRateLimit(`ww:rl:chat:${sid}`, config.chat.perSessionPerMinute, 60),
    checkRateLimit(`ww:rl:chatip:${req.ip}`, config.chat.perIpPerMinute, 60),
  ]);
  if (!perSession.allowed || !perIp.allowed) {
    const wait = Math.max(perSession.resetSec, perIp.resetSec);
    return res.status(429).json({ error: `Whoa, my blades need a breather! Try again in ${wait}s.` });
  }
  if (inFlight.has(sid)) return res.status(409).json({ error: "I'm still answering your last question." });
  inFlight.add(sid);

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const emit = (event, data) => {
    if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const abort = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) abort.abort();
  });

  try {
    const history = await getHistory(sid);
    const { text, sources } = await runAgent({
      prompt: cleaned.text,
      history,
      screen,
      signal: abort.signal,
      onText: (t) => emit("token", { t }),
      onStatus: (s) => emit("status", { s }),
      onSources: (s) => emit("sources", { sources: s }),
      onAction: (a) => emit("action", { action: a }),
    });
    if (text.trim()) {
      await appendMessages(sid, [
        { role: "user", content: cleaned.text },
        { role: "assistant", content: text, ...(sources.length ? { sources } : {}) },
      ]);
    }
    emit("done", {});
  } catch (err) {
    console.warn("[chat] reply failed:", err.message);
    emit("error", { error: "Something went wrong on my side. Please try again." });
  } finally {
    inFlight.delete(sid);
    res.end();
  }
});

export default router;
