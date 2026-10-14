-- Live 1-second readings from the ACE API, stored as the collector receives them.
-- Raw rows are compressed after a day and dropped after 35 days (ACE's own retention for
-- 1 s data); the 1-minute aggregates below keep the shape of every day forever.

-- Site-level readings (the grid connection).
CREATE TABLE ts.site_sample (
  site_id                   text NOT NULL REFERENCES core.site,
  observed_at               timestamptz NOT NULL,
  active_power_kw           double precision NOT NULL CHECK (active_power_kw BETWEEN -1000 AND 6500),
  wind_speed_ms             double precision NOT NULL CHECK (wind_speed_ms BETWEEN 0 AND 100),
  wind_direction_deg        double precision NOT NULL CHECK (wind_direction_deg BETWEEN 0 AND 360),
  available_power_kw        double precision NOT NULL CHECK (available_power_kw BETWEEN 0 AND 6500),
  theoretical_max_power_kw  double precision NOT NULL CHECK (theoretical_max_power_kw BETWEEN 0 AND 6500),
  PRIMARY KEY (site_id, observed_at)
);
SELECT create_hypertable('ts.site_sample', by_range('observed_at', INTERVAL '1 day'));

-- Turbine-level readings.
CREATE TABLE ts.asset_sample (
  asset_id              text NOT NULL REFERENCES core.asset,
  observed_at           timestamptz NOT NULL,
  active_power_kw       double precision NOT NULL CHECK (active_power_kw BETWEEN -1000 AND 6500),
  wind_speed_ms         double precision NOT NULL CHECK (wind_speed_ms BETWEEN 0 AND 100),
  rotor_speed_rpm       double precision NOT NULL CHECK (rotor_speed_rpm BETWEEN 0 AND 30),
  nacelle_position_deg  double precision NOT NULL CHECK (nacelle_position_deg BETWEEN 0 AND 360),
  energy_exported_kwh   double precision NOT NULL CHECK (energy_exported_kwh >= 0),
  operating_hours       double precision CHECK (operating_hours >= 0),
  PRIMARY KEY (asset_id, observed_at)
);
SELECT create_hypertable('ts.asset_sample', by_range('observed_at', INTERVAL '1 day'));

ALTER TABLE ts.site_sample SET (timescaledb.enable_columnstore, timescaledb.segmentby = 'site_id', timescaledb.orderby = 'observed_at DESC');
ALTER TABLE ts.asset_sample SET (timescaledb.enable_columnstore, timescaledb.segmentby = 'asset_id', timescaledb.orderby = 'observed_at DESC');
CALL add_columnstore_policy('ts.site_sample', after => INTERVAL '1 day');
CALL add_columnstore_policy('ts.asset_sample', after => INTERVAL '1 day');
SELECT add_retention_policy('ts.site_sample', drop_after => INTERVAL '35 days');
SELECT add_retention_policy('ts.asset_sample', drop_after => INTERVAL '35 days');

-- One-minute aggregates. They are refreshed over the last few hours only, so dropping old
-- raw rows never removes them. Real-time aggregation fills in the current minute.
CREATE MATERIALIZED VIEW ts.asset_minute
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT asset_id,
       time_bucket(INTERVAL '1 minute', observed_at) AS bucket,
       avg(active_power_kw)                    AS active_power_avg_kw,
       max(active_power_kw)                    AS active_power_max_kw,
       avg(wind_speed_ms)                      AS wind_speed_avg_ms,
       max(wind_speed_ms)                      AS wind_speed_max_ms,
       avg(rotor_speed_rpm)                    AS rotor_speed_avg_rpm,
       first(energy_exported_kwh, observed_at) AS energy_exported_first_kwh,
       last(energy_exported_kwh, observed_at)  AS energy_exported_last_kwh,
       count(*)                                AS sample_count
FROM ts.asset_sample
GROUP BY asset_id, bucket
WITH NO DATA;

CREATE MATERIALIZED VIEW ts.site_minute
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT site_id,
       time_bucket(INTERVAL '1 minute', observed_at) AS bucket,
       avg(active_power_kw)          AS active_power_avg_kw,
       avg(available_power_kw)       AS available_power_avg_kw,
       avg(theoretical_max_power_kw) AS theoretical_max_power_avg_kw,
       avg(wind_speed_ms)            AS wind_speed_avg_ms,
       count(*)                      AS sample_count
FROM ts.site_sample
GROUP BY site_id, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('ts.asset_minute', start_offset => INTERVAL '3 hours', end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 minute');
SELECT add_continuous_aggregate_policy('ts.site_minute', start_offset => INTERVAL '3 hours', end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 minute');
