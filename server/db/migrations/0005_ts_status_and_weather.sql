-- Turbine status events (recorded when the status changes) and weather at the site.

CREATE TABLE ts.status_event (
  asset_id         text NOT NULL REFERENCES core.asset,
  observed_at      timestamptz NOT NULL,
  release_id       integer NOT NULL REFERENCES core.source_release,
  main_status      integer NOT NULL,
  substatus        integer NOT NULL,
  fault_message    boolean NOT NULL,
  warning_message  boolean NOT NULL,
  service_mode     boolean NOT NULL,
  PRIMARY KEY (asset_id, observed_at)
);
SELECT create_hypertable('ts.status_event', by_range('observed_at', INTERVAL '90 days'));

CREATE TABLE ts.weather_observation (
  site_id             text NOT NULL REFERENCES core.site,
  observed_at         timestamptz NOT NULL,
  condition_id        integer NOT NULL REFERENCES core.weather_condition,
  temperature_c       double precision CHECK (temperature_c BETWEEN -60 AND 60),
  feels_like_c        double precision CHECK (feels_like_c BETWEEN -80 AND 70),
  humidity_pct        double precision CHECK (humidity_pct BETWEEN 0 AND 100),
  pressure_hpa        double precision CHECK (pressure_hpa BETWEEN 800 AND 1100),
  cloud_cover_pct     double precision CHECK (cloud_cover_pct BETWEEN 0 AND 100),
  rain_mm_h           double precision CHECK (rain_mm_h >= 0),
  snow_mm_h           double precision CHECK (snow_mm_h >= 0),
  visibility_m        double precision CHECK (visibility_m >= 0),
  wind_speed_ms       double precision CHECK (wind_speed_ms >= 0),
  wind_direction_deg  double precision CHECK (wind_direction_deg BETWEEN 0 AND 360),
  wind_gust_ms        double precision CHECK (wind_gust_ms >= 0),
  PRIMARY KEY (site_id, observed_at)
);
SELECT create_hypertable('ts.weather_observation', by_range('observed_at', INTERVAL '90 days'));
