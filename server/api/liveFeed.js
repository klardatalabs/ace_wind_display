// This api instance's copy of the live state and the weather ("environment"). Loaded from
// Redis at start, then kept current by the collector's pub/sub messages. If Redis is
// unavailable (or the messages stop), the state is rebuilt from the database every few
// seconds instead, so screens keep updating, just less smoothly.

import { EventEmitter } from "node:events";
import { redis, redisHealthy } from "../infra/redis.js";
import { subscribe, CHANNELS } from "../infra/pubsub.js";
import { latestSamples } from "../db/repositories/liveSamples.js";
import { latestStatusEvent } from "../db/repositories/status.js";
import { latestReading } from "../db/repositories/weather.js";
import { toNow, toStatusEvent, toEnvironment, STATE_KEY, ENVIRONMENT_KEY } from "../live/shapes.js";
import { logger } from "../lib/logger.js";
import { SITE, ASSET } from "../../shared/site.js";

const log = logger("api.live-feed");
const QUIET_MS = 20_000; // no state message for this long -> fall back to the database
const FALLBACK_POLL_MS = 5_000;

export const liveFeed = new EventEmitter();
let state = null;
let environment = null;
let lastMessageAt = 0;
let fallbackTimer = null;

export const currentState = () => state;
export const currentEnvironment = () => environment;

function setState(next, via) {
  state = next;
  liveFeed.emit("state", state, via);
}
function setEnvironment(next) {
  environment = next;
  liveFeed.emit("environment", environment);
}

async function loadFromRedis() {
  const [rawState, rawEnvironment] = await Promise.all([redis.get(STATE_KEY), redis.get(ENVIRONMENT_KEY)]);
  if (rawState) setState(JSON.parse(rawState), "redis");
  if (rawEnvironment) setEnvironment(JSON.parse(rawEnvironment));
}

/** Rebuilds the state from the newest stored readings (used when Redis is quiet). */
async function loadFromDatabase() {
  const [{ site, turbine }, status, weather] = await Promise.all([
    latestSamples(SITE.id, ASSET.id), latestStatusEvent(ASSET.id), latestReading(SITE.id),
  ]);
  if (site && turbine) {
    const liveAt = new Date(Math.min(+site.observedAt, +turbine.observedAt)).toISOString();
    setState({
      ...(state ?? {}),
      now: toNow(site, turbine),
      liveAt,
      connected: false,
      receivedAt: null,
      statusEvent: status ? toStatusEvent(status) : state?.statusEvent ?? null,
      updatedAt: new Date().toISOString(),
      source: "database",
    }, "database");
  }
  if (weather) setEnvironment(toEnvironment(weather));
}

function watchForSilence() {
  fallbackTimer = setInterval(() => {
    if (Date.now() - lastMessageAt < QUIET_MS && redisHealthy()) return;
    loadFromDatabase().catch((err) => log.debug("database fallback failed", { err }));
  }, FALLBACK_POLL_MS);
  fallbackTimer.unref();
}

export async function startLiveFeed() {
  await subscribe(CHANNELS.state, (message) => {
    lastMessageAt = Date.now();
    setState(message, "pubsub");
  });
  await subscribe(CHANNELS.environment, setEnvironment);
  await loadFromRedis().catch(() => loadFromDatabase()).catch((err) => log.warn("no initial live state", { err }));
  watchForSilence();
}

export function stopLiveFeed() {
  clearInterval(fallbackTimer);
}
