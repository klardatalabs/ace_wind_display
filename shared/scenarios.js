import { GRID_SETPOINT_KW, RATED_POWER_KW, ROTOR_DIAMETER_M } from "./constants.js";
import { E115_REFERENCE_CURVE, theoreticalRotorRpm } from "./physics.js";

export const MODEL_VERSION = "ace-what-if-3";
export const REFERENCE = { windMs: 7, windDeg: 215, durationHours: 1, gridLimitKw: GRID_SETPOINT_KW, airDensityKgM3: 1.225, operatingPct: 100 };
const BOUNDS = { windMs: [0, 34], windDeg: [0, 360], durationHours: [0.1, 168], gridLimitKw: [0, RATED_POWER_KW], airDensityKgM3: [0.8, 1.5], operatingPct: [0, 100] };
const FIELDS = Object.keys(BOUNDS);
const NUMBER = "(\\d+(?:\\.\\d+)?)";

const first = (text, expression) => Number(text.match(expression)?.[1]);
const finite = (value) => typeof value === "number" && Number.isFinite(value);
const round = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

export function parseScenario(prompt, baseline = REFERENCE) {
  if (typeof prompt !== "string" || prompt.length > 600) throw new Error("Describe an experiment in up to 600 characters.");
  const text = prompt.toLowerCase();
  const changes = {};
  const baselineChanges = {};
  const unsupported = [];
  const fromTo = text.match(new RegExp(`(?:wind(?: speed)?\\s*)?(?:rises?|changes?|goes?)\\s+from\\s+${NUMBER}\\s*(?:to|→)\\s*${NUMBER}\\s*(?:m\\/s|metres? per second)?`, "i"));
  if (fromTo && /wind/.test(text)) { baselineChanges.windMs = Number(fromTo[1]); changes.windMs = Number(fromTo[2]); }
  const explicitWind = first(text, new RegExp(`(?:wind(?: speed)?\\s*(?:of|to|at|=|is|becomes|reaches)|(?:set|make)\\s+(?:the\\s+)?wind(?: speed)?\\s+to)\\s*${NUMBER}\\s*(?:m\\/s|metres? per second)?`, "i"));
  if (finite(explicitWind)) changes.windMs = explicitWind;
  const percent = first(text, new RegExp(`${NUMBER}\\s*%\\s*(?:faster|higher|increase|stronger|slower|lower|decrease)`, "i"));
  const percentAfter = first(text, new RegExp(`(?:wind(?: speed)?\\s*)?(?:increases?|rises?|goes up|decreases?|drops?|falls?)\\s+by\\s+${NUMBER}\\s*%`, "i"));
  const windPercent = finite(percent) ? percent : percentAfter;
  if (finite(windPercent) && /wind/.test(text)) changes.windMs = round(baseline.windMs * (1 + windPercent / 100 * (/slower|lower|decrease|drops?|falls?/.test(text) ? -1 : 1)), 2);
  const deltaWind = first(text, new RegExp(`(?:wind(?: speed)?\\s*)?(?:increases?|rises?|goes up|decreases?|drops?|falls?)\\s+by\\s+${NUMBER}\\s*(?:m\\/s|metres? per second)`, "i"));
  if (finite(deltaWind) && /wind/.test(text)) changes.windMs = round(baseline.windMs + deltaWind * (/decrease|drops?|falls?/.test(text) ? -1 : 1), 2);
  const direction = first(text, new RegExp(`(?:wind direction|wind bearing|direction|bearing)\\s*(?:of|to|at|=|is)?\\s*${NUMBER}\\s*(?:°|degrees?)?`, "i"));
  if (finite(direction)) changes.windDeg = direction;
  const hours = first(text, new RegExp(`(?:for|over)\\s*${NUMBER}\\s*(?:hours?|hrs?|h)\\b`, "i"));
  const minutes = first(text, new RegExp(`(?:for|over)\\s*${NUMBER}\\s*(?:minutes?|mins?)\\b`, "i"));
  if (finite(hours)) changes.durationHours = hours;
  else if (finite(minutes)) changes.durationHours = round(minutes / 60, 3);
  else if (/(?:for|over)\s+an?\s+hour\b/.test(text)) changes.durationHours = 1;
  const cap = text.match(new RegExp(`(?:grid (?:power )?(?:limit|cap|setpoint)|curtail(?:ment)?)\\s*(?:of|to|at|=|is)?\\s*${NUMBER}\\s*(mw|kw)?`, "i"));
  if (cap) changes.gridLimitKw = Number(cap[1]) * (cap[2]?.toLowerCase() === "mw" ? 1000 : 1);
  const density = first(text, new RegExp(`air density\\s*(?:of|to|at|=|is)?\\s*${NUMBER}\\s*(?:kg\\s*\\/\\s*m(?:3|³))?`, "i"));
  if (finite(density)) changes.airDensityKgM3 = density;
  const operating = first(text, new RegExp(`(?:operating (?:fraction|time)|availability)\\s*(?:of|to|at|=|is)?\\s*${NUMBER}\\s*%`, "i"));
  if (finite(operating)) changes.operatingPct = operating;
  for (const [pattern, label] of [[/\b(blade )?pitch\b/, "blade pitch"], [/\bvibrat/, "vibration"], [/\b(temperature|bearing load|torque)\b/, "component loads or temperature"], [/\b(rotor diameter|blade length)\b/, "turbine design"], [/\b(rotor speed|rpm)\b/, "direct rotor-speed control"]]) {
    if (pattern.test(text)) unsupported.push(label);
  }
  return { baselineChanges, changes, unsupported };
}

export function validateChanges(changes) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) throw new Error("Enter valid scenario changes.");
  const clean = {};
  for (const [key, value] of Object.entries(changes)) {
    if (!FIELDS.includes(key) || !finite(value)) throw new Error(`Unsupported scenario value: ${key}.`);
    const [min, max] = BOUNDS[key];
    if (value < min || value > max) throw new Error(`${key} must be between ${min} and ${max}.`);
    clean[key] = value;
  }
  return clean;
}

function interpolate(points, windMs, field) {
  if (windMs < points[0].wind || windMs > points.at(-1).wind) return null;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    if (windMs <= b.wind) return a[field] + (b[field] - a[field]) * (windMs - a.wind) / (b.wind - a.wind);
  }
  return null;
}

function usableCurve(empirical = []) {
  const points = empirical.filter((point) => finite(point.bin_wind) && finite(point.power_avg_kw) && point.sample_count >= 30)
    .map((point) => ({ wind: point.bin_wind, power: point.power_avg_kw })).sort((a, b) => a.wind - b.wind);
  return points.length >= 6 ? points : null;
}

export function evaluateScenario({ baseline = REFERENCE, changes = {}, empirical = [], unsupported = [], liveAt = null, source = "reference" } = {}) {
  const clean = validateChanges(changes);
  const base = { ...REFERENCE, ...baseline };
  validateChanges(base);
  const scenario = { ...base, ...clean };
  const comparableBase = { ...base, durationHours: scenario.durationHours };
  const measured = usableCurve(empirical);
  const withinMeasured = measured && [comparableBase.windMs, scenario.windMs].every((wind) => wind >= measured[0].wind && wind <= measured.at(-1).wind);
  // The reference curve is an app display assumption; it must never masquerade as ACE's measured output.
  const points = withinMeasured ? measured : E115_REFERENCE_CURVE;
  const method = withinMeasured ? "ACE historical power-curve interpolation" : measured ? "Illustrative app reference curve (outside ACE measured coverage; unverified for ACE prediction)" : "Illustrative app reference curve (unverified for ACE prediction)";
  const reading = (values) => {
    const curveKw = interpolate(points, values.windMs, "power");
    const powerKw = curveKw == null ? null : round(Math.min(Math.max(0, curveKw), values.gridLimitKw), 1);
    const windPowerDensityWm2 = 0.5 * values.airDensityKgM3 * values.windMs ** 3;
    const rotorRpm = values.operatingPct === 0 ? 0 : theoreticalRotorRpm(values.windMs);
    const sweptAreaM2 = Math.PI * (ROTOR_DIAMETER_M / 2) ** 2;
    const averagePowerKw = powerKw == null ? null : round(powerKw * values.operatingPct / 100, 1);
    return { powerKw, averagePowerKw, energyKwh: averagePowerKw == null ? null : round(averagePowerKw * values.durationHours, 1), operatingHours: round(values.durationHours * values.operatingPct / 100, 2), windPowerDensityWm2: round(windPowerDensityWm2, 1), windPowerAcrossRotorKw: round(windPowerDensityWm2 * sweptAreaM2 / 1000, 1), rotorRpm: round(rotorRpm, 1), rotorTipSpeedMs: round(rotorRpm * Math.PI * ROTOR_DIAMETER_M / 60, 1) };
  };
  const baselineOutput = reading(comparableBase);
  const scenarioOutput = reading(scenario);
  return {
    modelVersion: MODEL_VERSION,
    baseline: { values: base, source, observedAt: liveAt, output: baselineOutput },
    scenario: { values: scenario, output: scenarioOutput },
    comparisonDurationHours: scenario.durationHours,
    changed: clean,
    unsupported,
    method,
    estimateQuality: withinMeasured ? "historical estimate" : "illustrative only",
    assumptions: ["Steady wind for the selected duration; no forecast of weather or turbine availability.", "Operating fraction is a user-supplied assumption. Energy equals estimated power × duration × operating fraction.", `Wind power density is ½ × air density × wind speed³. Wind power across the rotor uses the app's configured ${ROTOR_DIAMETER_M} m rotor diameter. Neither is electrical output; changing air density does not adjust the unvalidated electrical curve.`, "Rotor speed and blade tip speed are visual approximations, not simulated sensors.", ...(withinMeasured ? ["Historical bins are observational averages; actual output also depends on controls and conditions."] : ["The app reference curve has not been verified as this turbine's performance curve."])],
    sources: [
      { title: "ACE Wind Turbine Data", url: "https://doi.org/10.5281/zenodo.22662372" },
      { title: "Power curve prediction and uncertainty", url: "https://doi.org/10.5194/wes-5-199-2020" },
      { title: "US DOE: wind power and air density", url: "https://www.energy.gov/cmei/systems/windexchange/small-wind-guidebook" },
    ],
  };
}

/** Local preview stays usable even if its long-running API process predates this route. */
export function previewScenario(body = {}) {
  const held = body.baseline == null ? null : validateChanges(body.baseline);
  if (held && Object.keys(held).length !== FIELDS.length) throw new Error("The saved baseline is incomplete.");
  const parsed = body.prompt ? parseScenario(body.prompt, held ?? REFERENCE) : { baselineChanges: {}, changes: {}, unsupported: [] };
  if (body.prompt && !Object.keys(parsed.changes).length && !parsed.unsupported.length) throw new Error("Add a number, such as ‘wind speed 9 m/s for 2 hours’, or edit the supported values below.");
  return evaluateScenario({ baseline: { ...(held ?? REFERENCE), ...parsed.baselineChanges }, changes: body.changes ?? parsed.changes, unsupported: parsed.unsupported, source: parsed.baselineChanges.windMs != null ? "your stated starting value" : held ? "saved preview baseline" : "local preview example" });
}
