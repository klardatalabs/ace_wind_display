// Animates the hoarding the visitor scanned. Only fixed actions ever reach a screen; one
// animation per screen at a time (a short cooldown shared by every visitor at that screen).

import { enforceScreenCooldown } from "../../api/services/screens.js";
import { SCREEN_ACTION_IDS, SCREEN_ACTIONS } from "../../../shared/screens.js";

export const kind = "screen_action";

const SHOWABLE = SCREEN_ACTION_IDS.filter((a) => a !== "walk_to");

export const definition = {
  type: "function",
  function: {
    name: "show_on_big_screen",
    description: `Animate the big public screen the visitor is standing at, when they want to see something. Actions: ${SHOWABLE.map((a) => `${a} (${SCREEN_ACTIONS[a]})`).join("; ")}.`,
    parameters: {
      type: "object",
      properties: { action: { type: "string", enum: SHOWABLE } },
      required: ["action"],
      additionalProperties: false,
    },
  },
};

export async function run({ action } = {}, ctx) {
  const result = await enforceScreenCooldown(ctx.screen, action);
  if (result.ok) ctx.addAction(action);
  return result;
}
