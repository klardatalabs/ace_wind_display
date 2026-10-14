-- 10-minute SCADA history: synced from the ACE API every 10 minutes and back-filled from
-- the Zenodo archive. Live API rows are corrected when ACE revises them; archive rows only
-- fill gaps. Every row records which release it came from.

CREATE TABLE ts.scada_10m (
  asset_id               text NOT NULL REFERENCES core.asset,
  observed_at            timestamptz NOT NULL CHECK (EXTRACT(EPOCH FROM observed_at)::bigint % 600 = 0),
  release_id             integer NOT NULL REFERENCES core.source_release,
  wind_speed_mean_ms     double precision CHECK (wind_speed_mean_ms BETWEEN 0 AND 100),
  wind_speed_max_ms      double precision CHECK (wind_speed_max_ms BETWEEN 0 AND 100),
  wind_speed_min_ms      double precision CHECK (wind_speed_min_ms BETWEEN 0 AND 100),
  active_power_mean_kw   double precision CHECK (active_power_mean_kw BETWEEN -1000 AND 6500),
  active_power_max_kw    double precision CHECK (active_power_max_kw BETWEEN -1000 AND 6500),
  active_power_min_kw    double precision CHECK (active_power_min_kw BETWEEN -1000 AND 6500),
  rotor_speed_mean_rpm   double precision CHECK (rotor_speed_mean_rpm BETWEEN 0 AND 30),
  rotor_speed_max_rpm    double precision CHECK (rotor_speed_max_rpm BETWEEN 0 AND 30),
  nacelle_position_deg   double precision CHECK (nacelle_position_deg BETWEEN 0 AND 360),
  energy_meter_kwh       double precision CHECK (energy_meter_kwh >= 0),
  operating_hours        double precision CHECK (operating_hours >= 0),
  ingested_at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, observed_at),
  CHECK (wind_speed_min_ms <= wind_speed_mean_ms AND wind_speed_mean_ms <= wind_speed_max_ms),
  CHECK (active_power_min_kw <= active_power_mean_kw AND active_power_mean_kw <= active_power_max_kw),
  CHECK (rotor_speed_mean_rpm <= rotor_speed_max_rpm),
  CHECK (num_nonnulls(wind_speed_mean_ms, wind_speed_max_ms, active_power_mean_kw, active_power_max_kw, energy_meter_kwh) > 0)
);
SELECT create_hypertable('ts.scada_10m', by_range('observed_at', INTERVAL '30 days'));
ALTER TABLE ts.scada_10m SET (timescaledb.enable_columnstore, timescaledb.segmentby = 'asset_id', timescaledb.orderby = 'observed_at DESC');
CALL add_columnstore_policy('ts.scada_10m', after => INTERVAL '60 days');

-- Daily figures per UK calendar day (time_bucket with a time zone handles the 23- and
-- 25-hour days at the clock changes).
CREATE MATERIALIZED VIEW ts.scada_daily
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT asset_id,
       time_bucket(INTERVAL '1 day', observed_at, 'Europe/London')  AS day_start,
       sum(active_power_mean_kw) / 6.0                             AS energy_from_power_kwh,
       first(energy_meter_kwh, observed_at) FILTER (WHERE energy_meter_kwh IS NOT NULL) AS meter_first_kwh,
       last(energy_meter_kwh, observed_at)  FILTER (WHERE energy_meter_kwh IS NOT NULL) AS meter_last_kwh,
       avg(wind_speed_mean_ms)                                     AS wind_speed_avg_ms,
       max(wind_speed_max_ms)                                      AS wind_speed_max_ms,
       avg(active_power_mean_kw)                                   AS active_power_avg_kw,
       max(active_power_max_kw)                                    AS active_power_max_kw,
       count(active_power_mean_kw)                                 AS power_sample_count,
       min(observed_at)                                            AS first_observed_at,
       max(observed_at)                                            AS last_observed_at
FROM ts.scada_10m
GROUP BY asset_id, day_start
WITH NO DATA;

SELECT add_continuous_aggregate_policy('ts.scada_daily', start_offset => INTERVAL '3 days', end_offset => INTERVAL '10 minutes', schedule_interval => INTERVAL '10 minutes');

-- What every consumer reads. Energy comes from the cumulative meter when the meter is
-- trustworthy for that day (present on this day and the next, rising, and within 25% of
-- the energy implied by mean power); otherwise it is estimated from mean power.
CREATE VIEW ts.daily_summary AS
WITH days AS (
  SELECT d.*,
         m.rated_power_kw,
         (d.day_start AT TIME ZONE 'Europe/London')::date AS local_date,
         (EXTRACT(EPOCH FROM ((((d.day_start AT TIME ZONE 'Europe/London') + INTERVAL '1 day') AT TIME ZONE 'Europe/London') - d.day_start)) / 3600.0)::double precision AS day_hours,
         lead(d.meter_first_kwh) OVER w AS next_meter_first_kwh,
         lead(d.day_start) OVER w AS next_day_start
  FROM ts.scada_daily d
  JOIN core.asset a USING (asset_id)
  JOIN core.turbine_model m USING (model_id)
  WINDOW w AS (PARTITION BY d.asset_id ORDER BY d.day_start)
), metered AS (
  SELECT *,
         CASE
           WHEN next_day_start = (((day_start AT TIME ZONE 'Europe/London') + INTERVAL '1 day') AT TIME ZONE 'Europe/London')
             THEN next_meter_first_kwh - meter_first_kwh
           WHEN next_day_start IS NULL THEN meter_last_kwh - meter_first_kwh
         END AS meter_delta_kwh,
         power_sample_count / (day_hours * 6.0) AS coverage
  FROM days
), chosen AS (
  SELECT *,
         meter_delta_kwh IS NOT NULL
           AND meter_delta_kwh >= 0
           AND meter_delta_kwh <= rated_power_kw * day_hours * 1.05
           AND (coverage < 0.9 OR abs(meter_delta_kwh - energy_from_power_kwh) <= greatest(0.25 * energy_from_power_kwh, 50))
           AS meter_trusted
  FROM metered
)
SELECT asset_id,
       local_date,
       day_start,
       day_hours,
       power_sample_count,
       round((100.0 * coverage)::numeric, 1)::double precision AS coverage_pct,
       CASE WHEN meter_trusted THEN meter_delta_kwh ELSE energy_from_power_kwh END AS energy_kwh,
       CASE WHEN meter_trusted THEN 'energy meter' ELSE 'estimated from 10-minute mean power' END AS energy_method,
       energy_from_power_kwh,
       wind_speed_avg_ms,
       wind_speed_max_ms,
       active_power_avg_kw,
       active_power_max_kw,
       (CASE WHEN meter_trusted THEN meter_delta_kwh ELSE energy_from_power_kwh END) / (rated_power_kw * day_hours) * 100.0 AS capacity_factor_pct,
       first_observed_at,
       last_observed_at
FROM chosen;
