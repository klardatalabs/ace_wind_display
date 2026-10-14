// Cache-aside with two levels: Redis (shared by every api instance) and a small in-process
// map (keeps answering when Redis is down).
//
//   fresh            -> served straight from cache
//   stale            -> served from cache while one background refresh runs
//   missing          -> loaded, with concurrent callers sharing one load (no stampede)
//   loader fails     -> the last good value is served if there is one ("stale-if-error")
//
// Namespaces carry a version number: bumping it (e.g. after a history sync) makes every
// key in the namespace stale at once, on every instance, without deleting anything.

import { redis, redisHealthy } from "./redis.js";
import { logger } from "../lib/logger.js";

const log = logger("cache");
const LOCAL_MAX = 500;
const LOCAL_KEEP_MS = 24 * 3_600_000; // last good values kept locally for stale-if-error

const local = new Map(); // key -> { value, freshUntil, staleUntil, keptUntil }
const inflight = new Map(); // key -> Promise<entry>
const versions = new Map(); // namespace -> number

function remember(key, entry) {
  local.delete(key);
  local.set(key, { ...entry, keptUntil: Date.now() + LOCAL_KEEP_MS });
  if (local.size > LOCAL_MAX) local.delete(local.keys().next().value); // oldest first
}

async function readEntry(key) {
  if (redisHealthy()) {
    try {
      const raw = await redis.get(`cache:${key}`);
      if (raw) return JSON.parse(raw);
    } catch (err) {
      log.debug("redis read failed", { err });
    }
  }
  const entry = local.get(key);
  return entry && Date.now() < entry.keptUntil ? entry : null;
}

function load(key, { freshSec, staleSec }, loader) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = (async () => {
    const value = await loader();
    const now = Date.now();
    const entry = { value, freshUntil: now + freshSec * 1000, staleUntil: now + (freshSec + staleSec) * 1000 };
    remember(key, entry);
    if (redisHealthy()) {
      await redis.set(`cache:${key}`, JSON.stringify(entry), "PX", (freshSec + staleSec) * 1000).catch((err) => log.debug("redis write failed", { err }));
    }
    return entry;
  })().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * @template T
 * @param {string} key
 * @param {{ freshSec: number, staleSec: number }} ttl
 * @param {() => Promise<T>} loader
 * @returns {Promise<T>}
 */
export async function cached(key, ttl, loader) {
  const entry = await readEntry(key);
  const now = Date.now();
  if (entry && now < entry.freshUntil) return entry.value;
  if (entry && now < entry.staleUntil) {
    load(key, ttl, loader).catch((err) => log.warn("background refresh failed; serving stale", { key, err }));
    return entry.value;
  }
  try {
    return (await load(key, ttl, loader)).value;
  } catch (err) {
    if (entry) {
      log.warn("load failed; serving last good value", { key, err });
      return entry.value;
    }
    throw err;
  }
}

/** The current version of a namespace, for building keys like `history:v12:records`. */
export async function namespaceVersion(namespace) {
  if (redisHealthy()) {
    try {
      const v = Number(await redis.get(`cache-version:${namespace}`)) || 0;
      versions.set(namespace, v);
      return v;
    } catch (err) {
      log.debug("version read failed", { err });
    }
  }
  return versions.get(namespace) ?? 0;
}

/** Makes every key in the namespace stale on all instances. Returns the new version. */
export async function bumpNamespace(namespace) {
  try {
    const v = await redis.incr(`cache-version:${namespace}`);
    versions.set(namespace, v);
    return v;
  } catch (err) {
    log.warn("version bump failed", { namespace, err });
    return null;
  }
}

/** Convenience: a versioned key inside a namespace. */
export async function versionedKey(namespace, name) {
  return `${namespace}:v${await namespaceVersion(namespace)}:${name}`;
}
