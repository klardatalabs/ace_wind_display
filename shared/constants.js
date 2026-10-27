// Shared physical/financial constants - imported by both the Node backend
// (server/**) and the React frontend (frontend/src/**). Values are taken
// from ACE's published project and Zenodo archive where cited. Exact installed
// settings below still need confirmation from ACE's configuration data.

export const API_BASE = "https://ace-api.duckdns.org";
export const SITE_ID = "ace";
export const WEC_ASSET = "wec-1";

// Generic E-115 EP3 geometry: https://www.hannovermesse.de/apollo/hannover_messe_2021/obs/Binary/A1088808/EC_Datenbl%C3%A4tter_E-115%20EP3_en_022020.pdf
export const RATED_POWER_KW = 4245.0;
export const GRID_SETPOINT_KW = 4200.0;
export const ROTOR_DIAMETER_M = 115.7;
export const CUT_IN_WIND_MS = 2.5;
export const RATED_WIND_MS = 12.5;
export const CUT_OUT_LOW_MS = 28.0;
export const CUT_OUT_HIGH_MS = 34.0;

// Illustrative home-demand equivalent, about 3,066 kWh/year; not connected homes.
export const AVG_UK_HOME_DEMAND_KW = 0.35;

// Polling / connection tuning
export const POLL_NOW_MS = 1000;
export const POLL_TODAY_MS = 60_000;
export const POLL_STATUS_MS = 5000;
export const OFFLINE_AFTER_FAILURES = 3;

// CC-BY-4.0 attribution (DATA_SOURCES.md section 4)
export const ATTRIBUTION_TEXT =
  "Plumley, Charlie; Garrad, Andrew; Burke, Wilf; Jonsson, Christian; Smirthwaite, Andrew. " +
  "ACE Wind Turbine Data. Zenodo. https://doi.org/10.5281/zenodo.22662372";
export const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";
