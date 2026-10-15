// "A day here": the time-lapse runs from 05:00 to 22:00 in about twenty seconds, and the
// story steps through six moments of a Lawrence Weston day. Each moment says, in the
// screen's own voice, what the place is doing, and then what the turbine was really doing
// at that hour: the 10-minute reading nearest to it in the last 24 hours (today if the hour
// has passed, otherwise yesterday).

import { londonHourToDate } from "@shared/time.js";
import { homesPoweredNow, msToMph } from "@shared/impact.js";
import { formatInt, formatPower } from "../lib/format.js";

/** The time-lapse: from and to (London hours) over this many seconds. Matches CHAPTERS.day. */
export const DAY_LAPSE = { from: 5, to: 22, seconds: 21 };

const MOMENTS = [5, 8, 12, 15, 18, 21];

const VOICES = {
  students: [
    { eyebrow: "Sunrise", line: "The birds wake up. I've been busy all night." },
    { eyebrow: "School run", line: "Toast, kettles, coats on, off to school!" },
    { eyebrow: "Lunchtime", line: "Lunchboxes open. I'm still spinning." },
    { eyebrow: "Home time", line: "The bell rings. Snacks and screens time!" },
    { eyebrow: "Teatime", line: "Ovens on all over Lawrence Weston." },
    { eyebrow: "Bedtime", line: "Lights out soon. I'll keep going all night." },
  ],
  community: [
    { eyebrow: "First light", line: "The estate is quiet. The turbine isn't." },
    { eyebrow: "Morning rush", line: "Kettles on, the school run, buses into town." },
    { eyebrow: "Midday", line: "Shops open, washing on, the day in full swing." },
    { eyebrow: "Afternoon", line: "Kids home from school, the park filling up." },
    { eyebrow: "Teatime", line: "Every oven on. The busiest hour for power." },
    { eyebrow: "Evening", line: "Lights on along every street." },
  ],
  college: [
    { eyebrow: "Before dawn", line: "National demand is near its daily low. The rotor doesn't care." },
    { eyebrow: "Morning ramp", line: "Demand climbs steeply as the country wakes up." },
    { eyebrow: "Midday", line: "On a sunny day, solar peaks and shares the load with wind." },
    { eyebrow: "Afternoon", line: "Solar fades; the grid leans harder on wind and gas." },
    { eyebrow: "Evening peak", line: "The day's highest demand, as lights and ovens come on." },
    { eyebrow: "Late evening", line: "Demand eases. A turbine works whenever the wind does." },
  ],
};

const clock = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.floor((h % 1) * 60)).padStart(2, "0")}`;

/** The London hour the time-lapse is showing, `elapsedS` seconds into the chapter. */
export function lapseHour(elapsedS) {
  const k = Math.min(1, Math.max(0, elapsedS / DAY_LAPSE.seconds));
  return DAY_LAPSE.from + (DAY_LAPSE.to - DAY_LAPSE.from) * k;
}

/** The reading nearest to `hour` (London) in the last 24 h of history, or null. */
function readingAt(history, hour, now) {
  if (!history?.timestamps?.length) return null;
  let target = londonHourToDate(hour, now);
  let yesterday = false;
  if (target > now) {
    target = new Date(target.getTime() - 24 * 3_600_000);
    yesterday = true;
  }
  let best = -1;
  let gap = Infinity;
  history.timestamps.forEach((us, i) => {
    const d = Math.abs(us / 1000 - target.getTime());
    if (d < gap) {
      gap = d;
      best = i;
    }
  });
  if (best < 0 || gap > 20 * 60_000) return null;
  return { yesterday, windMs: history.wind[best], powerKw: history.power[best] };
}

function factFor(reading, hour, audience) {
  const when = `${reading.yesterday ? "Yesterday" : "Today"} at ${clock(hour)}`;
  const wind = `${Math.round(msToMph(reading.windMs ?? 0))} mph wind`;
  if (!(reading.powerKw > 0)) return `${when}: ${wind}, too calm to generate.`;
  const power = formatPower(reading.powerKw);
  if (audience === "college") return `${when}: ${(reading.windMs ?? 0).toFixed(1)} m/s, ${power.value} ${power.unit} (${Math.round((reading.powerKw / 4200) * 100)}% of rated).`;
  return `${when}: ${wind}, making ${power.value} ${power.unit}, enough for ${formatInt(homesPoweredNow(reading.powerKw))} homes.`;
}

/**
 * The moment to show at `hour`: { key, clock, eyebrow, line, sub }. `sub` is the real
 * reading for that hour, or a plain line when the history doesn't have it.
 */
export function dayMoment(audience, hour, history, now = new Date()) {
  const voice = VOICES[audience] ?? VOICES.community;
  let i = 0;
  while (i + 1 < MOMENTS.length && MOMENTS[i + 1] <= hour) i++;
  const reading = readingAt(history, MOMENTS[i], now);
  return {
    key: `${audience}-${MOMENTS[i]}`,
    clock: clock(hour),
    eyebrow: `${clock(MOMENTS[i])} · ${voice[i].eyebrow}`,
    line: voice[i].line,
    sub: reading ? factFor(reading, MOMENTS[i], audience) : "Watch the real sun cross the sky over Bristol.",
  };
}
