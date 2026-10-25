// The Express app: security headers, request ids and logging, the per-IP API limit, the
// /api routes, then the built website (fingerprinted assets cached for a year; index.html
// always revalidated so a deploy is picked up at once).

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";
import { errorHandler } from "./middleware/errors.js";
import { rateLimit } from "./middleware/rateLimit.js";
import { LIMITS } from "./rateLimits.js";
import { notFound } from "../lib/errors.js";
import { liveRoutes } from "./routes/live.js";
import { historyRoutes } from "./routes/history.js";
import { datasetRoutes } from "./routes/datasets.js";
import { chatRoutes } from "./routes/chat.js";
import { photoRoutes } from "./routes/photos.js";
import { healthRoutes } from "./routes/health.js";
import { storyRoutes } from "./routes/stories.js";
import { gridRoutes } from "./routes/grid.js";
import { newsRoutes } from "./routes/news.js";

const log = logger("api.http");
const FRONTEND = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend", "dist");

const contentSecurityPolicy = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
    workerSrc: ["'self'", "blob:"],
    // Satoshi, the headline font, comes from Fontshare (frontend/index.html).
    styleSrc: ["'self'", "'unsafe-inline'", "https://api.fontshare.com"],
    imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://*.googleapis.com", "https://*.cesium.com"],
    connectSrc: ["'self'", "https://*.googleapis.com", "https://*.cesium.com", "https://*.virtualearth.net"],
    fontSrc: ["'self'", "data:", "https://cdn.fontshare.com"],
    objectSrc: ["'none'"],
    frameAncestors: ["'self'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
};

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.http.trustProxy);
  app.set("etag", "weak");

  app.use(helmet({ contentSecurityPolicy, crossOriginEmbedderPolicy: false }));
  app.use((req, res, next) => {
    req.id = req.get("x-request-id") || crypto.randomUUID();
    res.set("X-Request-Id", req.id);
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      if (!req.path.startsWith("/api") || req.path.startsWith("/api/health")) return;
      // Method, path and status only: query strings and bodies can hold visitor text.
      log.info("request", { requestId: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Number(process.hrtime.bigint() - started) / 1e6 });
    });
    next();
  });

  app.use("/api/health", healthRoutes);
  app.use("/api", rateLimit("api", LIMITS.api));
  app.use("/api", express.json({ limit: "16kb" }));
  app.use("/api", liveRoutes);
  app.use("/api/history", historyRoutes);
  app.use("/api/datasets", datasetRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/photos", photoRoutes);
  app.use("/api/stories", storyRoutes);
  app.use("/api/grid", gridRoutes);
  app.use("/api/news", newsRoutes);
  app.use("/api", () => {
    throw notFound();
  });

  if (fs.existsSync(FRONTEND)) {
    app.use(
      express.static(FRONTEND, {
        index: false,
        setHeaders(res, file) {
          const fingerprinted = file.includes(`${path.sep}assets${path.sep}`);
          // The big 3D files (turbine model, scan, Cesium's workers) change rarely: screens keep
          // them a week and refresh them in the background.
          const heavy = [`${path.sep}models${path.sep}`, `${path.sep}scenes${path.sep}`, `${path.sep}cesiumStatic${path.sep}`].some((dir) => file.includes(dir));
          res.set("Cache-Control", fingerprinted ? "public, max-age=31536000, immutable" : heavy ? "public, max-age=604800, stale-while-revalidate=86400" : "public, max-age=3600");
        },
      })
    );
    // Client-side routing: every other path gets the app shell.
    app.get(/^\/(?!api\/|ws$).*/, (_req, res) => res.set("Cache-Control", "no-cache").sendFile(path.join(FRONTEND, "index.html")));
  }

  app.use(errorHandler);
  return app;
}
