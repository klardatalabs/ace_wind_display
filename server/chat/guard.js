// Cleans visitor input before it reaches the model or the history store.

import { config } from "../config/env.js";

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** @returns {{ ok: true, text: string } | { ok: false, error: string }} */
export function cleanMessage(raw) {
  if (typeof raw !== "string") return { ok: false, error: "Please type a message." };
  const text = raw.replace(CONTROL_CHARS, "").trim();
  if (!text) return { ok: false, error: "Please type a message." };
  if (text.length > config.chat.maxMessageChars) {
    return { ok: false, error: `That's a long one! Please keep it under ${config.chat.maxMessageChars} characters.` };
  }
  return { ok: true, text };
}
