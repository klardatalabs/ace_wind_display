import { Router } from "express";
import { E115_REFERENCE_CURVE } from "../../shared/physics.js";
import { getWecStdRange } from "../clients/aceClient.js";
import { getComparisonMetrics, getDailyRollups } from "../db/sqliteDb.js";
import {
  isDbAvailable,
  getTimescaleComparisonMetrics,
  getTimescaleRecords,
  getTimescalePowerCurve,
} from "../db/timescaleDb.js";

const router = Router();
const fail = (res, err, status = 500) => res.status(status).json({ error: String(err.message ?? err) });

// Today vs yesterday, month vs month, or custom ranges
router.get("/compare", async (req, res) => {
  try {
    if (await isDbAvailable()) {
      const { mode, start1, end1, start2, end2 } = req.query;
      return res.json(await getTimescaleComparisonMetrics({ mode, start1, end1, start2, end2 }));
    }
    res.json(getComparisonMetrics());
  } catch (err) {
    fail(res, err);
  }
});

// All-time records, extremes and cumulative totals
router.get("/records", async (_req, res) => {
  try {
    if (await isDbAvailable()) return res.json(await getTimescaleRecords());
    res.status(503).json({ error: "TimescaleDB currently unavailable" });
  } catch (err) {
    fail(res, err);
  }
});

// Binned empirical power curve with theoretical overlay
router.get("/power-curve", async (_req, res) => {
  try {
    if (await isDbAvailable()) return res.json(await getTimescalePowerCurve());
    // No history database: still serve the manufacturer curve so charts can draw.
    res.json({
      metadata: { turbine_model: "Enercon E-115 EP3", rated_power_kw: 4200, source: "reference-only", total_samples_analyzed: 0 },
      empirical: [],
      theoretical: E115_REFERENCE_CURVE,
    });
  } catch (err) {
    fail(res, err);
  }
});

// Daily rollups from the local SQLite cache
router.get("/daily", (req, res) => {
  try {
    res.json(getDailyRollups(Math.min(365, Number(req.query.limit) || 30)));
  } catch (err) {
    fail(res, err);
  }
});

// Wind-vs-power range proxied from the ACE API so browsers never call it directly
router.get("/", async (req, res) => {
  try {
    const hours = Math.min(24 * 30, Number(req.query.hours) || 24);
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3_600_000);
    const data = await getWecStdRange(["wind_speed_mean", "active_power_mean"], {
      resolution: hours > 48 ? "daily" : "10m",
      start: start.toISOString(),
      end: end.toISOString(),
      pageSize: 5000,
    });
    res.json({
      timestamps: data.timestamps ?? [],
      wind: data.series?.wind_speed_mean ?? [],
      power: data.series?.active_power_mean ?? [],
    });
  } catch (err) {
    fail(res, err, 502);
  }
});

export default router;
