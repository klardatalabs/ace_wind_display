// The real conditions over the turbine right now: UK time, weather, temperature and wind.
// This is the same weather the 3D sky is showing.

import { useEffect, useState } from "react";
import { useEnvironmentStore } from "../../../store/useEnvironmentStore.js";
import { compassPoint } from "../../../lib/format.js";
import Icon from "../../../components/ui/Icon.jsx";
import { realWeather } from "../../../lib/weather.js";

const mph = (ms) => ms * 2.23694;

export default function WeatherChip({ windSpeed, windDir, skin, live = false }) {
  const environment = useEnvironmentStore((s) => s.environment);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  const weather = realWeather(environment);
  const night = weather?.sunrise && weather?.sunset ? now < new Date(weather.sunrise) || now > new Date(weather.sunset) : false;
  return (
    <div className={`flex items-center gap-[1.4vmin] rounded-full px-[2vmin] py-[0.9vmin] ${skin.card}`}>
      <Icon name={night ? "moon" : "sun"} className={`size-[2.6vmin] ${skin.accent}`} />
      <span className={`font-mono text-[clamp(13px,1.9vmin,38px)] tabular-nums ${skin.text}`}>{time}</span>
      {weather?.tempC != null && (
        <span className={`text-[clamp(12px,1.7vmin,34px)] ${skin.muted}`}>
          {Math.round(weather.tempC)}°C{weather.description ? ` · ${weather.description}` : ""}
        </span>
      )}
      <span className={`flex items-center gap-[0.6vmin] text-[clamp(12px,1.7vmin,34px)] ${skin.muted}`}>
        <Icon name="wind" className="size-[1.1em]" />
        {live ? `${Math.round(mph(windSpeed))} mph ${compassPoint(windDir)}` : "Turbine wind unavailable"}
      </span>
    </div>
  );
}
