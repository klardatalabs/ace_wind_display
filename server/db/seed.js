// Reference data, upserted on every deploy from the shared constants, so the database and
// the code that reads it always agree. Safe to run any number of times.

import { SITE, ASSET } from "../../shared/site.js";
import {
  RATED_POWER_KW, GRID_SETPOINT_KW, ROTOR_DIAMETER_M,
  CUT_IN_WIND_MS, RATED_WIND_MS, CUT_OUT_LOW_MS, CUT_OUT_HIGH_MS,
} from "../../shared/constants.js";
import { E115_REFERENCE_CURVE } from "../../shared/physics.js";
import { SCREENS, SCREEN_ACTIONS } from "../../shared/screens.js";
import { DATASETS } from "../../shared/datasets.js";
import { LIVE_SOURCE, ZENODO_SOURCE, LIVE_RELEASE_REF, JOBS, AGENT_STEP_KINDS } from "./constants.js";

/** @param {import("pg").PoolClient} db */
export async function seed(db) {
  await db.query(
    `INSERT INTO core.site (site_id, name, latitude, longitude, time_zone) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (site_id) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude, time_zone = EXCLUDED.time_zone`,
    [SITE.id, SITE.name, SITE.lat, SITE.lon, SITE.timeZone]
  );

  await db.query(
    `INSERT INTO core.turbine_model (model_id, manufacturer, rated_power_kw, rotor_diameter_m,
       cut_in_wind_ms, rated_wind_ms, storm_control_from_ms, cut_out_wind_ms)
     VALUES ($1, 'Enercon', $2, $3, $4, $5, $6, $7)
     ON CONFLICT (model_id) DO UPDATE SET rated_power_kw = EXCLUDED.rated_power_kw,
       rotor_diameter_m = EXCLUDED.rotor_diameter_m, cut_in_wind_ms = EXCLUDED.cut_in_wind_ms,
       rated_wind_ms = EXCLUDED.rated_wind_ms, storm_control_from_ms = EXCLUDED.storm_control_from_ms,
       cut_out_wind_ms = EXCLUDED.cut_out_wind_ms`,
    [ASSET.modelId, RATED_POWER_KW, ROTOR_DIAMETER_M, CUT_IN_WIND_MS, RATED_WIND_MS, CUT_OUT_LOW_MS, CUT_OUT_HIGH_MS]
  );

  await db.query("DELETE FROM core.power_curve_point WHERE model_id = $1", [ASSET.modelId]);
  await db.query(
    `INSERT INTO core.power_curve_point (model_id, wind_speed_ms, power_kw)
     SELECT $1, wind, power FROM unnest($2::double precision[], $3::double precision[]) AS t(wind, power)`,
    [ASSET.modelId, E115_REFERENCE_CURVE.map((p) => p.wind), E115_REFERENCE_CURVE.map((p) => p.power)]
  );

  await db.query(
    `INSERT INTO core.asset (asset_id, site_id, model_id, grid_setpoint_kw, commissioned_on) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (asset_id) DO UPDATE SET site_id = EXCLUDED.site_id, model_id = EXCLUDED.model_id,
       grid_setpoint_kw = EXCLUDED.grid_setpoint_kw, commissioned_on = EXCLUDED.commissioned_on`,
    [ASSET.id, SITE.id, ASSET.modelId, GRID_SETPOINT_KW, ASSET.commissionedOn]
  );

  await upsertPairs(db, "core.data_source", "source_id", "description", [
    [LIVE_SOURCE, "ACE Live API (ace-api.duckdns.org)"],
    [ZENODO_SOURCE, "ACE Wind Turbine Data archive on Zenodo"],
  ]);
  await db.query(
    `INSERT INTO core.source_release (source_id, release_ref) VALUES ($1, $2) ON CONFLICT (source_id, release_ref) DO NOTHING`,
    [LIVE_SOURCE, LIVE_RELEASE_REF]
  );

  await upsertPairs(db, "app.screen", "screen_id", "title", SCREENS.map((s) => [s.id, s.title]));
  await upsertPairs(db, "app.screen_action", "action_id", "description", Object.entries(SCREEN_ACTIONS));
  await db.query("INSERT INTO app.chat_role (role_id) VALUES ('user'), ('assistant') ON CONFLICT DO NOTHING");
  await upsertPairs(db, "app.job", "job_id", "description", Object.entries(JOBS));
  await upsertPairs(db, "app.agent_step_kind", "kind_id", "label", Object.entries(AGENT_STEP_KINDS));

  for (const d of DATASETS) {
    await db.query(
      `INSERT INTO app.dataset (dataset_id, label, description, max_range_days) VALUES ($1, $2, $3, $4)
       ON CONFLICT (dataset_id) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description,
         max_range_days = EXCLUDED.max_range_days`,
      [d.id, d.label, d.description, d.maxRangeDays]
    );
  }
}

async function upsertPairs(db, table, keyColumn, valueColumn, pairs) {
  for (const [key, value] of pairs) {
    await db.query(
      `INSERT INTO ${table} (${keyColumn}, ${valueColumn}) VALUES ($1, $2)
       ON CONFLICT (${keyColumn}) DO UPDATE SET ${valueColumn} = EXCLUDED.${valueColumn}`,
      [key, value]
    );
  }
}
