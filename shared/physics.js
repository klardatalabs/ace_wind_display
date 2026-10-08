// Theoretical behaviour of the Enercon E-115 EP3 at Lawrence Weston, for the admin
// simulator and as a fallback power curve when the history database is offline.
// Pure functions only - imported by both the Node backend and the React frontend.

import { CUT_IN_WIND_MS, RATED_WIND_MS, CUT_OUT_LOW_MS, CUT_OUT_HIGH_MS, GRID_SETPOINT_KW } from "./constants.js";

// ASSUMPTION: variable-speed range of the E-115 rotor (manufacturer data sheet range).
export const MIN_ROTOR_RPM = 4;
export const MAX_ROTOR_RPM = 12.8;
export const IDLE_ROTOR_RPM = 0.8; // feathered blades still drift round slowly

// Enercon E-115 EP3 4.2 MW manufacturer reference curve (wind m/s -> power kW).
export const E115_REFERENCE_CURVE = [
  { wind: 0, power: 0 }, { wind: 2, power: 0 }, { wind: 2.5, power: 5 }, { wind: 3, power: 45 },
  { wind: 4, power: 175 }, { wind: 5, power: 410 }, { wind: 6, power: 820 }, { wind: 7, power: 1400 },
  { wind: 8, power: 2150 }, { wind: 9, power: 2980 }, { wind: 10, power: 3680 }, { wind: 11, power: 4050 },
  { wind: 12, power: 4180 }, { wind: 13, power: GRID_SETPOINT_KW }, { wind: 25, power: GRID_SETPOINT_KW },
  // Enercon storm control: power is reduced gradually instead of a hard stop.
  { wind: CUT_OUT_LOW_MS, power: GRID_SETPOINT_KW }, { wind: CUT_OUT_HIGH_MS, power: 0 },
];

/** Power (kW) the turbine would make at a steady wind speed, before any curtailment. */
export function theoreticalPowerKw(windMs) {
  if (!(windMs > 0)) return 0;
  const curve = E115_REFERENCE_CURVE;
  if (windMs >= curve[curve.length - 1].wind) return 0;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (windMs <= b.wind) return a.power + ((windMs - a.wind) / (b.wind - a.wind)) * (b.power - a.power);
  }
  return 0;
}

/** Rotor speed (rpm) at a steady wind speed. */
export function theoreticalRotorRpm(windMs) {
  if (!(windMs >= CUT_IN_WIND_MS * 0.8)) return windMs > 1 ? IDLE_ROTOR_RPM * (windMs / 2) : 0;
  if (windMs >= CUT_OUT_HIGH_MS) return IDLE_ROTOR_RPM;
  if (windMs >= CUT_OUT_LOW_MS) {
    // Storm control slows the rotor as the wind rises past 28 m/s.
    const k = (windMs - CUT_OUT_LOW_MS) / (CUT_OUT_HIGH_MS - CUT_OUT_LOW_MS);
    return MAX_ROTOR_RPM - k * (MAX_ROTOR_RPM - IDLE_ROTOR_RPM);
  }
  const k = Math.min(1, (windMs - CUT_IN_WIND_MS * 0.8) / (RATED_WIND_MS * 0.85 - CUT_IN_WIND_MS * 0.8));
  return MIN_ROTOR_RPM + k * (MAX_ROTOR_RPM - MIN_ROTOR_RPM);
}

/**
 * A full telemetry snapshot for a simulated wind speed, shaped like the live state's `now`.
 * @param {{ windMs: number, nacelleDeg?: number, curtailKw?: number|null }} input
 */
export function simulateNow({ windMs, nacelleDeg = 215, curtailKw = null }) {
  const theoretical = theoreticalPowerKw(windMs);
  const cap = curtailKw == null ? GRID_SETPOINT_KW : Math.max(0, curtailKw);
  const power = Math.min(theoretical, cap);
  return {
    windSpeed: Number(windMs.toFixed(1)),
    activePowerKw: Math.round(power),
    rotorRpm: Number(theoreticalRotorRpm(windMs).toFixed(2)),
    nacelleDeg: Math.round(((nacelleDeg % 360) + 360) % 360),
    aggregateWindDir: Math.round(((nacelleDeg % 360) + 360) % 360),
    availablePowerAfterSetpoints: Math.round(cap),
    theoreticalMaxPower: Math.round(theoretical),
  };
}

/** Points for drawing the theoretical curve: [{ wind, power }] every 0.5 m/s. */
export function theoreticalCurve(maxWind = 34, step = 0.5) {
  const out = [];
  for (let w = 0; w <= maxWind + 1e-9; w += step) out.push({ wind: Number(w.toFixed(1)), power: theoreticalPowerKw(w) });
  return out;
}
