// Energy generated today (UK day) so far, from the best evidence available, always labelled
// with how it was worked out:
//   1. the turbine's export meter in the live 1-minute data (needs near-complete coverage
//      since midnight, and must agree with the energy implied by mean power);
//   2. mean power from the live 1-minute data;
//   3. the 10-minute history (lags by 10-20 minutes).

import { todayFromMinutes } from "../db/repositories/liveSamples.js";
import { singleDay } from "../db/repositories/daily.js";
import { londonDate } from "../../shared/time.js";

const COVERAGE_NEEDED = 0.9;
const LATE_START_MS = 10 * 60_000;
const STALE_MS = 30 * 60_000;

/** Pure decision, exported for tests. */
export function chooseTodayEnergy(minutes, scadaDay, now = Date.now()) {
  if (minutes?.minutes) {
    const elapsedMinutes = Math.max(1, (now - +minutes.dayStart) / 60_000);
    const covered = minutes.minutes / elapsedMinutes >= COVERAGE_NEEDED && +minutes.firstMinute - +minutes.dayStart <= LATE_START_MS;
    if (covered) {
      const meter = minutes.meterNowKwh - minutes.meterStartKwh;
      const estimate = minutes.energyFromPowerKwh;
      const agrees = meter >= 0 && Math.abs(meter - estimate) <= Math.max(0.25 * estimate, 20);
      return {
        energyKwh: agrees ? meter : estimate,
        energyMethod: agrees ? "energy meter (live)" : "estimated from live 1-minute power",
        stale: false,
      };
    }
  }
  if (scadaDay?.energyKwh != null) {
    return {
      energyKwh: scadaDay.energyKwh,
      energyMethod: scadaDay.energyMethod,
      stale: now - +new Date(scadaDay.lastObservedAt) > STALE_MS,
    };
  }
  return null;
}

export async function todayEnergy(assetId) {
  const [minutes, scadaDay] = await Promise.all([todayFromMinutes(assetId), singleDay(assetId, londonDate())]);
  const result = chooseTodayEnergy(minutes, scadaDay);
  if (!result) throw new Error("No data for today yet");
  return result;
}
