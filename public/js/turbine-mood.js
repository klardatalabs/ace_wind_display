// Classifies raw telemetry into one shared "mood" that every persona page maps
// to its own voice: a plain status line on Community, a cartoon face + line on
// Schools, and a status badge on Data Science.
//
// moods: "fault" | "maintenance" | "storm" | "curtailed" | "calm" | "starting" | "generating" | "connecting"

import { CUT_IN_WIND_MS, CUT_OUT_LOW_MS } from "./constants.js";

export function classifyMood(statusEvent, now) {
  if (!statusEvent && !now) return "connecting";

  const fault_message_flag = statusEvent?.fault_message_flag;
  const service_flag = statusEvent?.service_flag;
  const main_status = statusEvent?.main_status;

  if (fault_message_flag) return "fault";
  if (service_flag) return "maintenance";

  const windSpeed = now?.windSpeed;
  const power = now?.activePowerKw;

  if (typeof windSpeed === "number" && windSpeed >= CUT_OUT_LOW_MS) return "storm";

  if (typeof windSpeed === "number" && windSpeed < CUT_IN_WIND_MS && (typeof power !== "number" || power <= 10)) {
    return "calm";
  }

  if (main_status === 1) {
    const avail = now?.availablePowerAfterSetpoints;
    const theoretical = now?.theoreticalMaxPower;
    if (typeof avail === "number" && typeof theoretical === "number" && theoretical > 0 && avail < theoretical * 0.95) {
      return "curtailed";
    }
    return "calm";
  }

  if (main_status === 2) return "starting";

  return "generating";
}

// Community-facing (adult) plain-English line per mood.
export const COMMUNITY_MOOD_TEXT = {
  connecting: { tone: "idle", label: "Connecting to the turbine..." },
  fault: { tone: "bad", label: "Stopped for safety - engineers notified" },
  maintenance: { tone: "warn", label: "Being looked after - technicians on site" },
  storm: { tone: "warn", label: "Too windy right now - blades turned to stay safe" },
  curtailed: { tone: "warn", label: "Holding back - National Grid asked for less power" },
  calm: { tone: "idle", label: "Resting - not quite enough wind to spin" },
  starting: { tone: "warn", label: "Starting up" },
  generating: { tone: "good", label: "Generating clean electricity" },
};
