// Anonymous, per-tab chat sessions. The server mints the session id (a random UUID) and
// signs "<id>.<screen>" with HMAC-SHA256; the phone keeps the token in sessionStorage. A
// forged or altered token is rejected without touching the database, and nobody can pick or
// guess another visitor's session.

import crypto from "node:crypto";
import { config } from "../config/index.js";
import { createSession as storeSession } from "../db/repositories/chats.js";
import { HttpError } from "../lib/errors.js";
import { SCREEN_IDS } from "../../shared/screens.js";

const sign = (payload) => crypto.createHmac("sha256", config.chat.sessionSecret).update(payload).digest("base64url");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function createSession(requestedScreen) {
  const screen = SCREEN_IDS.includes(requestedScreen) ? requestedScreen : "community";
  const sessionId = crypto.randomUUID();
  await storeSession(sessionId, screen);
  const payload = `${sessionId}.${screen}`;
  return { token: `${payload}.${sign(payload)}`, screen };
}

/** @returns {{ sessionId: string, screen: string } | null} */
export function verifyToken(token) {
  if (typeof token !== "string" || token.length > 200) return null;
  const [sessionId, screen, signature, extra] = token.split(".");
  if (extra !== undefined || !UUID.test(sessionId ?? "") || !SCREEN_IDS.includes(screen) || !signature) return null;
  const expected = Buffer.from(sign(`${sessionId}.${screen}`));
  const given = Buffer.from(signature);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? { sessionId, screen } : null;
}

/** Express middleware: requires `Authorization: Bearer <token>`. */
export function requireChatSession(req, _res, next) {
  const session = verifyToken((req.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  if (!session) throw new HttpError(401, "Your chat session has expired. Please reload the page.", { code: "session_invalid" });
  req.chatSession = session;
  next();
}
