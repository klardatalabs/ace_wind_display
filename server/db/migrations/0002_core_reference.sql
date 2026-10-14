-- Reference data. Each fact is stored once: a turbine model's specification lives on the
-- model, the site's location on the site, and the export limit on the installed asset.
-- Rows are seeded from shared/site.js and shared/constants.js by server/db/seed.js.

CREATE TABLE core.site (
  site_id    text PRIMARY KEY CHECK (site_id ~ '^[a-z0-9-]+$'),
  name       text NOT NULL,
  latitude   double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude  double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  time_zone  text NOT NULL
);

CREATE TABLE core.turbine_model (
  model_id              text PRIMARY KEY,
  manufacturer          text NOT NULL,
  rated_power_kw        double precision NOT NULL CHECK (rated_power_kw > 0),
  rotor_diameter_m      double precision NOT NULL CHECK (rotor_diameter_m > 0),
  cut_in_wind_ms        double precision NOT NULL,
  rated_wind_ms         double precision NOT NULL,
  storm_control_from_ms double precision NOT NULL,
  cut_out_wind_ms       double precision NOT NULL,
  CHECK (0 < cut_in_wind_ms AND cut_in_wind_ms < rated_wind_ms
         AND rated_wind_ms < storm_control_from_ms AND storm_control_from_ms < cut_out_wind_ms)
);

-- The manufacturer's power curve: one row per (model, wind speed).
CREATE TABLE core.power_curve_point (
  model_id       text NOT NULL REFERENCES core.turbine_model ON DELETE CASCADE,
  wind_speed_ms  double precision NOT NULL CHECK (wind_speed_ms >= 0),
  power_kw       double precision NOT NULL CHECK (power_kw >= 0),
  PRIMARY KEY (model_id, wind_speed_ms)
);

-- An installed turbine.
CREATE TABLE core.asset (
  asset_id          text PRIMARY KEY CHECK (asset_id ~ '^[a-z0-9-]+$'),
  site_id           text NOT NULL REFERENCES core.site,
  model_id          text NOT NULL REFERENCES core.turbine_model,
  grid_setpoint_kw  double precision NOT NULL CHECK (grid_setpoint_kw > 0),
  commissioned_on   date NOT NULL
);

-- Where data comes from (the live ACE API, the Zenodo archive) ...
CREATE TABLE core.data_source (
  source_id    text PRIMARY KEY,
  description  text NOT NULL
);

-- ... and which release of it. Live API rows point at the source's single 'live' release;
-- archive rows point at the Zenodo release (DOI) they were imported from.
CREATE TABLE core.source_release (
  release_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id     text NOT NULL REFERENCES core.data_source,
  release_ref   text NOT NULL,
  checksum      text,
  imported_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, release_ref)
);

-- OpenWeather condition codes, filled in as they are first seen.
CREATE TABLE core.weather_condition (
  condition_id  integer PRIMARY KEY,
  main          text NOT NULL,
  description   text NOT NULL
);

-- Sunrise and sunset depend on the site and the calendar day, not on any observation.
CREATE TABLE core.site_daylight (
  site_id     text NOT NULL REFERENCES core.site,
  local_date  date NOT NULL,
  sunrise_at  timestamptz NOT NULL,
  sunset_at   timestamptz NOT NULL CHECK (sunset_at > sunrise_at),
  PRIMARY KEY (site_id, local_date)
);
