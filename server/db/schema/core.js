// core schema: reference data. Table structure (constraints included) is defined by the SQL
// migrations; these definitions describe it for typed queries, and test/schema.test.mjs
// checks they match the real database.

import { pgSchema, text, integer, date, primaryKey } from "drizzle-orm/pg-core";
import { float, timestamptz } from "./columns.js";

export const core = pgSchema("core");

export const site = core.table("site", {
  siteId: text("site_id").primaryKey(),
  name: text("name").notNull(),
  latitude: float("latitude").notNull(),
  longitude: float("longitude").notNull(),
  timeZone: text("time_zone").notNull(),
});

export const turbineModel = core.table("turbine_model", {
  modelId: text("model_id").primaryKey(),
  manufacturer: text("manufacturer").notNull(),
  ratedPowerKw: float("rated_power_kw").notNull(),
  rotorDiameterM: float("rotor_diameter_m").notNull(),
  cutInWindMs: float("cut_in_wind_ms").notNull(),
  ratedWindMs: float("rated_wind_ms").notNull(),
  stormControlFromMs: float("storm_control_from_ms").notNull(),
  cutOutWindMs: float("cut_out_wind_ms").notNull(),
});

export const powerCurvePoint = core.table(
  "power_curve_point",
  {
    modelId: text("model_id").notNull().references(() => turbineModel.modelId),
    windSpeedMs: float("wind_speed_ms").notNull(),
    powerKw: float("power_kw").notNull(),
  },
  (t) => [primaryKey({ columns: [t.modelId, t.windSpeedMs] })]
);

export const asset = core.table("asset", {
  assetId: text("asset_id").primaryKey(),
  siteId: text("site_id").notNull().references(() => site.siteId),
  modelId: text("model_id").notNull().references(() => turbineModel.modelId),
  gridSetpointKw: float("grid_setpoint_kw").notNull(),
  commissionedOn: date("commissioned_on").notNull(),
});

export const dataSource = core.table("data_source", {
  sourceId: text("source_id").primaryKey(),
  description: text("description").notNull(),
});

export const sourceRelease = core.table("source_release", {
  releaseId: integer("release_id").primaryKey().generatedAlwaysAsIdentity(),
  sourceId: text("source_id").notNull().references(() => dataSource.sourceId),
  releaseRef: text("release_ref").notNull(),
  checksum: text("checksum"),
  importedAt: timestamptz("imported_at").notNull().defaultNow(),
});

export const weatherCondition = core.table("weather_condition", {
  conditionId: integer("condition_id").primaryKey(),
  main: text("main").notNull(),
  description: text("description").notNull(),
});

export const siteDaylight = core.table(
  "site_daylight",
  {
    siteId: text("site_id").notNull().references(() => site.siteId),
    localDate: date("local_date").notNull(),
    sunriseAt: timestamptz("sunrise_at").notNull(),
    sunsetAt: timestamptz("sunset_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.localDate] })]
);
