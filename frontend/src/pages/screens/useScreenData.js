// Everything a hoarding screen talks about, derived from the live socket plus history
// endpoints (daily rollups, power curve) that refresh in the background.

import { useEffect, useMemo, useState } from "react";
import { useLiveStore } from "../../store/useLiveStore.js";
import { api } from "../../lib/api.js";
import { classifyMood } from "../../lib/mood.js";
import { formatPower, formatEnergy } from "../../lib/format.js";
import {
  homesPoweredNow,
  co2AvoidedKg,
  treesEquivalent,
  communityFundGbp,
  tipSpeedMs,
  msToMph,
  beaufortLabel,
  capacityFactorPct,
} from "@shared/impact.js";
import { COMMISSION_DATE_ISO, RATED_POWER_KW, ROTOR_DIAMETER_M } from "@shared/constants.js";
import { theoreticalPowerKw, E115_REFERENCE_CURVE } from "@shared/physics.js";
import { cupsOfTea, phoneCharges } from "../../lib/impact.js";

const REFRESH_MS = 10 * 60 * 1000;

/** Daily rollups + power curve, refreshed every 10 minutes. Failures leave the defaults. */
function useHistory() {
  const [history, setHistory] = useState({ daily: [], curve: { empirical: [], theoretical: E115_REFERENCE_CURVE } });
  useEffect(() => {
    let alive = true;
    const load = () => {
      api.daily(14).then((daily) => alive && Array.isArray(daily) && setHistory((h) => ({ ...h, daily }))).catch(() => {});
      api.powerCurve().then((curve) => alive && curve?.theoretical && setHistory((h) => ({ ...h, curve }))).catch(() => {});
    };
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return history;
}

export function useScreenData() {
  const state = useLiveStore((s) => s.state);
  const history = useHistory();

  return useMemo(() => {
    const now = state?.now ?? {};
    const powerKw = Math.max(0, now.activePowerKw ?? 0);
    const windSpeed = now.windSpeed ?? 0;
    const rotorRpm = now.rotorRpm ?? 0;
    const todayKwh = state?.today?.energyKwh ?? 0;
    const lifetimeKwh = now.lifetimeEnergyKwh ?? 0;
    const tipMs = tipSpeedMs(rotorRpm);
    const co2Kg = co2AvoidedKg(todayKwh);
    const weekKwh = history.daily.slice(0, 7).reduce((sum, d) => sum + (d.energy_kwh || 0), 0);
    return {
      ready: Boolean(state),
      mode: state?.mode ?? "live",
      connected: state?.connected ?? false,
      mood: classifyMood(state),
      powerKw,
      power: formatPower(powerKw),
      windSpeed,
      windDir: now.aggregateWindDir ?? now.nacelleDeg ?? 0,
      nacelleDeg: now.nacelleDeg ?? 0,
      beaufort: beaufortLabel(windSpeed),
      rotorRpm,
      tipMs,
      tipMph: msToMph(tipMs),
      tsr: windSpeed > 0.5 ? (rotorRpm * 2 * Math.PI * (ROTOR_DIAMETER_M / 2)) / 60 / windSpeed : 0,
      homes: homesPoweredNow(powerKw),
      todayKwh,
      today: formatEnergy(todayKwh),
      co2Kg,
      trees: treesEquivalent(co2Kg),
      cupsOfTea: cupsOfTea(todayKwh),
      phoneCharges: phoneCharges(todayKwh),
      fundGbp: communityFundGbp(todayKwh),
      lifetimeKwh,
      lifetime: formatEnergy(lifetimeKwh),
      capacityFactor: lifetimeKwh > 0 ? capacityFactorPct(lifetimeKwh, new Date(COMMISSION_DATE_ISO)) : 0,
      theoreticalKw: theoreticalPowerKw(windSpeed),
      utilisation: (powerKw / RATED_POWER_KW) * 100,
      weekKwh,
      daily: history.daily,
      curve: history.curve,
    };
  }, [state, history]);
}
