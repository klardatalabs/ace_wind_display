// Converts raw telemetry into human-centric figures (exploratory analysis.md, section 2).
// Pure functions only - imported by both the Node backend and the React frontend.

import {
  AVG_UK_HOME_DEMAND_KW,
  ROTOR_DIAMETER_M,
} from "./constants.js";

export function homesPoweredNow(activePowerKw) {
  if (typeof activePowerKw !== "number" || activePowerKw <= 0) return 0;
  return Math.round(activePowerKw / AVG_UK_HOME_DEMAND_KW);
}

export function tipSpeedMs(rotorRpm) {
  if (typeof rotorRpm !== "number" || rotorRpm <= 0) return 0;
  return (rotorRpm * 2 * Math.PI * (ROTOR_DIAMETER_M / 2)) / 60;
}

export function msToMph(ms) {
  return ms * 2.23694;
}

export function beaufortLabel(windSpeedMs) {
  if (windSpeedMs < 0.5) return "Calm";
  if (windSpeedMs < 3.4) return "Light breeze";
  if (windSpeedMs < 5.5) return "Gentle breeze";
  if (windSpeedMs < 8.0) return "Moderate breeze";
  if (windSpeedMs < 10.8) return "Fresh breeze";
  if (windSpeedMs < 13.9) return "Strong breeze";
  if (windSpeedMs < 17.2) return "Near gale";
  if (windSpeedMs < 20.8) return "Gale";
  if (windSpeedMs < 24.5) return "Strong gale";
  if (windSpeedMs < 28.5) return "Storm";
  return "Violent storm";
}
