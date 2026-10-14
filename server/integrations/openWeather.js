// Current weather at the turbine from OpenWeather, shaped for ts.weather_observation,
// core.weather_condition and core.site_daylight. Out-of-range values become null.

import { config } from "../config/index.js";
import { SITE } from "../../shared/site.js";
import { londonDate } from "../../shared/time.js";
import { validNumber } from "./ace/telemetry.js";

const within = (v, min, max) => (validNumber(v, min, max) ? v : null);
const fromEpoch = (s) => (validNumber(s, 1) ? new Date(s * 1000) : null);

export const weatherEnabled = () => Boolean(config.weather.apiKey);

/** OpenWeather "current weather" JSON -> the three rows we store. */
export function normaliseCurrentWeather(d) {
  const condition = d.weather?.[0];
  if (!Number.isInteger(condition?.id)) throw new Error("Weather reading has no condition");
  const observedAt = fromEpoch(d.dt);
  if (!observedAt) throw new Error("Weather reading has no observation time");
  const sunriseAt = fromEpoch(d.sys?.sunrise);
  const sunsetAt = fromEpoch(d.sys?.sunset);
  return {
    condition: { conditionId: condition.id, main: String(condition.main || "Unknown"), description: String(condition.description || condition.main || "unknown") },
    observation: {
      siteId: SITE.id,
      observedAt,
      conditionId: condition.id,
      temperatureC: within(d.main?.temp, -60, 60),
      feelsLikeC: within(d.main?.feels_like, -80, 70),
      humidityPct: within(d.main?.humidity, 0, 100),
      pressureHpa: within(d.main?.pressure, 800, 1100),
      cloudCoverPct: within(d.clouds?.all, 0, 100),
      rainMmH: within(d.rain?.["1h"] ?? 0, 0, 500),
      snowMmH: within(d.snow?.["1h"] ?? 0, 0, 500),
      visibilityM: within(d.visibility, 0, 100_000),
      windSpeedMs: within(d.wind?.speed, 0, 100),
      windDirectionDeg: within(d.wind?.deg, 0, 360),
      windGustMs: within(d.wind?.gust, 0, 150),
    },
    daylight: sunriseAt && sunsetAt && sunsetAt > sunriseAt
      ? { siteId: SITE.id, localDate: londonDate(sunriseAt), sunriseAt, sunsetAt }
      : null,
  };
}

export async function fetchCurrentWeather() {
  const url = new URL(`${config.weather.baseUrl}/data/2.5/weather`);
  url.search = new URLSearchParams({ lat: SITE.lat, lon: SITE.lon, units: "metric", appid: config.weather.apiKey }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`OpenWeather responded ${res.status}`);
  return normaliseCurrentWeather(await res.json());
}
