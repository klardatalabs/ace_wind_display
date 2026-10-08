// Single source of truth for turbine state, shared by every connected display.
// Either polls the real ACE API ("live" mode) or holds whatever the admin
// portal last set ("simulate" mode) - display pages don't know which.

import { getSiteLatest, getWecLatest, getStatusLatest, getWecStdRange } from "../clients/aceClient.js";
import { londonDayStart } from "../../shared/time.js";
import { POLL_NOW_MS, POLL_TODAY_MS, POLL_STATUS_MS, OFFLINE_AFTER_FAILURES } from "../../shared/constants.js";

const listeners = new Set();

const state = {
  mode: "live", // "live" | "simulate"
  connected: false, // whether live polling is currently succeeding (irrelevant in simulate mode)
  liveAt: null, // ISO time of the last successful poll; null = never connected, `now` below is sample data
  now: {
    activePowerKw: 185.0,
    windSpeed: 4.8,
    aggregateWindDir: 210,
    nacelleDeg: 215,
    rotorRpm: 6.2,
    lifetimeEnergyKwh: 34500000,
    operatingHours: 19500,
    availablePowerAfterSetpoints: 4200,
    theoreticalMaxPower: 4245,
  },
  today: { energyKwh: 12400, avgWindSpeed: 5.4 },
  statusEvent: { main_status: 0, substatus: 0, fault_message_flag: 0, warning_message_flag: 0, service_flag: 0 },
  updatedAt: new Date().toISOString(),
};

let consecutiveFailures = 0;

function publish() {
  state.updatedAt = new Date().toISOString();
  const snapshot = JSON.parse(JSON.stringify(state));
  for (const fn of listeners) {
    try {
      fn(snapshot);
    } catch (err) {
      console.error("state listener failed:", err);
    }
  }
}

export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return JSON.parse(JSON.stringify(state));
}

function last(series) {
  return Array.isArray(series) && series.length ? series[series.length - 1] : undefined;
}

async function pollNowOnce() {
  if (state.mode !== "live") return;
  try {
    const [site, wec] = await Promise.all([
      getSiteLatest(
        [
          "aggregate_active_power",
          "aggregate_wind_speed",
          "aggregate_wind_direction",
          "aggregate_available_power_after_external_setpoints",
          "aggregate_theoretical_maximum_active_power",
        ],
        { resolution: "1s", limit: 1 }
      ),
      getWecLatest(
        [
          "wec_active_power",
          "wec_rotor_speed",
          "wec_wind_speed",
          "wec_nacelle_position",
          "wec_energy_exported",
          "wec_operating_hours",
        ],
        { resolution: "1s", limit: 1 }
      ),
    ]);

    state.now = {
      activePowerKw: last(wec.series?.wec_active_power),
      windSpeed: last(wec.series?.wec_wind_speed),
      aggregateWindDir: last(site.series?.aggregate_wind_direction),
      nacelleDeg: last(wec.series?.wec_nacelle_position),
      rotorRpm: last(wec.series?.wec_rotor_speed),
      lifetimeEnergyKwh: last(wec.series?.wec_energy_exported),
      operatingHours: last(wec.series?.wec_operating_hours),
      availablePowerAfterSetpoints: last(site.series?.aggregate_available_power_after_external_setpoints),
      theoreticalMaxPower: last(site.series?.aggregate_theoretical_maximum_active_power),
    };
    onFetchSuccess();
  } catch (err) {
    onFetchFailure(err, "now");
  }
  publish();
}

async function pollTodayOnce() {
  if (state.mode !== "live") return;
  try {
    const now = new Date();
    const midnight = londonDayStart(now);
    const data = await getWecStdRange(["energy_produced", "wind_speed_mean"], {
      resolution: "10m",
      start: midnight.toISOString(),
      end: now.toISOString(),
      pageSize: 200,
    });
    const energySeries = data.series?.energy_produced ?? [];
    const windSeries = data.series?.wind_speed_mean ?? [];
    const startEnergy = energySeries[0];
    const latestEnergy = energySeries[energySeries.length - 1];
    state.today = {
      energyKwh:
        typeof startEnergy === "number" && typeof latestEnergy === "number"
          ? Math.max(0, latestEnergy - startEnergy)
          : undefined,
      avgWindSpeed: windSeries.length ? windSeries.reduce((a, b) => a + b, 0) / windSeries.length : undefined,
    };
    onFetchSuccess();
  } catch (err) {
    onFetchFailure(err, "today");
  }
  publish();
}

async function pollStatusOnce() {
  if (state.mode !== "live") return;
  try {
    const data = await getStatusLatest({ limit: 1 });
    state.statusEvent = data.events?.[0]?.values ?? null;
    onFetchSuccess();
  } catch (err) {
    onFetchFailure(err, "status");
  }
  publish();
}

function onFetchSuccess() {
  consecutiveFailures = 0;
  state.connected = true;
  state.liveAt = new Date().toISOString();
}

function onFetchFailure(err, which) {
  consecutiveFailures += 1;
  const msg = err?.message ?? (typeof err === "string" ? err : "Unknown error");
  console.warn(`ACE API poll (${which}) failed:`, msg);
  if (consecutiveFailures >= OFFLINE_AFTER_FAILURES) {
    state.connected = false;
  }
}

export function startPolling() {
  async function loopNow() {
    if (state.mode === "live") {
      try {
        await pollNowOnce();
      } catch (e) {
        console.error("Uncaught in pollNowOnce:", e);
      }
    }
    setTimeout(loopNow, 2000);
  }

  async function loopToday() {
    if (state.mode === "live") {
      try {
        await pollTodayOnce();
      } catch (e) {
        console.error("Uncaught in pollTodayOnce:", e);
      }
    }
    setTimeout(loopToday, POLL_TODAY_MS);
  }

  async function loopStatus() {
    if (state.mode === "live") {
      try {
        await pollStatusOnce();
      } catch (e) {
        console.error("Uncaught in pollStatusOnce:", e);
      }
    }
    setTimeout(loopStatus, POLL_STATUS_MS);
  }

  loopNow();
  loopToday();
  loopStatus();
}

// --- Admin / simulate mode -------------------------------------------------

export function setSimulatedState(values) {
  state.mode = "simulate";
  state.connected = true; // simulate mode is always "connected" by definition
  if (values.now) state.now = { ...state.now, ...values.now };
  if (values.today) state.today = { ...state.today, ...values.today };
  if (values.statusEvent) state.statusEvent = { ...state.statusEvent, ...values.statusEvent };
  publish();
}

export const PRESETS = {
  calm: {
    name: "Dead Calm (Nap Mode)",
    now: { windSpeed: 1.2, activePowerKw: 0, rotorRpm: 0.2, nacelleDeg: 190, availablePowerAfterSetpoints: 4200, theoreticalMaxPower: 0 },
    statusEvent: { main_status: 1, substatus: 0, fault_message_flag: 0, warning_message_flag: 0, service_flag: 0 },
  },
  breeze: {
    name: "Gentle Breeze (Generating)",
    now: { windSpeed: 5.5, activePowerKw: 650, rotorRpm: 6.8, nacelleDeg: 215, availablePowerAfterSetpoints: 4200, theoreticalMaxPower: 650 },
    statusEvent: { main_status: 0, substatus: 0, fault_message_flag: 0, warning_message_flag: 0, service_flag: 0 },
  },
  rated: {
    name: "Cheetah Mode (Peak 4.2 MW)",
    now: { windSpeed: 12.8, activePowerKw: 4200, rotorRpm: 13.5, nacelleDeg: 240, availablePowerAfterSetpoints: 4200, theoreticalMaxPower: 4245 },
    statusEvent: { main_status: 0, substatus: 0, fault_message_flag: 0, warning_message_flag: 0, service_flag: 0 },
  },
  storm: {
    name: "Violent Gale & Cut-Out",
    now: { windSpeed: 29.5, activePowerKw: 0, rotorRpm: 0.8, nacelleDeg: 270, availablePowerAfterSetpoints: 4200, theoreticalMaxPower: 4245 },
    statusEvent: { main_status: 1, substatus: 0, fault_message_flag: 0, warning_message_flag: 1, service_flag: 0 },
  },
  curtailed: {
    name: "National Grid Curtailment",
    now: { windSpeed: 11.0, activePowerKw: 1500, rotorRpm: 8.5, nacelleDeg: 220, availablePowerAfterSetpoints: 1500, theoreticalMaxPower: 3800 },
    statusEvent: { main_status: 1, substatus: 0, fault_message_flag: 0, warning_message_flag: 0, service_flag: 0 },
  },
  maintenance: {
    name: "Maintenance (Technicians on Site)",
    now: { windSpeed: 5.0, activePowerKw: 0, rotorRpm: 0, nacelleDeg: 200, availablePowerAfterSetpoints: 4200, theoreticalMaxPower: 500 },
    statusEvent: { main_status: 9, substatus: 0, fault_message_flag: 0, warning_message_flag: 0, service_flag: 1 },
  },
  fault: {
    name: "Safety Trip / Fault",
    now: { windSpeed: 7.2, activePowerKw: 0, rotorRpm: 0, nacelleDeg: 200, availablePowerAfterSetpoints: 4200, theoreticalMaxPower: 1200 },
    statusEvent: { main_status: 9, substatus: 0, fault_message_flag: 1, warning_message_flag: 0, service_flag: 0 },
  },
};

export function applyPreset(name) {
  const preset = PRESETS[name];
  if (!preset) return false;
  setSimulatedState(preset);
  return true;
}

export function resumeLive() {
  state.mode = "live";
  consecutiveFailures = 0;
  pollNowOnce();
  pollTodayOnce();
  pollStatusOnce();
}
