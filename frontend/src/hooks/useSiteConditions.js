// Real conditions at the turbine right now: UK time, where the sun is, today's sunrise and
// sunset, the OpenWeather reading and the turbine's own wind. Anything that isn't a genuine
// reading comes back null: no weather while an admin demo override is active, no wind
// without a real turbine reading. The clock and the sun are always real.

import { useEffect, useState } from "react";
import { useEnvironmentStore } from "../store/useEnvironmentStore.js";
import { useLive } from "../store/useLiveStore.js";
import { sunPosition } from "../lib/sun.js";
import { realWeather, weatherLook } from "../lib/weather.js";

const DAY_MS = 86_400_000;
// The sun's upper edge touches the horizon at -0.833° once refraction is allowed for.
const HORIZON_DEG = -0.833;

const toDate = (iso) => (iso ? new Date(iso) : null);

/** "07:24" in UK time. */
export const ukTime = (date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export function useSiteConditions(tickMs = 15_000) {
  const environment = useEnvironmentStore((s) => s.environment);
  const live = useLive();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  const weather = realWeather(environment);
  const elevationDeg = (sunPosition(now).elevation * 180) / Math.PI;
  const night = elevationDeg < HORIZON_DEG;

  // OpenWeather reports today's sunrise and sunset. Before sunrise, the next one is today's;
  // after it, tomorrow's, which is close enough to today's plus a day.
  const sunrise = toDate(weather?.sunrise);
  const sunset = toDate(weather?.sunset);
  const nextSunrise = sunrise && (now < sunrise ? sunrise : new Date(sunrise.getTime() + DAY_MS));
  const dayProgress = sunrise && sunset && now >= sunrise && now <= sunset ? (now - sunrise) / (sunset - sunrise) : null;

  return {
    now,
    time: ukTime(now),
    elevationDeg,
    night,
    weather,
    look: weatherLook(weather),
    sunrise,
    sunset,
    nextSunrise,
    dayProgress,
    wind: live.real ? { ms: live.windSpeed, deg: live.windDir } : null,
  };
}
