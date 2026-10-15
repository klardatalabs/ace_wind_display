// Everything a hoarding screen talks about, derived from the live socket plus history
// endpoints (daily rollups, power curve) that refresh in the background.

import { useEffect, useMemo, useRef, useState } from "react";
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
import {londonDate} from '@shared/time.js';

const REFRESH_MS = 10 * 60 * 1000;
// The live feed changes every second. On a hoarding that reads as flicker: numbers jumping
// mid-sentence, bars twitching, Ace's face flipping. So the screens show figures that drift
// toward the feed over about this long, and a new mood only once it has held this long.
const STEADY_SECONDS = 20;
const MOOD_HOLD_MS = 20_000;

/** Power, wind, rotor speed and mood, steadied for display (see STEADY_SECONDS). */
function useSteadyLive(state) {
  const steady = useRef(null);
  return useMemo(() => {
    const now = state?.now ?? {};
    const raw = { powerKw: Math.max(0, now.activePowerKw ?? 0), windSpeed: now.windSpeed ?? 0, rotorRpm: now.rotorRpm ?? 0 };
    const mood = classifyMood(state);
    if (!state) return { ...raw, mood };
    const t = performance.now();
    const s = steady.current;
    // The first reading is shown as it is; after that, figures ease and moods wait.
    if (!s) return (steady.current = { ...raw, mood, pendingMood: mood, pendingSince: t, at: t });
    const k = 1 - Math.exp(-(t - s.at) / 1000 / STEADY_SECONDS);
    for (const key of Object.keys(raw)) s[key] += (raw[key] - s[key]) * k;
    s.at = t;
    if (mood !== s.pendingMood) Object.assign(s, { pendingMood: mood, pendingSince: t });
    if (mood !== s.mood && t - s.pendingSince >= MOOD_HOLD_MS) s.mood = mood;
    return { ...s };
  }, [state]);
}

/** Daily rollups + power curve, refreshed every 10 minutes. Failures leave the defaults. */
function useHistory() {
  const [history, setHistory] = useState({ daily: [], curve: { empirical: [], theoretical: E115_REFERENCE_CURVE },stale:false,curveStale:false });
  useEffect(() => {
    let alive = true;
    const load = () => {
      api.daily(14).then((daily) => alive && Array.isArray(daily) && setHistory((h) => ({ ...h, daily,stale:daily.some(d=>d.history_stale) }))).catch(() => alive && setHistory(h=>({...h,stale:true})));
      api.powerCurve().then((curve) => alive && curve?.theoretical && setHistory((h) => ({ ...h, curve,curveStale:false }))).catch(() => alive && setHistory(h=>({...h,curveStale:true})));
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
  const live = useSteadyLive(state);

  return useMemo(() => {
    const now = state?.now ?? {};
    const { powerKw, windSpeed, rotorRpm } = live;
    const todayKwh = state?.today?.energyKwh ?? 0;
    const lifetimeKwh = now.lifetimeEnergyKwh ?? 0;
    const tipMs = tipSpeedMs(rotorRpm);
    const co2Kg = co2AvoidedKg(todayKwh);
    const todayDate=new Date(`${londonDate()}T12:00:00Z`);
    const monday=new Date(todayDate.getTime()-((todayDate.getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);
    const weekDays=history.daily.some(d=>d.energy_method) ? history.daily.filter(d=>d.date_london>=monday) : history.daily.slice(0,7);
    const weekKwh = weekDays.reduce((sum,d)=>sum+(d.energy_kwh || 0),0);
    return {
      ready: Boolean(state),
      mode: state?.mode ?? "live",
      connected: state?.connected ?? false,
      mood: live.mood,
      statusStale:state?.mode!=='simulate' && Boolean(state?.freshness?.status?.failures),
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
      todayEstimated:state?.mode!=='simulate' && Boolean(state?.today?.energyMethod),
      todayStale:state?.mode!=='simulate' && Boolean(state?.today?.stale || state?.freshness?.today?.failures),
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
      historyStale:history.stale,
      curveStale:history.curveStale,
      curve: history.curve,
    };
  }, [state, live, history]);
}
