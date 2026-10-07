import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redis = null;
let isRedisAvailable = false;

// In-memory fallback structures if Redis is offline
const memorySessions = new Map();
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
    console.log("[Redis] Connected successfully to", REDIS_URL);
  });

  redis.on("error", (err) => {
    isRedisAvailable = false;
    console.warn("[Redis] Connection error:", err.message);
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

/**
 * Get active conversation turns for a session (sliding TTL: 20 min).
 * @param {string} sessionId
 * @returns {Promise<Array<{ role: string, content: string }>>}
 */
export async function getSessionHistory(sessionId) {
  const key = `chat:session:${sessionId}:history`;
  if (isRedisAvailable && redis) {
    try {
      const raw = await redis.lrange(key, 0, 10);
      return raw.map((item) => JSON.parse(item));
    } catch (err) {
      console.warn("[Redis] Read history error:", err.message);
    }
  }

  const mem = memorySessions.get(sessionId);
  if (!mem) return [];
  if (Date.now() > mem.expiresAt) {
    memorySessions.delete(sessionId);
    return [];
  }
  return mem.messages;
}

/**
 * Append a user/assistant turn to session history and refresh 20-minute TTL.
 * @param {string} sessionId
 * @param {string} role 'user' | 'assistant'
 * @param {string} content Text content
 */
export async function appendSessionHistory(sessionId, role, content) {
  const key = `chat:session:${sessionId}:history`;
  const item = JSON.stringify({ role, content, ts: Date.now() });

  if (isRedisAvailable && redis) {
    try {
      await redis.rpush(key, item);
      // Keep only last 8 turns (4 round-trips)
      await redis.ltrim(key, -8, -1);
      // Refresh sliding 20-minute expiration
      await redis.expire(key, 1200);
      return;
    } catch (err) {
      console.warn("[Redis] Append history error:", err.message);
    }
  }

  // Memory fallback
  let mem = memorySessions.get(sessionId);
  if (!mem || Date.now() > mem.expiresAt) {
    mem = { messages: [], expiresAt: Date.now() + 1200 * 1000 };
  }
  mem.messages.push({ role, content, ts: Date.now() });
  if (mem.messages.length > 8) {
    mem.messages = mem.messages.slice(-8);
  }
  mem.expiresAt = Date.now() + 1200 * 1000;
  memorySessions.set(sessionId, mem);
}

/**
 * Cache current 1-second live telemetry for instant 0ms AI tool resolution.
 * @param {object} state Current normalized turbine state
 */
export async function cacheLiveTelemetry(state) {
  if (isRedisAvailable && redis) {
    try {
      await redis.setex("live:turbine:ace-01", 10, JSON.stringify(state));
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Retrieve cached 1-second live telemetry.
 */
export async function getCachedLiveTelemetry() {
  if (isRedisAvailable && redis) {
    try {
      const raw = await redis.get("live:turbine:ace-01");
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // ignore
    }
  }
  return null;
}

export { redis, isRedisAvailable };
