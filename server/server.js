import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getState, onStateChange, startPolling, setSimulatedState, resumeLive, applyPreset, PRESETS } from "./state.js";
import { getWecStdRange } from "./aceClient.js";
import { getComparisonMetrics, getDailyRollups } from "./db.js";
import { startSyncJob } from "./syncJob.js";
import { startTimescaleSyncJob } from "./timescaleSyncJob.js";
import { 
  isDbAvailable, 
  getTimescaleComparisonMetrics, 
  getTimescaleRecords, 
  getTimescalePowerCurve 
} from "./timescaleDb.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4100;

const app = express();
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/", (_req, res) => res.redirect("/community.html"));

app.get("/api/state", (_req, res) => res.json(getState()));

// Historical comparison endpoint (Today vs Yesterday, Month vs Month, or Custom / Zenodo vs Live)
app.get("/api/history/compare", async (req, res) => {
  try {
    if (await isDbAvailable()) {
      const metrics = await getTimescaleComparisonMetrics({
        mode: req.query.mode,
        start1: req.query.start1,
        end1: req.query.end1,
        start2: req.query.start2,
        end2: req.query.end2,
      });
      return res.json(metrics);
    }
    // Fallback to SQLite
    res.json(getComparisonMetrics());
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

// All-time historical generation records, extremes, and cumulative totals
app.get("/api/history/records", async (_req, res) => {
  try {
    if (await isDbAvailable()) {
      const records = await getTimescaleRecords();
      return res.json(records);
    }
    res.status(503).json({ error: "TimescaleDB currently unavailable" });
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

// Empirical binned power curve from TimescaleDB with theoretical Enercon E-115 overlay
app.get("/api/history/power-curve", async (_req, res) => {
  try {
    if (await isDbAvailable()) {
      const curve = await getTimescalePowerCurve();
      return res.json(curve);
    }
    res.status(503).json({ error: "TimescaleDB currently unavailable" });
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

// Daily rollups (derived from scada_10m grouped by Europe/London)
app.get("/api/history/daily", (req, res) => {
  try {
    const limit = Math.min(365, Number(req.query.limit) || 30);
    res.json(getDailyRollups(limit));
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

// Proxies a wind-vs-power range query for the Data Science page's chart, so the
// browser never has to call the ACE API directly.
app.get("/api/history", async (req, res) => {
  try {
    const hours = Math.min(24 * 30, Number(req.query.hours) || 24);
    const resolution = hours > 48 ? "daily" : "10m";
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3_600_000);
    const data = await getWecStdRange(["wind_speed_mean", "active_power_mean"], {
      resolution,
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
    res.status(502).json({ error: String(err.message ?? err) });
  }
});

// --- Admin (simulate mode) --------------------------------------------------
app.get("/api/admin/presets", (_req, res) => {
  res.json(PRESETS);
});

app.post("/api/admin/preset", (req, res) => {
  const ok = applyPreset(req.body?.preset);
  if (!ok) return res.status(400).json({ error: "Unknown preset" });
  res.json(getState());
});

app.post("/api/admin/simulate", (req, res) => {
  setSimulatedState(req.body ?? {});
  res.json(getState());
});

app.post("/api/admin/resume-live", (_req, res) => {
  resumeLive();
  res.json(getState());
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (socket) => {
  socket.send(JSON.stringify(getState()));
});

onStateChange((snapshot) => {
  const payload = JSON.stringify(snapshot);
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
});

startPolling();
startSyncJob(12 * 60 * 1000);
startTimescaleSyncJob(12 * 60 * 1000);

httpServer.listen(PORT, () => {
  console.log(`ACE Wind Display server running at http://localhost:${PORT}`);
  console.log(`  Community:    http://localhost:${PORT}/community.html`);
  console.log(`  Schools:      http://localhost:${PORT}/schools.html`);
  console.log(`  Data Science: http://localhost:${PORT}/datascience.html`);
  console.log(`  Admin:        http://localhost:${PORT}/admin.html`);
});
