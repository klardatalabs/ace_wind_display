// Phone -> hoarding remote: a visitor can tap "Look inside" on their phone and the big
// screen they scanned animates. Requires a valid chat session for that same screen.

import { Router } from "express";
import { requireChatSession } from "../chat/session.js";
import { triggerScreen, SCREEN_ACTIONS } from "../chat/tools/bigScreen.js";
import { connectedScreens } from "../realtime/socketHub.js";

const router = Router();

router.get("/", (_req, res) => res.json({ actions: SCREEN_ACTIONS, connected: connectedScreens() }));

router.post("/command", requireChatSession, async (req, res) => {
  const action = req.body?.action;
  if (!SCREEN_ACTIONS.includes(action)) return res.status(400).json({ error: "Unknown action" });
  const result = await triggerScreen(req.chatSession.screen, action, req.body?.value);
  res.status(result.ok ? 200 : 429).json(result);
});

export default router;
