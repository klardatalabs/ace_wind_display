// History for the website and screens, served from cache. Every result lives in the
// versioned "history" namespace: when the collector finishes a sync it bumps the version and
// every instance's cached history becomes stale at once. Response shapes are the ones the
// frontend charts already read (snake_case).

import { cached, versionedKey } from "../../infra/cache.js";
import * as daily from "../../db/repositories/daily.js";
import * as scada from "../../db/repositories/scada.js";
import { db } from "../../db/client.js";
import { powerCurvePoint, turbineModel } from "../../db/schema/core.js";
import { asc, eq } from "drizzle-orm";
import { ASSET } from "../../../shared/site.js";
import { AVG_UK_HOME_DEMAND_KW } from "../../../shared/constants.js";

const TTL = { freshSec: 10 * 60, staleSec: 24 * 3600 };
const STALE_AFTER_MS = 30 * 60_000;

const fromCache = async (name, loader) => cached(await versionedKey("history", name), TTL, loader);
const round = (v, digits = 1) => (v == null ? null : Number(v.toFixed(digits)));

export const series = (hours) =>
  fromCache(`series:${hours}`, async () => {
    const rows = await scada.series(ASSET.id, hours);
    return {
      timestamps: rows.map((r) => new Date(r.t).getTime() * 1000), // epoch microseconds, as ACE sends
      wind: rows.map((r) => r.wind),
      power: rows.map((r) => r.power),
    };
  });

export const recentDays = (limit) =>
  fromCache(`daily:${limit}`, async () => {
    const days = await daily.recentDays(ASSET.id, limit);
    const newest = days.find((d) => d.lastObservedAt)?.lastObservedAt;
    const stale = !newest || Date.now() - +new Date(newest) > STALE_AFTER_MS;
    return days.map((d) => ({
      date_london: d.localDate,
      energy_kwh: round(d.energyKwh),
      energy_method: d.energyMethod,
      coverage_pct: d.coveragePct ?? 0,
      capacity_factor_pct: round(d.capacityFactorPct),
      avg_wind_ms: round(d.windSpeedAvgMs, 2),
      max_wind_ms: round(d.windSpeedMaxMs, 2),
      avg_power_kw: round(d.activePowerAvgKw),
      peak_power_kw: round(d.activePowerMaxKw),
      history_stale: stale,
    }));
  });

export const records = () =>
  fromCache("records", async () => {
    const [power, wind, best, total] = await Promise.all([
      scada.peak(ASSET.id, "activePowerMaxKw"),
      scada.peak(ASSET.id, "windSpeedMaxMs"),
      daily.bestDay(ASSET.id),
      daily.totals(ASSET.id),
    ]);
    return {
      scope: "stored history",
      period: { from: total.firstDate, to: total.lastDate },
      peak_power: power && { power_max_kw: power.activePowerMaxKw, power_mean_kw: power.activePowerMeanKw, timestamp: power.observedAt, wind_speed_ms: power.windSpeedMeanMs },
      peak_wind: wind && { wind_max_ms: wind.windSpeedMaxMs, wind_mean_ms: wind.windSpeedMeanMs, timestamp: wind.observedAt, power_kw: wind.activePowerMeanKw },
      highest_daily_energy: best && {
        date: best.localDate, energy_kwh: round(best.energyKwh), energy_method: best.energyMethod,
        peak_power_kw: best.activePowerMaxKw, avg_wind_ms: round(best.windSpeedAvgMs, 2), capacity_factor_pct: round(best.capacityFactorPct),
      },
      totals: {
        total_energy_kwh: round(total.energyKwh),
        total_days: total.days,
        overall_avg_power_kw: round(total.avgPowerKw),
        overall_avg_wind_ms: round(total.avgWindMs, 2),
        homes_powered_on_average: total.avgPowerKw ? Math.round(total.avgPowerKw / AVG_UK_HOME_DEMAND_KW) : null,
      },
    };
  });

export const powerCurve = () =>
  fromCache("power-curve", async () => {
    const [measured, reference, [model]] = await Promise.all([
      scada.measuredPowerCurve(ASSET.id),
      db.select().from(powerCurvePoint).where(eq(powerCurvePoint.modelId, ASSET.modelId)).orderBy(asc(powerCurvePoint.windSpeedMs)),
      db.select().from(turbineModel).where(eq(turbineModel.modelId, ASSET.modelId)),
    ]);
    return {
      metadata: {
        turbine_model: `${model.manufacturer} ${model.modelId}`,
        rated_power_kw: model.ratedPowerKw,
        cut_in_speed_ms: model.cutInWindMs,
        rated_wind_speed_ms: model.ratedWindMs,
        storm_control_from_ms: model.stormControlFromMs,
        cut_out_wind_speed_ms: model.cutOutWindMs,
        total_samples_analyzed: measured.reduce((n, b) => n + b.sampleCount, 0),
      },
      empirical: measured.map((b) => ({
        bin_wind: b.binWind, power_avg_kw: round(b.powerAvgKw), power_min_kw: round(b.powerMinKw), power_max_kw: round(b.powerMaxKw),
        power_std_kw: round(b.powerStdKw), actual_wind_avg: round(b.actualWindAvg, 2), sample_count: b.sampleCount,
      })),
      theoretical: reference.map((p) => ({ wind: p.windSpeedMs, power: p.powerKw })),
    };
  });

const roundPeriod = (p) => ({
  from: p.from, to: p.to, days: p.days,
  energy_kwh: round(p.energyKwh), avg_power_kw: round(p.avgPowerKw), max_power_kw: round(p.maxPowerKw), avg_wind_ms: round(p.avgWindMs, 2),
});

export const monthComparison = () =>
  fromCache("months", async () => {
    const { current, previous } = await daily.monthComparison(ASSET.id);
    const delta = previous.energyKwh > 0 && current.energyKwh != null ? round(((current.energyKwh - previous.energyKwh) / previous.energyKwh) * 100) : null;
    return { mode: "months", this_month: roundPeriod(current), last_month: roundPeriod(previous), delta_energy_pct: delta };
  });

export const periodComparison = (a, b) =>
  fromCache(`compare:${a.from}:${a.to}:${b.from}:${b.to}`, async () => {
    const [first, second] = await Promise.all([daily.periodTotals(ASSET.id, a.from, a.to), daily.periodTotals(ASSET.id, b.from, b.to)]);
    const delta = first.energyKwh > 0 && second.energyKwh != null ? round(((second.energyKwh - first.energyKwh) / first.energyKwh) * 100) : null;
    return { mode: "custom", period_1: roundPeriod(first), period_2: roundPeriod(second), delta_energy_pct: delta };
  });

export const pastDay = () =>
  fromCache("past-24h", async () => {
    const r = await scada.past24Hours(ASSET.id);
    if (!r.samples) return null;
    return {
      period: "past 24 hours",
      energy_kwh: round(r.energyKwh), energy_method: "estimated from 10-minute mean power",
      avg_power_kw: round(r.avgPowerKw), max_power_kw: r.maxPowerKw, avg_wind_ms: round(r.avgWindMs, 2), max_wind_ms: r.maxWindMs,
      coverage_pct: round((r.samples / 144) * 100),
    };
  });

export const day = (localDate) =>
  fromCache(`day:${localDate}`, async () => {
    const d = await daily.singleDay(ASSET.id, localDate);
    return d && {
      date: d.localDate, energy_kwh: round(d.energyKwh), energy_method: d.energyMethod, coverage_pct: d.coveragePct,
      avg_wind_ms: round(d.windSpeedAvgMs, 2), max_wind_ms: d.windSpeedMaxMs, avg_power_kw: round(d.activePowerAvgKw), peak_power_kw: d.activePowerMaxKw,
    };
  });
