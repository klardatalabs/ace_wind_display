// Classifies live telemetry into one "mood" every screen can talk about in its own voice.
// moods: connecting | fault | maintenance | storm | curtailed | calm | starting | generating

import { CUT_IN_WIND_MS, CUT_OUT_LOW_MS } from "@shared/constants.js";

export function classifyMood(state) {
  if (!state) return "connecting";
  const status = state.statusEvent ?? {};
  const now = state.now ?? {};
  if (status.fault_message_flag) return "fault";
  if (status.service_flag) return "maintenance";
  if (now.windSpeed >= CUT_OUT_LOW_MS) return "storm";
  if (now.windSpeed < CUT_IN_WIND_MS && !(now.activePowerKw > 10)) return "calm";
  const avail = now.availablePowerAfterSetpoints;
  const theoretical = now.theoreticalMaxPower;
  if (avail > 0 && theoretical > 0 && avail < theoretical * 0.95 && now.activePowerKw >= avail * 0.9) return "curtailed";
  if (status.main_status === 2) return "starting";
  if (!(now.activePowerKw > 0)) return "calm";
  return "generating";
}

/** One-line status in each screen's voice. */
export const MOOD_LINES = {
  students: {
    connecting: "Hello! Just waking up…",
    fault: "I've paused for a safety check.",
    maintenance: "Check-up time! My hi-vis crew is visiting.",
    storm: "Whoa, what a gale! I'm turning my blades to stay safe.",
    curtailed: "The grid asked me to slow down, so I'm making a bit less.",
    calm: "Shh… nap time. Waiting for a breeze.",
    starting: "Ooh, I feel a breeze — starting up!",
    generating: "Spinning and making clean power!",
  },
  community: {
    connecting: "Connecting to the turbine…",
    fault: "Stopped for safety — engineers notified",
    maintenance: "Being looked after — technicians on site",
    storm: "Too windy right now — blades turned to stay safe",
    curtailed: "Holding back — National Grid asked for less power",
    calm: "Resting — not quite enough wind to spin",
    starting: "Starting up",
    generating: "Generating clean electricity for Lawrence Weston",
  },
  college: {
    connecting: "Awaiting telemetry",
    fault: "FAULT — fault_message_flag set, rotor stopped",
    maintenance: "SERVICE — service_flag set",
    storm: "STORM CUT-OUT — wind above 28 m/s, blades feathered",
    curtailed: "CURTAILED — setpoint below available power",
    calm: "BELOW CUT-IN — wind under 2.5 m/s",
    starting: "STARTING — main_status 2",
    generating: "GENERATING — partial / full load",
  },
};

MOOD_LINES.story = MOOD_LINES.community;
