import { test } from "node:test";
import assert from "node:assert/strict";
import { comparisonYear, seasonWindows, summarizeSeasons } from "./seasons.js";

test("comparison uses the latest completed four-season year", () => {
  assert.equal(comparisonYear(new Date("2026-10-25")), 2025);
  assert.equal(comparisonYear(new Date("2026-12-01")), 2026);
  const windows = seasonWindows(2025);
  assert.equal(windows.length, 4);
  assert.equal(windows[0].from, "2024-12-01T00:00:00Z");
  assert.equal(windows[3].to, "2025-12-01T00:00:00Z");
  assert.equal(windows[1].expectedSamples, 13242); // spring's DST change removes one hour
});

test("seasons report missing data and keep direction as a proxy", () => {
  const result = summarizeSeasons([
    { season: 0, direction_bin: 7, samples: "4", speed_samples: "3", speed_sum: "18" },
    { season: 0, direction_bin: 0, samples: "2", speed_samples: "2", speed_sum: "12" },
    { season: 1, direction_bin: null, samples: "3", speed_samples: "0", speed_sum: null },
  ], 2025);
  assert.equal(result[0].meanSpeedMs, 6);
  assert.equal(result[0].dominantDirection, "NW");
  assert.equal(result[0].observations, 6);
  assert.equal(result[0].samples, 5);
  assert.equal(result[1].meanSpeedMs, null);
  assert.equal(result[2].samples, 0);
  assert.equal(result[2].dominantDirection, null);
});
