// One visitor message, end to end: a cross-instance lock (one reply at a time per session,
// so the transcript stays in order), the transcript from Postgres, the agent streaming its
// answer and activity graph to the phone, then the exchange stored with its steps, photos
// and screen actions.

import { withLock } from "../infra/lock.js";
import { history as loadHistory, appendExchange } from "../db/repositories/chats.js";
import { runAgent } from "./agent.js";
import { HttpError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

const log = logger("chat.service");
const REPLY_LOCK_MS = 120_000;

/**
 * @param {{ sessionId: string, screen: string, question: string, signal: AbortSignal,
 *   emit: (event: string, data: object) => void }} p
 */
export async function answer({ sessionId, screen, question, signal, emit }) {
  const outcome = await withLock(`chat-reply:${sessionId}`, REPLY_LOCK_MS, async () => {
    const transcript = await loadHistory(sessionId, 24);
    const reply = await runAgent({ question, history: transcript, screen, signal, emit });
    if (reply.content.trim()) {
      await appendExchange({ sessionId, screenId: screen, question, answer: reply }).catch((err) => log.warn("could not store the exchange", { err }));
    }
    return reply;
  });
  if (!outcome.acquired) throw new HttpError(409, "I'm still answering your last question.", { code: "busy" });
  return outcome.result;
}
