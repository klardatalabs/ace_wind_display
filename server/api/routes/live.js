// Live state and weather (also pushed over /ws), the public config, and the screens.

import { Router } from "express";
import { config } from "../../config/index.js";
import { currentState, currentEnvironment } from "../liveFeed.js";
import { connectedScreens } from "../realtime/socketHub.js";
import { requireChatSession } from "../../chat/session.js";
import { enforceScreenCooldown, walkTo } from "../services/screens.js";
import { enforce } from "../middleware/rateLimit.js";
import { LIMITS } from "../rateLimits.js";
import { unavailable, badRequest } from "../../lib/errors.js";
import { SCREEN_ACTION_IDS } from "../../../shared/screens.js";
import { SITE } from "../../../shared/site.js";

export const liveRoutes = Router();

liveRoutes.get("/state", (_req, res) => {
  const state = currentState();
  if (!state) throw unavailable("No live reading has arrived yet.");
  res.set("Cache-Control", "no-store").json(state);
});

liveRoutes.get("/environment", (_req, res) => {
  const environment = currentEnvironment();
  if (!environment) throw unavailable("No weather reading has arrived yet.");
  res.set("Cache-Control", "no-store").json(environment);
});

// The public origin for QR codes and shared links comes from configuration only, so it
// always follows the domain the site is deployed on and can't be spoofed by a Host header.
liveRoutes.get("/config", (_req, res) => {
  res.set("Cache-Control", "public, max-age=300").json({ publicOrigin: config.http.publicOrigin, site: { lat: SITE.lat, lon: SITE.lon } });
});

liveRoutes.get("/screens", async (_req, res) => {
  res.set("Cache-Control", "no-store").json({ actions: SCREEN_ACTION_IDS, connected: await connectedScreens() });
});

liveRoutes.post("/screens/command", requireChatSession, async (req, res) => {
  const { sessionId, screen } = req.chatSession;
  const action = req.body?.action;
  if (!SCREEN_ACTION_IDS.includes(action)) throw badRequest("Unknown action.");
  if (action === "walk_to") {
    await enforce(res, `screen-walk:${sessionId}`, LIMITS.screenWalkPerSession);
    return res.json(await walkTo(screen, req.body?.value));
  }
  await enforce(res, `screen-command:${sessionId}`, LIMITS.screenCommandPerSession);
  const result = await enforceScreenCooldown(screen, action);
  res.status(result.ok ? 200 : 409).json(result);
});
