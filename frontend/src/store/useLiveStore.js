// Live turbine state shared by every page. Fed by realtime/liveSocket.js.

import { create } from "zustand";

export const useLiveStore = create((set) => ({
  state: null, // latest server snapshot (see server/services/turbineState.js)
  socketStatus: "connecting", // connecting | open | closed
  setState: (state) => set({ state }),
  setSocketStatus: (socketStatus) => set({ socketStatus }),
}));

/** Convenience selector with safe defaults so components never deal with nulls. */
export function useLive() {
  const s = useLiveStore((st) => st.state);
  const now = s?.now ?? {};
  return {
    ready: Boolean(s),
    mode: s?.mode ?? "live",
    connected: s?.connected ?? false,
    liveAt: s?.liveAt ?? null, // null = never connected: the numbers are sample values
    // A genuine turbine reading: not admin demo values and not pre-connection defaults.
    real: Boolean(s) && s.mode !== "simulate" && Boolean(s.liveAt),
    powerKw: Math.max(0, now.activePowerKw ?? 0),
    windSpeed: now.windSpeed ?? 0,
    rotorRpm: now.rotorRpm ?? 0,
    windDir: now.aggregateWindDir ?? 0,
    nacelleDeg: now.nacelleDeg ?? 0,
    lifetimeKwh: now.lifetimeEnergyKwh ?? 0,
    todayKwh: s?.today?.energyKwh ?? 0,
    todayEstimated: s?.mode!=='simulate' && Boolean(s?.today?.energyMethod),
    todayStale: s?.mode!=='simulate' && Boolean(s?.today?.stale || s?.freshness?.today?.failures),
    status: s?.statusEvent ?? {},
    updatedAt: s?.updatedAt,
  };
}
