// Lets a visitor's chat move the camera / open the turbine on the hoarding whose QR they
// scanned. Only a fixed set of actions is ever sent to the screen — never chat text.

import { checkRateLimit } from "../../db/redisClient.js";
import { config } from "../../config/env.js";
import { sendScreenCommand } from "../../realtime/socketHub.js";

export const SCREEN_ACTIONS = ["look_inside", "tower_inside", "close_inside", "fly_to_nacelle", "fly_to_base", "overview", "spin_blades", "walk_start", "walk_stop", "walk_to"];

export const definition = {
  type: "function",
  function: {
    name: "show_on_big_screen",
    description:
      "Animate the big public screen the visitor is standing at. look_inside opens the turbine (cutaway, x-ray, exploded view) and flies into the machine room; tower_inside opens it and looks up the inside of the tower; walk_start takes the visitor on a first-person climb up the tower into the machine room (walk_stop ends it); close_inside closes it; fly_to_nacelle / fly_to_base move the camera; overview returns to the wide shot; spin_blades gives a playful spin. Use when the visitor asks to see something.",
    parameters: {
      type: "object",
      properties: { action: { type: "string", enum: SCREEN_ACTIONS } },
      required: ["action"],
      additionalProperties: false,
    },
  },
};

/** `value` is only used by walk_to (how far up the turbine, 0..1); anything else is ignored. */
export async function triggerScreen(screen, action, value) {
  if (!SCREEN_ACTIONS.includes(action)) return { ok: false, reason: "unknown action" };
  const number = action === "walk_to" && Number.isFinite(Number(value)) ? Math.min(1, Math.max(0, Number(value))) : undefined;
  // the slider sends many updates, so walk_to only has a short cooldown of its own
  if (action === "walk_to") {
    const delivered = sendScreenCommand(screen, action, number);
    return delivered > 0 ? { ok: true, screen, action, value: number } : { ok: false, reason: "That screen is not connected right now." };
  }
  const cooldown = config.chat.screenCommandCooldownSec;
  const rl = await checkRateLimit(`ww:screencmd:${screen}`, 1, cooldown);
  if (!rl.allowed) return { ok: false, reason: `The screen is busy showing something — try again in ${rl.resetSec}s.` };
  const delivered = sendScreenCommand(screen, action);
  return delivered > 0 ? { ok: true, screen, action } : { ok: false, reason: "That screen is not connected right now." };
}

export async function run({ action } = {}, ctx = {}) {
  const result = await triggerScreen(ctx.screen, action);
  if (result.ok) ctx.onAction?.(action);
  return result;
}
