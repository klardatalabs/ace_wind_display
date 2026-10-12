import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redis = null;
let isRedisAvailable = false;
let redisErrorLogged = false;

// In-memory fallback if Redis is offline
const memoryRateLimits = new Map();

try {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    lazyConnect: true,
  });

  redis.on("connect", () => {
    isRedisAvailable = true;
    redisErrorLogged = false;
    console.log("[Redis] Connected successfully to", REDIS_URL);
  });

  redis.on("error", (err) => {
    // Log once per outage, not on every reconnect attempt.
    if (isRedisAvailable || !redisErrorLogged) console.warn("[Redis] Connection error:", err.message);
    redisErrorLogged = true;
    isRedisAvailable = false;
  });

  await redis.connect().catch((err) => {
    console.warn("[Redis] Could not connect initially, fallback to in-memory:", err.message);
  });
} catch (e) {
  console.warn("[Redis] Initialization failed, using in-memory fallback:", e.message);
}

/**
 * Check sliding-window rate limit for a key (e.g. session or IP).
 * @param {string} key Identifier (e.g. "ratelimit:session:uuid")
 * @param {number} maxRequests Maximum requests allowed
 * @param {number} windowSec Time window in seconds
 * @returns {Promise<{ allowed: boolean, remaining: number, resetSec: number }>}
 */
export async function checkRateLimit(key, maxRequests = 6, windowSec = 60) {
  if (isRedisAvailable && redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSec);
      }
      const ttl = await redis.ttl(key);
      const remaining = Math.max(0, maxRequests - count);
      return {
        allowed: count <= maxRequests,
        remaining,
        resetSec: ttl > 0 ? ttl : windowSec,
      };
    } catch (err) {
      console.warn("[Redis] Rate limit error, falling back to memory:", err.message);
    }
  }

  // Memory fallback
  const now = Date.now();
  if (memoryRateLimits.size > 5000) {
    for (const [k, v] of memoryRateLimits) if (now > v.expiresAt) memoryRateLimits.delete(k);
  }
  const entry = memoryRateLimits.get(key) || { count: 0, expiresAt: now + windowSec * 1000 };
  if (now > entry.expiresAt) {
    entry.count = 0;
    entry.expiresAt = now + windowSec * 1000;
  }
  entry.count += 1;
  memoryRateLimits.set(key, entry);

  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetSec: Math.round((entry.expiresAt - now) / 1000),
  };
}

/** True while the Redis connection is healthy (read at call time, not import time). */
export function redisReady() {
  return Boolean(isRedisAvailable && redis);
}

export { redis };
