// The live state every screen shows, owned by the active collector and shared through Redis:
// the latest snapshot is stored under the "state" key (for api instances that start later)
// and published on the "state" channel. It is published when it changes, plus a heartbeat
// every 10 s, instead of every second regardless.
//
// The shape is what the frontend reads: now (latest reading), today (energy so far),
// statusEvent, liveAt (time of the latest real reading; null until one arrives), connected,
// freshness of each feed, updatedAt.

import { redis } from "../infra/redis.js";
import { publish, CHANNELS } from "../infra/pubsub.js";
import { STATE_KEY } from "../live/shapes.js";

const HEARTBEAT_MS = 10_000;
const LIVE_STALE_MS = 30_000;

const state = {
  liveAt: null,
  now: null,
  today: null,
  statusEvent: null,
  freshness: { now: null, today: null, status: null },
};
let lastPublished = "";
let lastPublishedAt = 0;

export function snapshot() {
  const connected = Boolean(state.liveAt) && Date.now() - Date.parse(state.liveAt) <= LIVE_STALE_MS;
  return { ...structuredClone(state), connected, updatedAt: new Date().toISOString() };
}

/** Applies a partial update and publishes if anything visible changed. */
export async function update(patch) {
  Object.assign(state, patch);
  await publishIfChanged();
}

export function markFeed(feed, ok) {
  const previous = state.freshness[feed] ?? { failures: 0 };
  state.freshness[feed] = ok
    ? { lastSuccessAt: new Date().toISOString(), failures: 0 }
    : { ...previous, failures: (previous.failures ?? 0) + 1 };
}

export async function publishIfChanged({ force = false } = {}) {
  const snap = snapshot();
  const { updatedAt, ...comparable } = snap;
  const serialised = JSON.stringify(comparable);
  if (!force && serialised === lastPublished && Date.now() - lastPublishedAt < HEARTBEAT_MS) return;
  lastPublished = serialised;
  lastPublishedAt = Date.now();
  await Promise.all([
    redis.set(STATE_KEY, JSON.stringify(snap), "EX", 120).catch(() => {}),
    publish(CHANNELS.state, snap),
  ]);
}
