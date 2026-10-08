// The "real place" around the turbine: current weather at the site (OpenWeather) plus an
// optional admin override for demos (jump to dusk, make it rain). Screens read this to draw
// the sky, clouds, rain and fog; they compute the sun's position themselves from the clock.

import { config } from "../config/env.js";

const listeners = new Set();

let weather = null; // normalised OpenWeather "current" reading, or null
let weatherError = null;
let override = { hour: null, cloud: null, rain: null, fog: null }; // null = follow the real world
let timer = null;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** OpenWeather /data/2.5/weather -> the small shape the frontend uses. */
export function normaliseOpenWeather(d) {
  const w = d.weather?.[0] ?? {};
  const iso = (sec) => (num(sec) ? new Date(sec * 1000).toISOString() : null);
  return {
    source: "openweather",
    fetchedAt: new Date().toISOString(),
    observedAt: iso(d.dt),
    place: d.name || null,
    tempC: num(d.main?.temp),
    feelsLikeC: num(d.main?.feels_like),
    humidity: num(d.main?.humidity),
    pressureHpa: num(d.main?.pressure),
    cloudCover: clamp((num(d.clouds?.all) ?? 0) / 100, 0, 1),
    rainMmH: num(d.rain?.["1h"]) ?? 0,
    snowMmH: num(d.snow?.["1h"]) ?? 0,
    visibilityM: num(d.visibility),
    windMs: num(d.wind?.speed),
    windDeg: num(d.wind?.deg),
    windGustMs: num(d.wind?.gust),
    condition: w.main || null, // Clear, Clouds, Rain, Drizzle, Thunderstorm, Snow, Mist, Fog…
    description: w.description || null,
    icon: w.icon || null,
    sunrise: iso(d.sys?.sunrise),
    sunset: iso(d.sys?.sunset),
  };
}

export async function refreshWeather() {
  if (!config.weather.apiKey) {
    weatherError = "no OPENWEATHER_API_KEY set";
    return null;
  }
  try {
    const url = `${config.weather.baseUrl}/data/2.5/weather?lat=${config.site.lat}&lon=${config.site.lon}&units=metric&appid=${encodeURIComponent(config.weather.apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`OpenWeather responded ${res.status}`);
    weather = normaliseOpenWeather(await res.json());
    weatherError = null;
    publish();
  } catch (err) {
    // Keep serving the last good reading; the screens fall back to a calm estimate without one.
    weatherError = err.message;
    console.warn("[weather] refresh failed:", err.message);
  }
  return weather;
}

export function startWeatherPolling() {
  if (timer) return;
  refreshWeather();
  timer = setInterval(refreshWeather, config.weather.refreshMs);
  timer.unref?.();
}

export const getWeather = () => weather;

export function getEnvironment() {
  return {
    weather,
    weatherError: weather ? null : weatherError,
    override,
    site: { lat: config.site.lat, lon: config.site.lon },
    serverTime: new Date().toISOString(),
  };
}

/** Admin override. Pass nulls to follow the real world again. Values are clamped. */
export function setOverride(patch = {}) {
  const next = { ...override };
  if ("hour" in patch) next.hour = patch.hour == null ? null : clamp(Number(patch.hour) || 0, 0, 24);
  for (const key of ["cloud", "rain", "fog"]) {
    if (key in patch) next[key] = patch[key] == null ? null : clamp(Number(patch[key]) || 0, 0, 1);
  }
  override = next;
  publish();
  return getEnvironment();
}

export function clearOverride() {
  return setOverride({ hour: null, cloud: null, rain: null, fog: null });
}

export const onEnvironmentChange = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

function publish() {
  const snapshot = getEnvironment();
  for (const fn of listeners) fn(snapshot);
}
