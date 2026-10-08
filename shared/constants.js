// Shared physical/financial constants - imported by both the Node backend
// (server/**) and the React frontend (frontend/src/**). Values are taken
// directly from PROJECT_OVERVIEW.md / DATA_DICTIONARY.md / API_REFERENCE.md
// unless marked ASSUMPTION - confirm those with ACE before relying on them.

export const API_BASE = "https://ace-api.duckdns.org";
export const SITE_ID = "ace";
export const WEC_ASSET = "wec-1";

// Turbine physical specification (PROJECT_OVERVIEW.md / DATA_DICTIONARY.md section 6)
export const RATED_POWER_KW = 4245.0;
export const GRID_SETPOINT_KW = 4200.0;
export const ROTOR_DIAMETER_M = 115.7;
export const CUT_IN_WIND_MS = 2.5;
export const RATED_WIND_MS = 12.5;
export const CUT_OUT_LOW_MS = 28.0;
export const CUT_OUT_HIGH_MS = 34.0;
export const COMMISSION_DATE_ISO = "2023-03-29T00:00:00Z";

// Community-impact conversion factors (exploratory analysis.md, section 2)
export const AVG_UK_HOME_DEMAND_KW = 0.35;
export const CO2_FACTOR_KG_PER_KWH = 0.207;
export const CO2_KG_PER_TREE_PER_YEAR = 21; // ASSUMPTION: commonly cited mature-tree absorption rate

// ASSUMPTION - no public PPA tariff figure is given in the project documents.
// Replace with ACE's real confirmed community tariff (GBP per MWh) before treating
// the money figure as fact; the UI always labels it "estimated".
export const COMMUNITY_FUND_RATE_GBP_PER_MWH = 5;

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
