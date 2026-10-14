import test from "node:test";
import assert from "node:assert/strict";
import { chooseTodayEnergy } from "./todayEnergy.js";

const dayStart = new Date("2026-10-14T23:00:00Z");
const now = +dayStart + 6 * 3_600_000; // 06:00 UK
const minutes = (overrides) => ({ dayStart, firstMinute: dayStart, minutes: 360, meterStartKwh: 1000, meterNowKwh: 7000, energyFromPowerKwh: 6100, ...overrides });

test("the live meter is used when coverage is complete and it agrees with mean power", () => {
  assert.deepEqual(chooseTodayEnergy(minutes(), null, now), { energyKwh: 6000, energyMethod: "energy meter (live)", stale: false });
});

test("a meter that disagrees with mean power falls back to the power estimate", () => {
  const r = chooseTodayEnergy(minutes({ meterNowKwh: 1001 }), null, now);
  assert.equal(r.energyMethod, "estimated from live 1-minute power");
  assert.equal(r.energyKwh, 6100);
});

test("patchy live data falls back to the 10-minute history, flagged stale when old", () => {
  const scadaDay = { energyKwh: 5800, energyMethod: "energy meter", lastObservedAt: new Date(now - 45 * 60_000) };
  const r = chooseTodayEnergy(minutes({ minutes: 100 }), scadaDay, now);
  assert.deepEqual(r, { energyKwh: 5800, energyMethod: "energy meter", stale: true });
  assert.equal(chooseTodayEnergy(minutes({ firstMinute: new Date(+dayStart + 3_600_000) }), null, now), null, "a late start is not full coverage");
});
