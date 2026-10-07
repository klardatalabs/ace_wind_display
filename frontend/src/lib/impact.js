// Human-scale conversions shared with the server (see shared/impact.js).
export {
  homesPoweredNow,
  co2AvoidedKg,
  treesEquivalent,
  communityFundGbp,
  tipSpeedMs,
  msToMph,
  beaufortLabel,
} from "@shared/impact.js";
export { RATED_POWER_KW, CUT_IN_WIND_MS, RATED_WIND_MS, ROTOR_DIAMETER_M, ATTRIBUTION_TEXT, LICENSE_URL } from "@shared/constants.js";

/** Cups of tea from kWh: a kettle boil for one cup is ~0.03 kWh. */
export const cupsOfTea = (kwh) => Math.round(Math.max(0, kwh) / 0.03);

/** Phone charges from kWh: ~0.015 kWh per full smartphone charge. */
export const phoneCharges = (kwh) => Math.round(Math.max(0, kwh) / 0.015);
