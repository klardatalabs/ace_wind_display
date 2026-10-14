// Sending animation commands to a hoarding: the screen must be connected (on any instance),
// and big animations share a short per-screen cooldown so visitors take turns.

import { consume } from "../../infra/rateLimit.js";
import { connectedScreens, sendScreenCommand } from "../realtime/socketHub.js";
import { LIMITS } from "../rateLimits.js";
import { SCREEN_ACTION_IDS } from "../../../shared/screens.js";

export async function enforceScreenCooldown(screen, action) {
  if (!SCREEN_ACTION_IDS.includes(action) || action === "walk_to") return { ok: false, reason: "unknown action" };
  if (!(await connectedScreens())[screen]) return { ok: false, reason: "That screen is not connected right now." };
  const turn = await consume(`screen-show:${screen}`, LIMITS.screenShowCooldown);
  if (!turn.allowed) return { ok: false, reason: `The screen is busy showing something; try again in ${Math.ceil(turn.retryAfterMs / 1000)}s.` };
  await sendScreenCommand(screen, action);
  return { ok: true, screen, action };
}

/** The walk slider: frequent small updates, so no cooldown (the caller limits per session). */
export async function walkTo(screen, value) {
  const position = Math.min(1, Math.max(0, Number(value) || 0));
  if (!(await connectedScreens())[screen]) return { ok: false, reason: "That screen is not connected right now." };
  await sendScreenCommand(screen, "walk_to", position);
  return { ok: true, screen, action: "walk_to", value: position };
}
