// Turning the server's weather report into what the picture should look like. Only genuine
// readings count: while an admin demo override is active there is no "real" weather.

const RAINY = new Set(["Rain", "Drizzle", "Thunderstorm"]);
const MISTY = new Set(["Mist", "Fog", "Haze", "Smoke"]);

/** True when an admin has forced any part of the sky, so it no longer shows the real world. */
export function isOverridden(environment) {
  const o = environment?.override;
  return Boolean(o) && Object.values(o).some((v) => v != null);
}

/** The genuine weather reading, or null. */
export function realWeather(environment) {
  const weather = environment?.weather;
  return weather && !isOverridden(environment) && Number.isFinite(Date.parse(weather.observedAt)) &&
    Date.now() - Date.parse(weather.observedAt) <= 45 * 60_000 ? weather : null;
}

/** What the weather means for the picture: 0..1 cloud, rain and fog. Zero without a reading. */
export function weatherLook(weather) {
  if (!weather) return { cloud: 0, rain: 0, fog: 0, raining: false };
  const raining = RAINY.has(weather.condition) || weather.rainMmH > 0.05;
  const rain = raining ? Math.min(1, Math.max(weather.rainMmH / 3, 0.25)) : 0;
  const visibilityFog = weather.visibilityM ? Math.min(1, Math.max(0, 1 - weather.visibilityM / 9000)) * 0.8 : 0;
  const fog = Math.max(MISTY.has(weather.condition) ? 0.55 : 0, visibilityFog);
  return { cloud: weather.cloudCover ?? 0, rain, fog, raining };
}
