import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env if present
const __envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(__envPath)) {
  const envContent = fs.readFileSync(__envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import express from "express";
import { WebSocketServer } from "ws";
import { createServer } from "node:http";

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

import { 
  checkRateLimit, 
  getSessionHistory, 
  appendSessionHistory, 
  cacheLiveTelemetry 
} from "./redisClient.js";
import { processChatPrompt } from "./aiAgent.js";

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

// --- Ask the Turbine (Chat REST fallback) -----------------------------------
app.post("/api/chat", async (req, res) => {
  try {
    const sessionId = req.body?.sessionId || "anon-" + Math.random().toString(36).slice(2, 10);
    const prompt = (req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    const rl = await checkRateLimit(`ratelimit:session:${sessionId}`, 6, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Rate limit exceeded. Please wait ${rl.resetSec} seconds.` });
    }

    const history = await getSessionHistory(sessionId);
    const answer = await processChatPrompt(prompt, history);

    await appendSessionHistory(sessionId, "user", prompt);
    await appendSessionHistory(sessionId, "assistant", answer);

    res.json({ sessionId, answer });
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) });
  }
});

// --- Researcher Dataset Access & Delivery -----------------------------------
import {
  requestDatasetDownload,
  verifyDownloadToken,
  getDatasetFilePath,
  recordDownloadSuccess,
  DATASET_FILES,
} from "./datasetService.js";

app.get("/api/datasets/list", (_req, res) => {
  res.json(DATASET_FILES);
});

app.post("/api/datasets/request", async (req, res) => {
  try {
    const { name, email, organization, purpose, datasetType } = req.body || {};
    const result = await requestDatasetDownload({
      name,
      email,
      organization,
      purpose,
      datasetType,
      host: req.get("host") || `localhost:${PORT}`,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: String(err.message ?? err) });
  }
});

app.get("/api/datasets/download", async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) return res.status(400).send("Missing download token.");

    const verification = verifyDownloadToken(token);
    if (!verification.valid) {
      return res.status(403).send(`Unauthorized: ${verification.error}`);
    }

    const { filePath, filename } = getDatasetFilePath(verification.datasetType);
    await recordDownloadSuccess(token);

    res.download(filePath, filename);
  } catch (err) {
    res.status(500).send(`Server error: ${err.message}`);
  }
});

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

wss.on("connection", (socket) => {
  // Push initial live state
  socket.send(JSON.stringify(getState()));

  // Handle incoming chat messages over WebSocket
  socket.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "chat.send") {
        const sessionId = msg.sessionId || "anon-" + Math.random().toString(36).slice(2, 10);
        const prompt = (msg.prompt || "").trim();
        if (!prompt) return;

        // Rate limit: 6 requests per 60 seconds per session
        const rl = await checkRateLimit(`ratelimit:session:${sessionId}`, 6, 60);
        if (!rl.allowed) {
          socket.send(JSON.stringify({
            type: "chat.error",
            sessionId,
            message: `You're chatting fast! Please wait ${rl.resetSec} seconds before asking again.`
          }));
          return;
        }

        const history = await getSessionHistory(sessionId);
        const streamId = "stream-" + Date.now();
        socket.send(JSON.stringify({ type: "chat.started", streamId, sessionId }));

        const fullAnswer = await processChatPrompt(
          prompt,
          history,
          (chunk) => {
            if (socket.readyState === socket.OPEN) {
              socket.send(JSON.stringify({ type: "chat.token", streamId, token: chunk }));
            }
          },
          (toolDesc) => {
            if (socket.readyState === socket.OPEN) {
              socket.send(JSON.stringify({ type: "chat.tool", streamId, status: toolDesc }));
            }
          }
        );

        await appendSessionHistory(sessionId, "user", prompt);
        await appendSessionHistory(sessionId, "assistant", fullAnswer);

        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: "chat.completed", streamId, sessionId }));
        }
      }
    } catch (err) {
      console.warn("[WS] Error handling client message:", err.message);
    }
  });
});

onStateChange((snapshot) => {
  cacheLiveTelemetry(snapshot);
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
