// Weather at the turbine: fetched every 10 minutes, stored, and shared with every api
// instance as the "environment" snapshot (Redis key + channel). A reading older than
// WEATHER_STALE_MINUTES is flagged stale so screens never show it as current.

import { fetchCurrentWeather } from "../../integrations/openWeather.js";
import { saveReading, latestReading } from "../../db/repositories/weather.js";
import { redis } from "../../infra/redis.js";
import { publish, CHANNELS } from "../../infra/pubsub.js";
import { SITE } from "../../../shared/site.js";
import { toEnvironment, ENVIRONMENT_KEY } from "../../live/shapes.js";

async function share(environment) {
  await Promise.all([
    redis.set(ENVIRONMENT_KEY, JSON.stringify(environment), "EX", 6 * 3600).catch(() => {}),
    publish(CHANNELS.environment, environment),
  ]);
}

export async function refreshWeather() {
  const reading = await fetchCurrentWeather();
  await saveReading(reading);
  await share(toEnvironment({
    observation: reading.observation,
    main: reading.condition.main,
    description: reading.condition.description,
    sunriseAt: reading.daylight?.sunriseAt,
    sunsetAt: reading.daylight?.sunsetAt,
    fetchedAt: new Date(),
  }));
}

/** On start, share the last stored reading (flagged stale if old) until a fresh one arrives. */
export async function restoreWeather() {
  const stored = await latestReading(SITE.id).catch(() => null);
  if (stored) await share(toEnvironment(stored));
}
