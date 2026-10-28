import { test } from "node:test";
import assert from "node:assert/strict";
import { parseScenario, evaluateScenario, validateChanges, previewScenario } from "../../shared/scenarios.js";

test("natural-language scenarios interpret wind, time, direction and grid cap", () => {
  assert.deepEqual(parseScenario("Wind rises from 7 to 9 m/s for an hour"), { baselineChanges: { windMs: 7 }, changes: { windMs: 9, durationHours: 1 }, unsupported: [] });
  assert.deepEqual(parseScenario("Wind is 10% faster for 2 hours").changes, { windMs: 7.7, durationHours: 2 });
  assert.deepEqual(parseScenario("What if wind speed increases by 10%?").changes, { windMs: 7.7 });
  assert.deepEqual(parseScenario("What if wind drops by 2 m/s?").changes, { windMs: 5 });
  assert.deepEqual(parseScenario("Wind direction 250 degrees for 30 minutes, grid limit 3 MW").changes, { windDeg: 250, durationHours: 0.5, gridLimitKw: 3000 });
  assert.deepEqual(parseScenario("What if blade pitch changes?").unsupported, ["blade pitch"]);
});

test("scenario bounds and units reject invalid or extra values", () => {
  assert.throws(() => validateChanges({ windMs: 35 }), /between 0 and 34/);
  assert.throws(() => validateChanges({ gridLimitKw: "3000" }), /Unsupported/);
  assert.throws(() => validateChanges({ pitch: 20 }), /Unsupported/);
});

test("grid cap and duration affect power and energy; rotor is explicitly illustrative", () => {
  const result = evaluateScenario({ changes: { windMs: 9, durationHours: 2, gridLimitKw: 2000 } });
  assert.equal(result.scenario.output.powerKw, 2000);
  assert.equal(result.scenario.output.energyKwh, 4000);
  assert.equal(result.baseline.output.energyKwh, result.baseline.output.powerKw * 2);
  assert.equal(result.estimateQuality, "illustrative only");
  assert.match(result.assumptions.join(" "), /visual approximation/);
  assert.equal(evaluateScenario({ changes: { windDeg: 300 } }).scenario.output.powerKw, evaluateScenario().scenario.output.powerKw);
});

test("a stated starting wind replaces the live baseline without losing comparison duration", () => {
  const parsed = parseScenario("Wind rises from 7 to 9 m/s for 2 hours", { windMs: 4 });
  const result = evaluateScenario({ baseline: parsed.baselineChanges, changes: parsed.changes });
  assert.equal(result.baseline.values.windMs, 7);
  assert.equal(result.baseline.values.durationHours, 1);
  assert.equal(result.scenario.values.windMs, 9);
  assert.equal(result.comparisonDurationHours, 2);
  assert.equal(result.baseline.output.energyKwh, result.baseline.output.powerKw * 2);
});

test("measured curve is used only when enough bins have samples", () => {
  const empirical = Array.from({ length: 7 }, (_, bin_wind) => ({ bin_wind, power_avg_kw: bin_wind * 100, sample_count: 30 }));
  const result = evaluateScenario({ baseline: { windMs: 4, windDeg: 215, durationHours: 1, gridLimitKw: 4200 }, changes: { windMs: 5 }, empirical });
  assert.equal(result.estimateQuality, "historical estimate");
  assert.equal(result.scenario.output.powerKw, 500);
  assert.equal(result.scenario.output.energyKwh, 500);
  const outside = evaluateScenario({ baseline: { windMs: 20.4, gridLimitKw: 2987 }, empirical });
  assert.equal(outside.estimateQuality, "illustrative only");
  assert.equal(outside.scenario.output.averagePowerKw, 2987);
  assert.equal(outside.scenario.output.energyKwh, 2987);
  assert.match(outside.method, /outside ACE measured coverage/);
  const mixed = evaluateScenario({ baseline: { windMs: 4 }, changes: { windMs: 20.4 }, empirical });
  assert.equal(mixed.baseline.output.powerKw, 175, "both sides use the same reference curve");
});

test("local preview evaluates without the scenario API and preserves its comparison baseline", () => {
  const initial = previewScenario();
  assert.equal(initial.baseline.source, "local preview example");
  assert.equal(initial.baseline.values.windMs, 7);
  const changed = previewScenario({ prompt: "What if wind rises from 7 to 9 m/s for an hour?", baseline: initial.baseline.values });
  assert.equal(changed.baseline.values.windMs, 7);
  assert.equal(changed.scenario.values.windMs, 9);
  assert.ok(changed.scenario.output.powerKw > changed.baseline.output.powerKw);
  const corrected = previewScenario({ baseline: changed.baseline.values, changes: { windMs: 8, durationHours: 2 } });
  assert.equal(corrected.scenario.values.windMs, 8);
  assert.equal(corrected.scenario.output.energyKwh, corrected.scenario.output.powerKw * 2);
});

test("research inputs report wind power density and operating energy without inventing electrical density corrections", () => {
  const baseline = evaluateScenario();
  const changed = evaluateScenario({ changes: { airDensityKgM3: 1.1, operatingPct: 50, durationHours: 2 } });
  assert.ok(changed.scenario.output.windPowerDensityWm2 < baseline.scenario.output.windPowerDensityWm2);
  assert.equal(changed.scenario.output.powerKw, baseline.scenario.output.powerKw);
  assert.ok(changed.scenario.output.windPowerAcrossRotorKw < baseline.scenario.output.windPowerAcrossRotorKw);
  assert.ok(Math.abs(changed.scenario.output.rotorTipSpeedMs - changed.scenario.output.rotorRpm * Math.PI * 115.7 / 60) < 0.5);
  assert.equal(changed.scenario.output.operatingHours, 1);
  assert.equal(changed.scenario.output.averagePowerKw, changed.scenario.output.powerKw / 2);
  assert.equal(changed.scenario.output.energyKwh, changed.scenario.output.powerKw);
  const stopped = evaluateScenario({ changes: { operatingPct: 0 } }).scenario.output;
  assert.equal(stopped.averagePowerKw, 0);
  assert.equal(stopped.energyKwh, 0);
  assert.equal(stopped.rotorRpm, 0);
  assert.deepEqual(parseScenario("Air density 1.1 kg/m3 and availability 50% for 2 hours").changes, { airDensityKgM3: 1.1, operatingPct: 50, durationHours: 2 });
  assert.throws(() => validateChanges({ airDensityKgM3: 2 }), /between 0.8 and 1.5/);
});
