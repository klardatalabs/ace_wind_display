// Express app: JSON API under /api, the built React frontend for everything else.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

import { config } from "./config/env.js";
import stateRoutes from "./routes/state.routes.js";
import historyRoutes from "./routes/history.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import datasetRoutes from "./routes/datasets.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import screenRoutes from "./routes/screens.routes.js";
import environmentRoutes from "./routes/environment.routes.js";
import photoRoutes from "./routes/photos.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.join(__dirname, "..", "frontend", "dist");

export function createApp() {
  const app = express();
  if (config.trustProxy) app.set("trust proxy", 1);

  // Log method + path only: query strings and bodies may contain visitor text.
  app.use((req, _res, next) => {
    if (req.path.startsWith("/api")) console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
  app.use(express.json({ limit: "16kb" }));

  app.use("/api/state", stateRoutes);
  app.use("/api/history", historyRoutes);
  // The demo / simulation API can change what every public screen shows, so on a production
  // server it only exists when ADMIN_TOKEN is set.
  if (config.adminToken || process.env.NODE_ENV !== "production") app.use("/api/admin", adminRoutes);
  app.use("/api/datasets", datasetRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/screens", screenRoutes);
  app.use("/api/environment", environmentRoutes);
  app.use("/api/photos", photoRoutes);
  app.get("/api/weather", (_req, res) => res.redirect(307, "/api/environment/weather"));
  app.get("/api/config", (req, res) => {
    res.json({ publicOrigin: config.publicOrigin || `${req.protocol}://${req.get("host")}` });
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST, { index: false, maxAge: "1h" }));
    // Client-side routing: every non-API, non-file path serves the SPA shell.
    app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));
  } else {
    app.get("/", (_req, res) =>
      res.type("text").send("Frontend not built yet. Run `npm run build` (or `npm run dev` for the Vite dev server on :5173).")
    );
  }
  return app;
}
