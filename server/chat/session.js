// Anonymous, per-tab chat sessions.
//
// The server (never the client) mints each session id: 128 random bits plus an
// HMAC signature. The phone keeps the token in sessionStorage, so it lives only
// as long as that browser tab. A client cannot pick, guess or forge another
// visitor's id, which is what keeps two people's conversations apart.

import crypto from "node:crypto";
import { config } from "../config/env.js";

export const SCREENS = ["students", "community", "college"];

function sign(payload) {
  return crypto.createHmac("sha256", config.chat.sessionSecret).update(payload).digest("base64url");
}

export function createSession(screen) {
  const sid = crypto.randomBytes(16).toString("base64url");
  const safeScreen = SCREENS.includes(screen) ? screen : "community";
  const payload = `${sid}.${safeScreen}`;
  return { sid, screen: safeScreen, token: `${payload}.${sign(payload)}` };
}

/** @returns {{ sid: string, screen: string } | null} */
export function verifyToken(token) {
  if (typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sid, screen, signature] = parts;
  const expected = sign(`${sid}.${screen}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!SCREENS.includes(screen)) return null;
  return { sid, screen };
}

/** Express middleware: requires `Authorization: Bearer <token>`. */
export function requireChatSession(req, res, next) {
  const header = req.get("authorization") || "";
  const session = verifyToken(header.replace(/^Bearer\s+/i, ""));
  if (!session) return res.status(401).json({ error: "session_invalid" });
  req.chatSession = session;
  next();
}
