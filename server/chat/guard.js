// Cleans visitor input before it reaches the model or the database.

import { config } from "../config/index.js";
import { badRequest } from "../lib/errors.js";

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** @returns {string} the cleaned message; throws a 400 HttpError when it's empty or too long */
export function cleanMessage(raw) {
  if (typeof raw !== "string") throw badRequest("Please type a message.");
  const text = raw.replace(CONTROL_CHARS, "").trim();
  if (!text) throw badRequest("Please type a message.");
  if (text.length > config.chat.maxMessageChars) throw badRequest(`That's a long one! Please keep it under ${config.chat.maxMessageChars} characters.`);
  return text;
}
