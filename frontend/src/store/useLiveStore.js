// Live turbine state shared by every page. Fed by realtime/liveSocket.js.

import { create } from "zustand";
import { useEffect, useState } from "react";

export const useLiveStore = create((set) => ({
  state: null, // latest server snapshot (see server/services/turbineState.js)
  socketStatus: "connecting", // connecting | open | closed
  setState: (state) => set({ state }),
  setSocketStatus: (socketStatus) => set({ socketStatus }),
}));

/** Convenience selector with safe defaults so components never deal with nulls. */
export function useLive() {
  const s = useLiveStore((st) => st.state);
  const [clock, setClock] = useState(Date.now);
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 10_000); return () => clearInterval(id); }, []);
  const now = s?.now ?? {};
  const fresh = Boolean(s?.connected && s?.receivedAt && clock - Date.parse(s.receivedAt) <= 30_000);
  return {
    ready: Boolean(s),
    mode: s?.mode ?? "live",
    connected: fresh,
    liveAt: s?.liveAt ?? null, // null = never connected: the numbers are sample values
    receivedAt: s?.receivedAt ?? null,
    // A genuine turbine reading: not admin demo values and not pre-connection defaults.
    real: Boolean(s) && s.mode !== "simulate" && fresh,
    powerKw: Math.max(0, now.activePowerKw ?? 0),
    windSpeed: now.windSpeed ?? 0,
    rotorRpm: now.rotorRpm ?? 0,
    windDir: now.aggregateWindDir ?? 0,
    nacelleDeg: now.nacelleDeg ?? 0,
    lifetimeKwh: now.lifetimeEnergyKwh ?? 0,
    todayKwh: s?.today?.energyKwh ?? 0,
    todayEstimated: s?.mode!=='simulate' && Boolean(s?.today?.energyMethod) && !s.today.energyMethod.startsWith("energy meter"),
    todayStale: s?.mode!=='simulate' && Boolean(s?.today?.stale || s?.freshness?.today?.failures),
    status: s?.statusEvent ?? {},
    updatedAt: s?.updatedAt,
  };
}
