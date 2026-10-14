// Live jobs: the 1 Hz reading (state + buffered storage), the status event poll, and today's
// energy so far.

import { fetchLive, fetchStatus } from "../../integrations/ace/live.js";
import { insertStatusEvent, latestStatusEvent } from "../../db/repositories/status.js";
import { getLiveReleaseId } from "../../db/repositories/releases.js";
import { bufferReading } from "../sampleWriter.js";
import { update, markFeed } from "../liveState.js";
import { toNow, toStatusEvent } from "../../live/shapes.js";
import { todayEnergy } from "../todayEnergy.js";
import { ASSET } from "../../../shared/site.js";

let lastObservedAt = 0;

export async function pollLive() {
  try {
    const reading = await fetchLive();
    const observed = Math.min(+reading.site.observedAt, +reading.turbine.observedAt);
    markFeed("now", true);
    if (observed === lastObservedAt) return; // ACE hasn't produced a newer second yet
    lastObservedAt = observed;
    bufferReading(reading);
    await update({ now: toNow(reading.site, reading.turbine), liveAt: new Date(observed).toISOString() });
  } catch (err) {
    markFeed("now", false);
    await update({}); // republish so "connected" flips once the last reading ages out
    throw err;
  }
}

let lastStatusKey = null;

export async function pollStatus() {
  try {
    const status = await fetchStatus();
    markFeed("status", true);
    const key = `${+status.observedAt}`;
    if (key !== lastStatusKey) {
      await insertStatusEvent({ assetId: ASSET.id, releaseId: await getLiveReleaseId(), ...status });
      lastStatusKey = key;
    }
    await update({ statusEvent: toStatusEvent(status) });
  } catch (err) {
    markFeed("status", false);
    throw err;
  }
}

/** On start, show the last stored status until the first poll succeeds. */
export async function restoreStatus() {
  const stored = await latestStatusEvent(ASSET.id).catch(() => null);
  if (stored) await update({ statusEvent: toStatusEvent(stored) });
}

export async function refreshToday() {
  try {
    const today = await todayEnergy(ASSET.id);
    markFeed("today", true);
    await update({ today });
  } catch (err) {
    markFeed("today", false);
    throw err;
  }
}
