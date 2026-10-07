-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- 1. SCADA 10-Minute Hypertable
CREATE TABLE IF NOT EXISTS scada_10m (
  ts TIMESTAMPTZ NOT NULL,
  wind_speed_mean DOUBLE PRECISION,
  wind_speed_max DOUBLE PRECISION,
  wind_speed_min DOUBLE PRECISION,
  active_power_mean DOUBLE PRECISION,
  active_power_max DOUBLE PRECISION,
  active_power_min DOUBLE PRECISION,
  rotor_speed_mean DOUBLE PRECISION,
  rotor_speed_max DOUBLE PRECISION,
  nacelle_position_mean DOUBLE PRECISION,
  energy_produced DOUBLE PRECISION,
  operating_hours DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'zenodo' CHECK (source IN ('zenodo', 'live')),
  CONSTRAINT pk_scada_10m PRIMARY KEY (ts)
);

-- Convert to hypertable with 3-month chunk interval
SELECT create_hypertable(
  'scada_10m',
  'ts',
  chunk_time_interval => INTERVAL '3 months',
  if_not_exists => TRUE
);

-- Create secondary index on source
CREATE INDEX IF NOT EXISTS idx_scada_10m_source ON scada_10m (source);

-- 2. Status Events Table (Real status events only; records computed via SQL)
CREATE TABLE IF NOT EXISTS status_events (
  observed_at TIMESTAMPTZ NOT NULL PRIMARY KEY,
  asset TEXT,
  event_family TEXT,
  main_status INTEGER,
  substatus INTEGER,
  fault_message_flag INTEGER,
  warning_message_flag INTEGER,
  service_flag INTEGER,
  raw_value TEXT,
  source TEXT NOT NULL DEFAULT 'zenodo'
);

CREATE INDEX IF NOT EXISTS idx_status_events_at ON status_events (observed_at DESC);

-- 3. Daily Rollup Continuous Aggregate
-- Grouped by Europe/London date using time_bucket with timezone
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_rollup
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', ts, 'Europe/London') AS bucket,
  ROUND(AVG(wind_speed_mean)::numeric, 2)::double precision AS wind_speed_avg,
  ROUND(MAX(wind_speed_max)::numeric, 2)::double precision AS wind_speed_max,
  ROUND(AVG(active_power_mean)::numeric, 1)::double precision AS active_power_avg,
  ROUND(MAX(active_power_max)::numeric, 1)::double precision AS active_power_max,
  ROUND((MAX(energy_produced) - MIN(energy_produced))::numeric, 1)::double precision AS energy_kwh,
  COUNT(*) AS sample_count
FROM scada_10m
GROUP BY bucket
WITH NO DATA;

-- Add continuous aggregate refresh policy (runs every 15 min, refreshes rolling window from 3 days ago to now)
SELECT add_continuous_aggregate_policy(
  'daily_rollup',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '0 hours',
  schedule_interval => INTERVAL '15 minutes',
  if_not_exists => TRUE
);
