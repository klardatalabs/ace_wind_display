// One line of real conditions at the turbine: time, sun or moon, temperature, weather and
// the turbine's own wind. Parts without a genuine reading are left out.

import Icon from "../ui/Icon.jsx";
import { compassPoint } from "../../lib/format.js";
import { msToMph } from "../../lib/impact.js";

const sentence = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export default function ConditionsLine({ conditions, className = "" }) {
  const { time, night, weather, wind } = conditions;
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <span className="flex items-center gap-1.5">
        <Icon name={night ? "moon" : "sun"} className="size-[1.15em]" />
        <span className="font-mono tabular-nums">{time}</span>
      </span>
      {weather?.tempC != null && (
        <span>
          {Math.round(weather.tempC)}°C{weather.description ? ` · ${sentence(weather.description)}` : ""}
        </span>
      )}
      {wind && (
        <span className="flex items-center gap-1.5">
          <Icon name="wind" className="size-[1.15em]" />
          {Math.round(msToMph(wind.ms))} mph {compassPoint(wind.deg)}
        </span>
      )}
    </div>
  );
}
