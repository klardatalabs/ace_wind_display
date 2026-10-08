// Admin: simulate mode for demos (drive every screen without real wind) and a remote
// control for the hoardings. Protected by ADMIN_TOKEN when it is set (always set it on
// a public deployment).

import crypto from "node:crypto";
import { Router } from "express";
import { getState, setSimulatedState, resumeLive, applyPreset, PRESETS } from "../services/turbineState.js";
import { connectedScreens, sendScreenCommand } from "../realtime/socketHub.js";
import { SCREEN_ACTIONS } from "../chat/tools/bigScreen.js";
import { SCREENS } from "../chat/session.js";
import { config } from "../config/env.js";
import { getEnvironment, setOverride, clearOverride } from "../services/environmentService.js";

const router = Router();

function requireAdmin(req, res, next) {
  if (!config.adminToken) return next();
  const given = Buffer.from(String(req.get("x-admin-token") || ""));
  const expected = Buffer.from(config.adminToken);
  if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return next();
  res.status(401).json({ error: "admin_token_required" });
}

router.use(requireAdmin);

router.get("/presets", (_req, res) => res.json(PRESETS));
router.get("/screens", (_req, res) => res.json(connectedScreens()));

router.post("/preset", (req, res) => {
  if (!applyPreset(req.body?.preset)) return res.status(400).json({ error: "Unknown preset" });
  res.json(getState());
});

const NUMERIC_NOW = ["windSpeed", "activePowerKw", "rotorRpm", "nacelleDeg", "aggregateWindDir", "availablePowerAfterSetpoints", "theoreticalMaxPower"];
const STATUS_FLAGS = ["main_status", "substatus", "fault_message_flag", "warning_message_flag", "service_flag"];

/** Keeps only known, finite numeric fields so the simulator can't push junk to every screen. */
function pickNumbers(source, keys) {
  const out = {};
  for (const key of keys) {
    const v = Number(source?.[key]);
    if (source?.[key] !== undefined && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

router.post("/simulate", (req, res) => {
  const body = req.body ?? {};
  const values = {
    now: pickNumbers(body.now, NUMERIC_NOW),
    today: pickNumbers(body.today, ["energyKwh", "avgWindSpeed"]),
    statusEvent: pickNumbers(body.statusEvent, STATUS_FLAGS),
  };
  setSimulatedState(values);
  res.json(getState());
});

router.post("/resume-live", (_req, res) => {
  resumeLive();
  res.json(getState());
});

// Demo the place: jump to a time of day, add cloud / rain / fog. Send nulls (or DELETE) to go back to real.
router.get("/environment", (_req, res) => res.json(getEnvironment()));
router.post("/environment", (req, res) => res.json(setOverride(req.body ?? {})));
router.delete("/environment", (_req, res) => res.json(clearOverride()));

// Unlike the phone remote, the admin is not rate-limited and can drive any screen.
router.post("/screens/:screen/command", (req, res) => {
  const { screen } = req.params;
  const action = req.body?.action;
  if (!SCREENS.includes(screen)) return res.status(400).json({ error: "Unknown screen" });
  if (!SCREEN_ACTIONS.includes(action)) return res.status(400).json({ error: "Unknown action" });
  const value = action === "walk_to" ? Math.min(1, Math.max(0, Number(req.body?.value) || 0)) : undefined;
  res.json({ ok: true, delivered: sendScreenCommand(screen, action, value) });
});

export default router;
