// Sliding-window rate limiting, shared by every api instance through Redis.
//
// Each limit keeps a counter for the current and the previous fixed window; the previous
// window's count is weighted by how much of it still overlaps the sliding window. That is
// accurate to a few percent while storing only two integers per key. The check and the
// increment run in one Lua script, so concurrent requests can't both slip under the limit,
// and both counters always carry an expiry (a lost EXPIRE can't lock anyone out forever).
//
// If Redis is unavailable, each instance enforces the same limits locally.

import { redis, redisHealthy } from "./redis.js";
import { logger } from "../lib/logger.js";

const log = logger("rate-limit");

const SCRIPT = `
local limit, window, now, cost = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3]), tonumber(ARGV[4])
local cur = tonumber(redis.call('GET', KEYS[1]) or '0')
local prev = tonumber(redis.call('GET', KEYS[2]) or '0')
local into = now % window
local weighted = prev * (1 - into / window) + cur
if weighted + cost > limit then
  return {0, cur, prev}
end
redis.call('INCRBY', KEYS[1], cost)
redis.call('PEXPIRE', KEYS[1], window * 2)
return {1, cur + cost, prev}
`;

redis.defineCommand("slidingWindow", { numberOfKeys: 2, lua: SCRIPT });

/**
 * How long until a request of `cost` fits, if nothing else arrives.
 * @returns {number} milliseconds
 */
export function retryAfterMs({ limit, windowMs, cost, cur, prev, now }) {
  const into = now % windowMs;
  if (cur + cost <= limit) {
    // The previous window's weight has to fade enough within this window.
    const needed = 1 - (limit - cost - cur) / prev;
    return Math.max(0, Math.ceil(needed * windowMs - into));
  }
  // This window is already full on its own: wait for it to become the previous window.
  const needed = 1 - (limit - cost) / cur;
  return Math.ceil(windowMs - into + Math.max(0, needed) * windowMs);
}

function decide({ allowed, cur, prev }, { limit, windowMs, cost, now }) {
  const weighted = prev * (1 - (now % windowMs) / windowMs) + cur;
  return {
    allowed,
    limit,
    remaining: Math.max(0, Math.floor(limit - weighted)),
    retryAfterMs: allowed ? 0 : retryAfterMs({ limit, windowMs, cost, cur, prev, now }),
  };
}

// ---- in-process fallback (same algorithm) ----
const local = new Map(); // key -> { window, cur, prev }
function consumeLocally(key, { limit, windowMs, cost, now }) {
  const window = Math.floor(now / windowMs);
  let entry = local.get(key);
  if (!entry || entry.window < window - 1) entry = { window, cur: 0, prev: 0 };
  else if (entry.window === window - 1) entry = { window, cur: 0, prev: entry.cur };
  const weighted = entry.prev * (1 - (now % windowMs) / windowMs) + entry.cur;
  const allowed = weighted + cost <= limit;
  if (allowed) entry.cur += cost;
  local.set(key, entry);
  if (local.size > 50_000) for (const [k, e] of local) if (e.window < window - 1) local.delete(k);
  return decide({ allowed, cur: entry.cur - (allowed ? cost : 0), prev: entry.prev }, { limit, windowMs, cost, now });
}

/**
 * Spends `cost` from the limit named `key`.
 * @param {string} key  e.g. "chat:ip:203.0.113.7"
 * @param {{ limit: number, windowMs: number, cost?: number }} policy
 * @returns {Promise<{ allowed: boolean, limit: number, remaining: number, retryAfterMs: number }>}
 */
export async function consume(key, { limit, windowMs, cost = 1 }) {
  const now = Date.now();
  const params = { limit, windowMs, cost, now };
  if (redisHealthy()) {
    const window = Math.floor(now / windowMs);
    try {
      const [ok, cur, prev] = await redis.slidingWindow(`rl:${key}:${window}`, `rl:${key}:${window - 1}`, limit, windowMs, now, cost);
      return decide({ allowed: ok === 1, cur: ok === 1 ? cur - cost : cur, prev }, params);
    } catch (err) {
      log.warn("redis rate limit failed; limiting locally", { err });
    }
  }
  return consumeLocally(key, params);
}
