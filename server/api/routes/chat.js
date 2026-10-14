// Ask Ace: anonymous phone chat opened from a hoarding's QR code.
//   POST   /api/chat/session   mint a private session token for this browser tab
//   GET    /api/chat/history   this session's transcript (restores the chat after a reload)
//   DELETE /api/chat/session   forget this session's conversation
//   POST   /api/chat/stream    send a message; the answer, its activity-graph steps, photos
//                              and screen actions arrive as Server-Sent Events

import { Router } from "express";
import { createSession, requireChatSession } from "../../chat/session.js";
import { cleanMessage } from "../../chat/guard.js";
import { answer } from "../../chat/service.js";
import { history, deleteSession } from "../../db/repositories/chats.js";
import { enforce, rateLimit } from "../middleware/rateLimit.js";
import { LIMITS } from "../rateLimits.js";
import { HttpError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

const log = logger("api.chat");
export const chatRoutes = Router();

chatRoutes.post(
  "/session",
  rateLimit("chat-session", LIMITS.chatSessionCreate, (req) => req.ip, "Too many new chats from here. Please wait a moment."),
  async (req, res) => {
    res.set("Cache-Control", "no-store").json(await createSession(req.body?.screen));
  }
);

chatRoutes.get("/history", requireChatSession, async (req, res) => {
  const messages = await history(req.chatSession.sessionId);
  res.set("Cache-Control", "no-store").json({
    screen: req.chatSession.screen,
    messages: messages.map(({ role, content, steps, photos }) => ({ role, content, steps, photos })),
  });
});

chatRoutes.delete("/session", requireChatSession, async (req, res) => {
  await deleteSession(req.chatSession.sessionId);
  res.json({ ok: true });
});

chatRoutes.post("/stream", requireChatSession, async (req, res) => {
  const { sessionId, screen } = req.chatSession;
  const question = cleanMessage(req.body?.message);
  const breather = "Whoa, my blades need a breather! Please try again in a moment.";
  await enforce(res, `chat:session:${sessionId}`, LIMITS.chatMessagePerSession, breather);
  await enforce(res, `chat:ip:${req.ip}`, LIMITS.chatMessagePerIp, breather);

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
  res.on("close", () => !res.writableEnded && abort.abort());
  const keepAlive = setInterval(() => !res.writableEnded && res.write(": keep-alive\n\n"), 15_000);

  try {
    await answer({ sessionId, screen, question, signal: abort.signal, emit });
    emit("done", {});
  } catch (err) {
    if (!(err instanceof HttpError)) log.warn("reply failed", { err });
    emit("error", { error: err instanceof HttpError ? err.publicMessage : "Something went wrong on my side. Please try again." });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});
