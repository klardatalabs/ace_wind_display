// Integration tests for the time-series repositories. Needs a migrated database (PG* env
// vars); skipped when none is reachable. Each test cleans up the rows it writes.

import test from "node:test";
import assert from "node:assert/strict";
import { pool, postgresHealthy, closePostgres } from "../../infra/postgres.js";
import * as samples from "./liveSamples.js";
import * as scada from "./scada.js";
import { SITE, ASSET } from "../../../shared/site.js";

const reachable = await postgresHealthy();
const skip = !reachable && "no database";

async function releaseIds() {
  const { rows } = await pool.query(
    `INSERT INTO core.source_release (source_id, release_ref) VALUES ('zenodo', 'test-release') ON CONFLICT DO NOTHING;
     SELECT release_id, release_ref FROM core.source_release WHERE release_ref IN ('live', 'test-release')`
  ).then((r) => r[1]);
  return Object.fromEntries(rows.map((r) => [r.release_ref, r.release_id]));
}

const slot = (iso) => new Date(iso);
const row = (iso, power, extra = {}) => ({
  assetId: ASSET.id, observedAt: slot(iso), windSpeedMeanMs: 8, windSpeedMaxMs: 10,
  activePowerMeanKw: power, activePowerMaxKw: power + 100, energyMeterKwh: 1000, ...extra,
});

test("live samples insert in batches and ignore duplicates", { skip }, async () => {
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const site = [{ siteId: SITE.id, observedAt: now, activePowerKw: 500, windSpeedMs: 6, windDirectionDeg: 220, availablePowerKw: 4200, theoreticalMaxPowerKw: 900 }];
  const turbine = [0, 1, 2].map((i) => ({
    assetId: ASSET.id, observedAt: new Date(now.getTime() - i * 1000), activePowerKw: 500 + i,
    windSpeedMs: 6, rotorSpeedRpm: 7, nacellePositionDeg: 215, energyExportedKwh: 20_000 + i, operatingHours: 19_000,
  }));
  try {
    assert.equal(await samples.insertSiteSamples(site), 1);
    assert.equal(await samples.insertAssetSamples(turbine), 3);
    assert.equal(await samples.insertAssetSamples(turbine), 0, "re-sending the same batch writes nothing");
    const latest = await samples.latestSamples(SITE.id, ASSET.id);
    assert.equal(latest.turbine.activePowerKw, 500);
    assert.equal(latest.site.windDirectionDeg, 220);
    const today = await samples.todayFromMinutes(ASSET.id);
    assert.ok(today.minutes >= 1, "real-time aggregation includes the current minute");
  } finally {
    await pool.query("DELETE FROM ts.site_sample WHERE site_id = $1; DELETE FROM ts.asset_sample WHERE asset_id = $1", [SITE.id]).catch(() => {});
    await pool.query("DELETE FROM ts.asset_sample WHERE asset_id = $1", [ASSET.id]);
    await pool.query("DELETE FROM ts.site_sample WHERE site_id = $1", [SITE.id]);
  }
});

test("live upserts only rewrite revised rows; archive rows only fill gaps", { skip }, async () => {
  const { live, "test-release": archive } = await releaseIds();
  const first = [row("2026-01-05T10:00:00Z", 1000), row("2026-01-05T10:10:00Z", 1200)];
  try {
    assert.equal(await scada.upsertLive(first, live), 2);
    assert.equal(await scada.upsertLive(first, live), 0, "unchanged rows are left alone");
    assert.equal(await scada.upsertLive([row("2026-01-05T10:10:00Z", 1300)], live), 1, "a revised row is corrected");

    const archiveRows = [row("2026-01-05T10:10:00Z", 3999), row("2026-01-05T10:30:00Z", 800)];
    assert.equal(await scada.insertArchive(archiveRows, archive), 1, "only the missing slot is filled");
    const { rows } = await pool.query("SELECT observed_at, active_power_mean_kw, release_id FROM ts.scada_10m WHERE asset_id = $1 ORDER BY 1", [ASSET.id]);
    assert.deepEqual(rows.map((r) => r.active_power_mean_kw), [1000, 1300, 800]);
    assert.equal(rows[1].release_id, live, "the archive never overwrote a live row");

    const gaps = await scada.findGaps(ASSET.id, "2026-01-05T10:00:00Z", "2026-01-05T11:00:00Z");
    assert.deepEqual(gaps.map((g) => [g.start.toISOString(), g.finish.toISOString()]), [
      ["2026-01-05T10:20:00.000Z", "2026-01-05T10:30:00.000Z"],
      ["2026-01-05T10:40:00.000Z", "2026-01-05T11:00:00.000Z"],
    ]);

    assert.equal(+(await scada.latestObservedAt(ASSET.id, live)), +slot("2026-01-05T10:10:00Z"));
    const peak = await scada.peak(ASSET.id, "activePowerMaxKw");
    assert.equal(peak.activePowerMaxKw, 1400);
    const curve = await scada.measuredPowerCurve(ASSET.id);
    assert.equal(curve.length, 1);
    assert.equal(curve[0].sampleCount, 3);
    assert.equal(curve[0].binWind, 8.25);
  } finally {
    await pool.query("DELETE FROM ts.scada_10m WHERE asset_id = $1", [ASSET.id]);
    await pool.query("DELETE FROM core.source_release WHERE release_ref = 'test-release'");
  }
});

test.after(closePostgres);
