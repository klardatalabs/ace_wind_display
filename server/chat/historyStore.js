// Conversation memory, keyed only by the server-minted session id.
// Redis when available (sliding TTL), in-memory otherwise. Message text is never logged.

import { redis, redisReady } from "../db/redisClient.js";
import { config } from "../config/env.js";

const { historyTtlSec, maxStoredMessages } = config.chat;
const memory = new Map(); // sid -> { messages, expiresAt }

const keyFor = (sid) => `ww:chat:${sid}:messages`;

function pruneMemory(now = Date.now()) {
  if (memory.size < 2000) return;
  for (const [sid, entry] of memory) if (now > entry.expiresAt) memory.delete(sid);
}

/** @returns {Promise<Array<{ role: "user"|"assistant", content: string, ts: number, sources?: object[] }>>} */
export async function getHistory(sid) {
  if (redisReady()) {
    try {
      const raw = await redis.lrange(keyFor(sid), 0, -1);
      return raw.map((item) => JSON.parse(item));
    } catch (err) {
      console.warn("[chat] history read failed, using memory:", err.message);
    }
  }
  const entry = memory.get(sid);
  if (!entry || Date.now() > entry.expiresAt) {
    memory.delete(sid);
    return [];
  }
  return entry.messages;
}

export async function appendMessages(sid, messages) {
  const stamped = messages.map((m) => ({ ...m, ts: Date.now() }));
  if (redisReady()) {
    try {
      const key = keyFor(sid);
      await redis
        .multi()
        .rpush(key, ...stamped.map((m) => JSON.stringify(m)))
        .ltrim(key, -maxStoredMessages, -1)
        .expire(key, historyTtlSec)
        .exec();
      return;
    } catch (err) {
      console.warn("[chat] history write failed, using memory:", err.message);
    }
  }
  pruneMemory();
  const now = Date.now();
  const entry = memory.get(sid);
  const previous = entry && now <= entry.expiresAt ? entry.messages : [];
  memory.set(sid, {
    messages: [...previous, ...stamped].slice(-maxStoredMessages),
    expiresAt: now + historyTtlSec * 1000,
  });
}

export async function clearHistory(sid) {
  memory.delete(sid);
  if (redisReady()) {
    try {
      await redis.del(keyFor(sid));
    } catch {
      // best effort
    }
  }
}
