// Scripted weather for the admin simulator. Each scenario is a list of keyframes
// { t: seconds, wind: m/s, deg?: nacelle bearing, status?: flags } that the player
// interpolates and pushes to every screen once a second.

export const SCENARIOS = [
  {
    id: "morning",
    name: "Morning wind-up",
    about: "Dead calm at dawn, then the breeze builds until the turbine reaches full power.",
    frames: [
      { t: 0, wind: 0.8, deg: 200 },
      { t: 10, wind: 2.2, deg: 205 },
      { t: 20, wind: 4.5, deg: 210 },
      { t: 35, wind: 8.5, deg: 215 },
      { t: 50, wind: 13.5, deg: 220 },
      { t: 60, wind: 14, deg: 222 },
    ],
  },
  {
    id: "gusty",
    name: "Gusty afternoon",
    about: "Squally south-westerly: wind swings between 6 and 15 m/s and the nacelle hunts the gusts.",
    frames: [
      { t: 0, wind: 8, deg: 225 },
      { t: 6, wind: 14, deg: 232 },
      { t: 12, wind: 7, deg: 218 },
      { t: 18, wind: 15, deg: 240 },
      { t: 24, wind: 9, deg: 228 },
      { t: 30, wind: 12, deg: 236 },
      { t: 36, wind: 6, deg: 220 },
      { t: 45, wind: 11, deg: 230 },
    ],
  },
  {
    id: "storm",
    name: "Storm front",
    about: "A gale arrives off the estuary: full power, storm control above 28 m/s, then recovery.",
    frames: [
      { t: 0, wind: 10, deg: 240 },
      { t: 12, wind: 18, deg: 255 },
      { t: 22, wind: 26, deg: 265 },
      { t: 30, wind: 31, deg: 270 },
      { t: 38, wind: 35, deg: 272, status: { warning_message_flag: 1 } },
      { t: 48, wind: 24, deg: 262, status: { warning_message_flag: 0 } },
      { t: 60, wind: 13, deg: 250 },
    ],
  },
  {
    id: "veer",
    name: "Wind veers north",
    about: "A steady 10 m/s while the wind swings round from south-west to north — watch the yaw drives work.",
    frames: [
      { t: 0, wind: 10, deg: 215 },
      { t: 15, wind: 10.5, deg: 270 },
      { t: 30, wind: 9.5, deg: 320 },
      { t: 45, wind: 10, deg: 360 },
    ],
  },
  {
    id: "evening",
    name: "Evening lull",
    about: "The wind dies away after sunset until the blades come to rest.",
    frames: [
      { t: 0, wind: 7, deg: 210 },
      { t: 15, wind: 4.5, deg: 205 },
      { t: 30, wind: 2.6, deg: 200 },
      { t: 40, wind: 1.4, deg: 198 },
    ],
  },
];

/** Interpolated { wind, deg, status } at time t (seconds) in a scenario. */
export function sampleScenario(scenario, t) {
  const f = scenario.frames;
  const status = {};
  for (const frame of f) if (frame.t <= t && frame.status) Object.assign(status, frame.status);
  if (t <= f[0].t) return { wind: f[0].wind, deg: f[0].deg ?? 215, status };
  for (let i = 1; i < f.length; i++) {
    if (t <= f[i].t) {
      const a = f[i - 1];
      const b = f[i];
      const k = (t - a.t) / (b.t - a.t);
      const ease = k * k * (3 - 2 * k);
      return { wind: a.wind + (b.wind - a.wind) * ease, deg: (a.deg ?? 215) + ((b.deg ?? 215) - (a.deg ?? 215)) * ease, status };
    }
  }
  const last = f[f.length - 1];
  return { wind: last.wind, deg: last.deg ?? 215, status };
}

export const scenarioLength = (s) => s.frames[s.frames.length - 1].t;
