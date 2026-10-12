-- Explicit opt-in migration: legacy public tables remain available for rollback.
CREATE SCHEMA IF NOT EXISTS history;
CREATE TABLE IF NOT EXISTS history.scada_10m (
  asset_id TEXT NOT NULL,
  observed_at_utc TIMESTAMPTZ NOT NULL,
  wind_speed_mean_ms DOUBLE PRECISION,
  wind_speed_max_ms DOUBLE PRECISION,
  active_power_mean_kw DOUBLE PRECISION,
  active_power_max_kw DOUBLE PRECISION,
  energy_meter_kwh DOUBLE PRECISION,
  source TEXT NOT NULL CHECK (source IN ('live','zenodo')),
  source_release TEXT,
  quality TEXT NOT NULL CHECK (quality IN ('complete','partial')),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (asset_id,observed_at_utc),
  CHECK (MOD(EXTRACT(EPOCH FROM observed_at_utc)::numeric,600)=0),
  CHECK (wind_speed_mean_ms IS NULL OR (wind_speed_mean_ms>=0 AND wind_speed_mean_ms<'Infinity'::float8)),
  CHECK (wind_speed_max_ms IS NULL OR (wind_speed_max_ms>=0 AND wind_speed_max_ms<'Infinity'::float8)),
  CHECK (active_power_mean_kw IS NULL OR (active_power_mean_kw>'-Infinity'::float8 AND active_power_mean_kw<'Infinity'::float8)),
  CHECK (active_power_max_kw IS NULL OR (active_power_max_kw>'-Infinity'::float8 AND active_power_max_kw<'Infinity'::float8)),
  CHECK (energy_meter_kwh IS NULL OR (energy_meter_kwh>=0 AND energy_meter_kwh<'Infinity'::float8)),
  CHECK (wind_speed_max_ms>=wind_speed_mean_ms),
  CHECK (active_power_max_kw>=active_power_mean_kw),
  CHECK (COALESCE(wind_speed_mean_ms,wind_speed_max_ms,active_power_mean_kw,active_power_max_kw,energy_meter_kwh) IS NOT NULL),
  CHECK (quality<>'complete' OR (wind_speed_mean_ms IS NOT NULL AND wind_speed_max_ms IS NOT NULL AND active_power_mean_kw IS NOT NULL AND active_power_max_kw IS NOT NULL AND energy_meter_kwh IS NOT NULL)),
  CHECK ((source='live' AND source_release IS NULL) OR (source='zenodo' AND source_release IS NOT NULL))
);
SELECT create_hypertable('history.scada_10m','observed_at_utc',chunk_time_interval=>INTERVAL '3 months',if_not_exists=>TRUE);

CREATE MATERIALIZED VIEW IF NOT EXISTS history.daily_base
WITH (timescaledb.continuous,timescaledb.materialized_only=false) AS
SELECT asset_id,time_bucket(INTERVAL '1 day',observed_at_utc,'Europe/London') AS bucket,
  SUM(active_power_mean_kw)/6.0 AS energy_kwh,
  AVG(wind_speed_mean_ms) AS wind_speed_avg,MAX(wind_speed_max_ms) AS wind_speed_max,
  AVG(active_power_mean_kw) AS active_power_avg,MAX(active_power_max_kw) AS active_power_max,
  COUNT(*) AS sample_count,COUNT(active_power_mean_kw) AS valid_power_count,
  COUNT(*) FILTER (WHERE quality='complete') AS complete_count,
  COUNT(*) FILTER (WHERE quality='partial') AS partial_count,
  MIN(observed_at_utc) AS start_utc,MAX(observed_at_utc) AS end_utc
FROM history.scada_10m GROUP BY asset_id,bucket WITH NO DATA;
SELECT add_continuous_aggregate_policy('history.daily_base',start_offset=>INTERVAL '3 days',end_offset=>INTERVAL '0 hours',schedule_interval=>INTERVAL '10 minutes',if_not_exists=>TRUE);

-- shortcut: source timestamps label observations; confirm interval-start/end semantics before claiming exact midnight allocation.
CREATE OR REPLACE VIEW history.daily_rollup AS
WITH days AS (
 SELECT *,((bucket AT TIME ZONE 'Europe/London')+INTERVAL '1 day') AT TIME ZONE 'Europe/London' AS day_end
 FROM history.daily_base
)
SELECT *,TO_CHAR(bucket AT TIME ZONE 'Europe/London','YYYY-MM-DD') AS date_london,
 EXTRACT(EPOCH FROM day_end-bucket)/3600.0 AS day_duration_hours,
 EXTRACT(EPOCH FROM day_end-bucket)/600.0 AS expected_count,
 ROUND(100.0*valid_power_count/(EXTRACT(EPOCH FROM day_end-bucket)/600.0),2) AS coverage_pct,
 energy_kwh/(4245.0*EXTRACT(EPOCH FROM day_end-bucket)/3600.0)*100.0 AS capacity_factor_pct,
 'estimated from 10-minute mean net power'::text AS energy_method
FROM days;
