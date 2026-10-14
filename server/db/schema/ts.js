// ts schema: TimescaleDB hypertables, plus the continuous aggregates and the daily summary
// view (declared as read-only views so they can be queried like tables). Hypertables,
// aggregates, compression and retention are created by the SQL migrations.

import { pgSchema, text, integer, boolean, bigint, date, primaryKey } from "drizzle-orm/pg-core";
import { float, timestamptz } from "./columns.js";
import { site, asset, sourceRelease, weatherCondition } from "./core.js";

export const ts = pgSchema("ts");

export const siteSample = ts.table(
  "site_sample",
  {
    siteId: text("site_id").notNull().references(() => site.siteId),
    observedAt: timestamptz("observed_at").notNull(),
    activePowerKw: float("active_power_kw"),
    windSpeedMs: float("wind_speed_ms"),
    windDirectionDeg: float("wind_direction_deg").notNull(),
    availablePowerKw: float("available_power_kw").notNull(),
    theoreticalMaxPowerKw: float("theoretical_max_power_kw").notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.observedAt] })]
);

export const assetSample = ts.table(
  "asset_sample",
  {
    assetId: text("asset_id").notNull().references(() => asset.assetId),
    observedAt: timestamptz("observed_at").notNull(),
    activePowerKw: float("active_power_kw").notNull(),
    windSpeedMs: float("wind_speed_ms").notNull(),
    rotorSpeedRpm: float("rotor_speed_rpm").notNull(),
    nacellePositionDeg: float("nacelle_position_deg").notNull(),
    energyExportedKwh: float("energy_exported_kwh").notNull(),
    operatingHours: float("operating_hours"),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.observedAt] })]
);

export const scada10m = ts.table(
  "scada_10m",
  {
    assetId: text("asset_id").notNull().references(() => asset.assetId),
    observedAt: timestamptz("observed_at").notNull(),
    releaseId: integer("release_id").notNull().references(() => sourceRelease.releaseId),
    windSpeedMeanMs: float("wind_speed_mean_ms"),
    windSpeedMaxMs: float("wind_speed_max_ms"),
    windSpeedMinMs: float("wind_speed_min_ms"),
    activePowerMeanKw: float("active_power_mean_kw"),
    activePowerMaxKw: float("active_power_max_kw"),
    activePowerMinKw: float("active_power_min_kw"),
    rotorSpeedMeanRpm: float("rotor_speed_mean_rpm"),
    rotorSpeedMaxRpm: float("rotor_speed_max_rpm"),
    nacellePositionDeg: float("nacelle_position_deg"),
    energyMeterKwh: float("energy_meter_kwh"),
    operatingHours: float("operating_hours"),
    ingestedAt: timestamptz("ingested_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.observedAt] })]
);

export const statusEvent = ts.table(
  "status_event",
  {
    assetId: text("asset_id").notNull().references(() => asset.assetId),
    observedAt: timestamptz("observed_at").notNull(),
    releaseId: integer("release_id").notNull().references(() => sourceRelease.releaseId),
    mainStatus: integer("main_status").notNull(),
    substatus: integer("substatus").notNull(),
    faultMessage: boolean("fault_message").notNull(),
    warningMessage: boolean("warning_message").notNull(),
    serviceMode: boolean("service_mode").notNull(),
  },
  (t) => [primaryKey({ columns: [t.assetId, t.observedAt] })]
);

export const weatherObservation = ts.table(
  "weather_observation",
  {
    siteId: text("site_id").notNull().references(() => site.siteId),
    observedAt: timestamptz("observed_at").notNull(),
    conditionId: integer("condition_id").notNull().references(() => weatherCondition.conditionId),
    temperatureC: float("temperature_c"),
    feelsLikeC: float("feels_like_c"),
    humidityPct: float("humidity_pct"),
    pressureHpa: float("pressure_hpa"),
    cloudCoverPct: float("cloud_cover_pct"),
    rainMmH: float("rain_mm_h"),
    snowMmH: float("snow_mm_h"),
    visibilityM: float("visibility_m"),
    windSpeedMs: float("wind_speed_ms"),
    windDirectionDeg: float("wind_direction_deg"),
    windGustMs: float("wind_gust_ms"),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.observedAt] })]
);

// ---- continuous aggregates and views (read-only) ----

export const assetMinute = ts.view("asset_minute", {
  assetId: text("asset_id").notNull(),
  bucket: timestamptz("bucket").notNull(),
  activePowerAvgKw: float("active_power_avg_kw"),
  activePowerMaxKw: float("active_power_max_kw"),
  windSpeedAvgMs: float("wind_speed_avg_ms"),
  windSpeedMaxMs: float("wind_speed_max_ms"),
  rotorSpeedAvgRpm: float("rotor_speed_avg_rpm"),
  energyExportedFirstKwh: float("energy_exported_first_kwh"),
  energyExportedLastKwh: float("energy_exported_last_kwh"),
  sampleCount: bigint("sample_count", { mode: "number" }),
}).existing();

export const dailySummary = ts.view("daily_summary", {
  assetId: text("asset_id").notNull(),
  localDate: date("local_date").notNull(),
  dayStart: timestamptz("day_start").notNull(),
  dayHours: float("day_hours"),
  powerSampleCount: bigint("power_sample_count", { mode: "number" }),
  coveragePct: float("coverage_pct"),
  energyKwh: float("energy_kwh"),
  energyMethod: text("energy_method"),
  energyFromPowerKwh: float("energy_from_power_kwh"),
  windSpeedAvgMs: float("wind_speed_avg_ms"),
  windSpeedMaxMs: float("wind_speed_max_ms"),
  activePowerAvgKw: float("active_power_avg_kw"),
  activePowerMaxKw: float("active_power_max_kw"),
  capacityFactorPct: float("capacity_factor_pct"),
  firstObservedAt: timestamptz("first_observed_at"),
  lastObservedAt: timestamptz("last_observed_at"),
}).existing();
