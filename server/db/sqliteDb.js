import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "..", "data", "ace_history.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Ensure tables & view exist (in case python script hasn't run yet)
db.exec(`
CREATE TABLE IF NOT EXISTS scada_10m (
  timestamp TEXT PRIMARY KEY,
  wind_speed_mean REAL,
  wind_speed_max REAL,
  wind_speed_min REAL,
  active_power_mean REAL,
  active_power_max REAL,
  active_power_min REAL,
  rotor_speed_mean REAL,
  rotor_speed_max REAL,
  nacelle_position REAL,
  energy_produced REAL,
  operating_hours REAL,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_scada_10m_ts ON scada_10m(timestamp);

CREATE TABLE IF NOT EXISTS status_events (
  observed_at TEXT PRIMARY KEY,
  asset TEXT,
  event_family TEXT,
  main_status INTEGER,
  substatus INTEGER,
  fault_message_flag INTEGER,
  warning_message_flag INTEGER,
  service_flag INTEGER,
  raw_value TEXT,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_status_events_at ON status_events(observed_at);

DROP VIEW IF EXISTS daily_rollup;
CREATE VIEW daily_rollup AS
WITH adjusted AS (
  SELECT *,
    strftime('%Y-%m-%d', datetime(timestamp, CASE 
      WHEN strftime('%m', timestamp) IN ('04','05','06','07','08','09') THEN '+1 hour'
      WHEN strftime('%m', timestamp) = '03' AND strftime('%d', timestamp) >= '25' THEN '+1 hour'
      WHEN strftime('%m', timestamp) = '10' AND strftime('%d', timestamp) < '25' THEN '+1 hour'
      ELSE '+0 hour'
    END)) AS date_london
  FROM scada_10m
)
SELECT 
  date_london,
  MIN(timestamp) AS start_utc,
  MAX(timestamp) AS end_utc,
  COUNT(*) AS sample_count,
  ROUND(MAX(energy_produced) - MIN(energy_produced), 1) AS energy_kwh,
  ROUND(AVG(wind_speed_mean), 2) AS wind_speed_avg,
  ROUND(MAX(wind_speed_max), 2) AS wind_speed_max,
  ROUND(AVG(active_power_mean), 1) AS active_power_avg,
  ROUND(MAX(active_power_max), 1) AS active_power_peak,
  ROUND(AVG(rotor_speed_mean), 2) AS rotor_speed_avg
FROM adjusted
GROUP BY date_london;
`);

const stmtGetLatestTs = db.prepare("SELECT MAX(timestamp) AS latest FROM scada_10m;");
const stmtInsert10m = db.prepare(`
  INSERT INTO scada_10m (
    timestamp, wind_speed_mean, wind_speed_max, wind_speed_min,
    active_power_mean, active_power_max, active_power_min,
    rotor_speed_mean, rotor_speed_max, nacelle_position,
    energy_produced, operating_hours, source
  ) VALUES (
    @timestamp, @wind_speed_mean, @wind_speed_max, @wind_speed_min,
    @active_power_mean, @active_power_max, @active_power_min,
    @rotor_speed_mean, @rotor_speed_max, @nacelle_position,
    @energy_produced, @operating_hours, @source
  )
  ON CONFLICT(timestamp) DO UPDATE SET
    wind_speed_mean = excluded.wind_speed_mean,
    wind_speed_max = excluded.wind_speed_max,
    wind_speed_min = excluded.wind_speed_min,
    active_power_mean = excluded.active_power_mean,
    active_power_max = excluded.active_power_max,
    active_power_min = excluded.active_power_min,
    rotor_speed_mean = excluded.rotor_speed_mean,
    rotor_speed_max = excluded.rotor_speed_max,
    nacelle_position = excluded.nacelle_position,
    energy_produced = excluded.energy_produced,
    operating_hours = excluded.operating_hours,
    source = excluded.source;
`);

export function getLatestStoredTimestamp() {
  const row = stmtGetLatestTs.get();
  return row?.latest || null;
}

export function upsert10mBatch(records) {
  if (!records || !records.length) return 0;
  const insertMany = db.transaction((rows) => {
    let count = 0;
    for (const r of rows) {
      stmtInsert10m.run(r);
      count++;
    }
    return count;
  });
  return insertMany(records);
}

export function getDailyRollups(limit = 60) {
  return db.prepare("SELECT * FROM daily_rollup ORDER BY date_london DESC LIMIT ?").all(limit);
}

export function getTopWindDays(limit = 5) {
  return db.prepare(`
    SELECT date_london, wind_speed_max, wind_speed_avg, energy_kwh, active_power_peak
    FROM daily_rollup
    WHERE sample_count >= 50
    ORDER BY wind_speed_max DESC
    LIMIT ?
  `).all(limit);
}

export function getTopGenerationDays(limit = 5) {
  return db.prepare(`
    SELECT date_london, energy_kwh, wind_speed_avg, active_power_peak, sample_count
    FROM daily_rollup
    WHERE sample_count >= 50
    ORDER BY energy_kwh DESC
    LIMIT ?
  `).all(limit);
}

export function getComparisonMetrics() {
  const rollups = db.prepare("SELECT * FROM daily_rollup ORDER BY date_london DESC LIMIT 60").all();
  if (!rollups || rollups.length < 2) {
    return {
      todayVsYesterday: null,
      thisWeekVsLastWeek: null,
      thisMonthVsLastMonth: null,
    };
  }

  const today = rollups[0];
  const yesterday = rollups[1];

  const pctDiff = (curr, prev) => {
    if (!prev || prev === 0) return 0;
    return Math.round(((curr - prev) / prev) * 100);
  };

  // 1. Today vs Yesterday
  const todayVsYesterday = {
    today: {
      date: today.date_london,
      energyKwh: today.energy_kwh ?? 0,
      avgWindSpeed: today.wind_speed_avg ?? 0,
      peakPowerKw: today.active_power_peak ?? 0,
      sampleCount: today.sample_count,
    },
    yesterday: {
      date: yesterday.date_london,
      energyKwh: yesterday.energy_kwh ?? 0,
      avgWindSpeed: yesterday.wind_speed_avg ?? 0,
      peakPowerKw: yesterday.active_power_peak ?? 0,
      sampleCount: yesterday.sample_count,
    },
    deltaEnergyKwh: Math.round((today.energy_kwh ?? 0) - (yesterday.energy_kwh ?? 0)),
    energyPctChange: pctDiff(today.energy_kwh, yesterday.energy_kwh),
    deltaWindSpeed: Number(((today.wind_speed_avg ?? 0) - (yesterday.wind_speed_avg ?? 0)).toFixed(2)),
  };

  // 2. This Week (last 7 completed days: indices 1 to 7) vs Last Week (indices 8 to 14)
  const thisWeekDays = rollups.slice(1, 8);
  const lastWeekDays = rollups.slice(8, 15);

  const sumEnergy = (days) => days.reduce((sum, d) => sum + (d.energy_kwh || 0), 0);
  const avgWind = (days) => (days.length ? days.reduce((sum, d) => sum + (d.wind_speed_avg || 0), 0) / days.length : 0);

  const thisWeekEnergy = Math.round(sumEnergy(thisWeekDays));
  const lastWeekEnergy = Math.round(sumEnergy(lastWeekDays));
  const thisWeekAvgWind = Number(avgWind(thisWeekDays).toFixed(2));
  const lastWeekAvgWind = Number(avgWind(lastWeekDays).toFixed(2));

  const thisWeekVsLastWeek = {
    thisWeek: {
      daysCount: thisWeekDays.length,
      totalEnergyKwh: thisWeekEnergy,
      avgWindSpeed: thisWeekAvgWind,
      startDate: thisWeekDays[thisWeekDays.length - 1]?.date_london,
      endDate: thisWeekDays[0]?.date_london,
    },
    lastWeek: {
      daysCount: lastWeekDays.length,
      totalEnergyKwh: lastWeekEnergy,
      avgWindSpeed: lastWeekAvgWind,
      startDate: lastWeekDays[lastWeekDays.length - 1]?.date_london,
      endDate: lastWeekDays[0]?.date_london,
    },
    deltaEnergyKwh: thisWeekEnergy - lastWeekEnergy,
    energyPctChange: pctDiff(thisWeekEnergy, lastWeekEnergy),
    deltaWindSpeed: Number((thisWeekAvgWind - lastWeekAvgWind).toFixed(2)),
  };

  // 3. This Month vs Previous Month
  const thisMonthPrefix = today.date_london.slice(0, 7); // e.g. "2026-10"
  const nowYear = parseInt(today.date_london.slice(0, 4), 10);
  const nowMonth = parseInt(today.date_london.slice(5, 7), 10);
  const prevMonthDate = new Date(Date.UTC(nowYear, nowMonth - 2, 1));
  const prevMonthPrefix = prevMonthDate.toISOString().slice(0, 7); // e.g. "2026-09"

  const thisMonthRows = rollups.filter((r) => r.date_london.startsWith(thisMonthPrefix));
  const prevMonthRows = rollups.filter((r) => r.date_london.startsWith(prevMonthPrefix));

  const thisMonthEnergy = Math.round(sumEnergy(thisMonthRows));
  const prevMonthEnergy = Math.round(sumEnergy(prevMonthRows));
  const thisMonthWind = Number(avgWind(thisMonthRows).toFixed(2));
  const prevMonthWind = Number(avgWind(prevMonthRows).toFixed(2));

  const thisMonthVsLastMonth = {
    thisMonth: {
      month: thisMonthPrefix,
      daysCount: thisMonthRows.length,
      totalEnergyKwh: thisMonthEnergy,
      avgWindSpeed: thisMonthWind,
    },
    lastMonth: {
      month: prevMonthPrefix,
      daysCount: prevMonthRows.length,
      totalEnergyKwh: prevMonthEnergy,
      avgWindSpeed: prevMonthWind,
    },
    deltaEnergyKwh: thisMonthEnergy - prevMonthEnergy,
    energyPctChange: pctDiff(thisMonthEnergy, prevMonthEnergy),
  };

  return {
    todayVsYesterday,
    thisWeekVsLastWeek,
    thisMonthVsLastMonth,
    records: {
      topWindDays: getTopWindDays(5),
      topGenerationDays: getTopGenerationDays(5),
    },
  };
}

export default db;
