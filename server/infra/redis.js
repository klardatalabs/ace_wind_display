// Redis connections: one for commands, one for subscriptions (a subscribed connection can't
// run other commands). Commands time out quickly, so callers fall back instead of hanging
// when Redis is slow or down; ioredis keeps reconnecting in the background.

import Redis from "ioredis";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

const log = logger("redis");

function connect(role) {
  const client = new Redis(config.redis.url, {
    keyPrefix: role === "commands" ? config.redis.keyPrefix : undefined,
    connectionName: `weston-wind:${config.instanceId}:${role}`,
    maxRetriesPerRequest: 1,
    commandTimeout: role === "commands" ? 1_000 : undefined,
    retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    lazyConnect: true,
  });
  let healthy = false;
  client.on("ready", () => {
    healthy = true;
    log.info("connected", { role });
  });
  client.on("error", (err) => {
    if (healthy) log.warn("connection lost", { role, err });
    healthy = false;
  });
  client.on("end", () => (healthy = false));
  return { client, isHealthy: () => healthy };
}

const commands = connect("commands");
const subscriptions = connect("subscriptions");

export const redis = commands.client;
export const subscriber = subscriptions.client;
export const redisHealthy = () => commands.isHealthy();

let connecting = null;
let closing = null;

/**
 * Connects both clients (safe to call more than once). Resolves even if Redis is down: the
 * app degrades, it doesn't stop.
 */
export function connectRedis() {
  connecting ??= Promise.all(
    [redis, subscriber].map((c) => c.connect().catch((err) => log.warn("not reachable at startup; will keep retrying", { err })))
  );
  return connecting;
}

export function closeRedis() {
  closing ??= Promise.all([redis, subscriber].map((c) => c.quit().catch(() => c.disconnect())));
  return closing;
}

/** Prefixes a pub/sub channel name (ioredis only prefixes keys). */
export const channel = (name) => `${config.redis.keyPrefix}${name}`;
