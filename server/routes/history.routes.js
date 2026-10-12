import { Router } from "express";
import { E115_REFERENCE_CURVE } from "../../shared/physics.js";
import { getWecStdRange } from "../clients/aceClient.js";
import {canonicalHistory} from '../history/config.js';
import {getDailyRollups,getHistoryRange,getHistoryHealth} from '../history/database.js';
import {streamHistoryCsv} from '../history/export.js';
import {
  isDbAvailable,
  getTimescaleComparisonMetrics,
  getTimescaleRecords,
  getTimescalePowerCurve,
} from "../db/timescaleDb.js";

const router = Router();
const fail = (res, err, status = 500) => res.status(status).json({ error: String(err.message ?? err) });
const unavailable=res=>res.status(503).json({error:'Historical database unavailable'});
router.get('/health',async(_req,res)=>{
  try {res.json({...await getHistoryHealth(),backend:canonicalHistory?'timescale':'legacy'});}
  catch {unavailable(res);}
});
router.get('/export',streamHistoryCsv);

// Today vs yesterday, month vs month, or custom ranges
router.get("/compare", async (req, res) => {
  try {
    if (await isDbAvailable()) {
      const { mode, start1, end1, start2, end2 } = req.query;
      return res.json(await getTimescaleComparisonMetrics({ mode, start1, end1, start2, end2 }));
    }
    if(canonicalHistory)return unavailable(res);
    const legacy=await import('../db/sqliteDb.js');
    res.json(legacy.getComparisonMetrics());
  } catch (err) {
    if(canonicalHistory)unavailable(res);else fail(res,err);
  }
});

// All-time records, extremes and cumulative totals
router.get("/records", async (_req, res) => {
  try {
    if (await isDbAvailable()) return res.json(await getTimescaleRecords());
    res.status(503).json({ error: "TimescaleDB currently unavailable" });
  } catch (err) {
    if(canonicalHistory)unavailable(res);else fail(res,err);
  }
});

// Binned empirical power curve with theoretical overlay
router.get("/power-curve", async (_req, res) => {
  try {
    if (await isDbAvailable()) return res.json(await getTimescalePowerCurve());
    if(canonicalHistory)return unavailable(res);
    // No history database: still serve the manufacturer curve so charts can draw.
    res.json({
      metadata: { turbine_model: "Enercon E-115 EP3", rated_power_kw: 4200, source: "reference-only", total_samples_analyzed: 0 },
      empirical: [],
      theoretical: E115_REFERENCE_CURVE,
    });
  } catch (err) {
    if(canonicalHistory)unavailable(res);else fail(res,err);
  }
});

// Daily rollups from the local SQLite cache
router.get("/daily", async (req, res) => {
  try {
    const limit=Math.max(1,Math.min(365,Math.floor(Number(req.query.limit) || 30)));
    const days=canonicalHistory ? await getDailyRollups(limit) : (await import('../db/sqliteDb.js')).getDailyRollups(limit);
    res.json(days);
  } catch (err) {
    if(canonicalHistory)unavailable(res);else fail(res,err);
  }
});

// Wind-vs-power range proxied from the ACE API so browsers never call it directly
router.get("/", async (req, res) => {
  try {
    const hours = Math.max(1,Math.min(24 * 30, Number(req.query.hours) || 24));
    if(canonicalHistory)return res.json(await getHistoryRange(hours));
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
    if(canonicalHistory)unavailable(res);else fail(res,err,502);
  }
});

export default router;
