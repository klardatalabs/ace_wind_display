// Converts raw telemetry into human-centric figures (exploratory analysis.md, section 2).
// Pure functions only - safe to import from both the Node backend and the browser.

import {
  AVG_UK_HOME_DEMAND_KW,
  CO2_FACTOR_KG_PER_KWH,
  CO2_KG_PER_TREE_PER_YEAR,
  COMMUNITY_FUND_RATE_GBP_PER_MWH,
  RATED_POWER_KW,
  ROTOR_DIAMETER_M,
} from "./constants.js";

export function homesPoweredNow(activePowerKw) {
  if (typeof activePowerKw !== "number" || activePowerKw <= 0) return 0;
  return Math.round(activePowerKw / AVG_UK_HOME_DEMAND_KW);
}

export function co2AvoidedKg(energyKwh) {
  if (typeof energyKwh !== "number" || energyKwh <= 0) return 0;
  return energyKwh * CO2_FACTOR_KG_PER_KWH;
}

export function treesEquivalent(co2Kg) {
  if (typeof co2Kg !== "number" || co2Kg <= 0) return 0;
  return co2Kg / CO2_KG_PER_TREE_PER_YEAR;
}

/** Indicative only - see COMMUNITY_FUND_RATE_GBP_PER_MWH in constants.js. */
export function communityFundGbp(energyKwh) {
  if (typeof energyKwh !== "number" || energyKwh <= 0) return 0;
  return (energyKwh / 1000) * COMMUNITY_FUND_RATE_GBP_PER_MWH;
}

export function tipSpeedMs(rotorRpm) {
  if (typeof rotorRpm !== "number" || rotorRpm <= 0) return 0;
  return (rotorRpm * 2 * Math.PI * (ROTOR_DIAMETER_M / 2)) / 60;
}

export function msToMph(ms) {
  return ms * 2.23694;
}

export function capacityFactorPct(lifetimeKwh, commissionDate, now = new Date()) {
  const hours = (now - commissionDate) / 3_600_000;
  if (hours <= 0) return 0;
  const maxPossibleKwh = RATED_POWER_KW * hours;
  return (lifetimeKwh / maxPossibleKwh) * 100;
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
