// Short-lived mutual exclusion across api instances (e.g. one chat reply at a time per
// session). The lock expires on its own, so a crashed holder can't block anyone for long,
// and only the holder's token can release it. Falls back to an in-process lock when Redis
// is unavailable.

import crypto from "node:crypto";
import { redis, redisHealthy } from "./redis.js";

redis.defineCommand("releaseLock", {
  numberOfKeys: 1,
  lua: `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`,
});

const localLocks = new Map(); // key -> expiresAt

/**
 * Runs `fn` while holding the lock `name`. Returns `{ acquired: false }` without running it
 * when someone else holds the lock.
 */
export async function withLock(name, ttlMs, fn) {
  const key = `lock:${name}`;
  const token = crypto.randomUUID();
  let viaRedis = false;
  if (redisHealthy()) {
    try {
      viaRedis = true;
      if ((await redis.set(key, token, "PX", ttlMs, "NX")) !== "OK") return { acquired: false };
    } catch {
      viaRedis = false;
    }
  }
  if (!viaRedis) {
    if ((localLocks.get(key) ?? 0) > Date.now()) return { acquired: false };
    localLocks.set(key, Date.now() + ttlMs);
  }
  try {
    return { acquired: true, result: await fn() };
  } finally {
    if (viaRedis) await redis.releaseLock(key, token).catch(() => {});
    else localLocks.delete(key);
  }
}
