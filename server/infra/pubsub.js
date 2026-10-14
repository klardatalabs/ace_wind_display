// Messages between processes over Redis pub/sub. The collector publishes live state and
// weather; every api instance subscribes and fans the messages out to its own WebSockets.
// Screen commands go the same way, so a phone's request reaches the hoarding whichever
// instance each of them is connected to.

import { redis, subscriber, channel } from "./redis.js";
import { logger } from "../lib/logger.js";

const log = logger("pubsub");

export const CHANNELS = {
  state: "state",
  environment: "environment",
  screenCommand: "screen-command",
  historyUpdated: "history-updated",
};

const handlers = new Map(); // prefixed channel -> Set<fn>

subscriber.on("message", (ch, raw) => {
  const fns = handlers.get(ch);
  if (!fns) return;
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    log.warn("dropped malformed message", { channel: ch });
    return;
  }
  for (const fn of fns) {
    try {
      fn(message);
    } catch (err) {
      log.error("subscriber failed", { channel: ch, err });
    }
  }
});

// A subscribe sent while Redis was down is lost, so re-subscribe everything on each reconnect.
subscriber.on("ready", () => {
  const all = [...handlers.keys()];
  if (all.length) subscriber.subscribe(...all).catch((err) => log.warn("resubscribe failed", { err }));
});

/** Publishes `message` (JSON-serialisable). Returns false when Redis is unavailable. */
export async function publish(name, message) {
  try {
    await redis.publish(channel(name), JSON.stringify(message));
    return true;
  } catch (err) {
    log.debug("publish failed", { channel: name, err });
    return false;
  }
}

/** Calls `fn(message)` for every message on `name`. Survives reconnects (ioredis resubscribes). */
export async function subscribe(name, fn) {
  const ch = channel(name);
  if (!handlers.has(ch)) {
    handlers.set(ch, new Set());
    await subscriber.subscribe(ch).catch((err) => log.warn("subscribe failed; will retry on reconnect", { channel: name, err }));
  }
  handlers.get(ch).add(fn);
  return () => handlers.get(ch)?.delete(fn);
}
