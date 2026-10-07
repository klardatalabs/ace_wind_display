// Simulate mode for demos and testing the hoardings without real wind.

import { Router } from "express";
import { getState, setSimulatedState, resumeLive, applyPreset, PRESETS } from "../services/turbineState.js";
import { connectedScreens } from "../realtime/socketHub.js";

const router = Router();

router.get("/presets", (_req, res) => res.json(PRESETS));
router.get("/screens", (_req, res) => res.json(connectedScreens()));

router.post("/preset", (req, res) => {
  if (!applyPreset(req.body?.preset)) return res.status(400).json({ error: "Unknown preset" });
  res.json(getState());
});

router.post("/simulate", (req, res) => {
  setSimulatedState(req.body ?? {});
  res.json(getState());
});

router.post("/resume-live", (_req, res) => {
  resumeLive();
  res.json(getState());
});

export default router;
