// Datasets researchers can request: each is exported as CSV from the time-series tables for
// the UK date range they choose (at most `maxRangeDays` per request). The complete archive
// stays available as Parquet on Zenodo (ARCHIVE_DOI_URL).

export const ARCHIVE_DOI_URL = "https://doi.org/10.5281/zenodo.22662372";

export const DATASETS = [
  { id: "scada_10m", label: "10-minute SCADA telemetry", maxRangeDays: 366,
    description: "Wind speed, power, rotor speed, nacelle position and the energy meter every 10 minutes." },
  { id: "daily", label: "Daily summary", maxRangeDays: 3660,
    description: "Energy, coverage, capacity factor, wind and power per UK calendar day." },
  { id: "minute", label: "1-minute live readings", maxRangeDays: 31,
    description: "Average and peak power, wind and rotor speed per minute, from the 1-second live feed." },
  { id: "status_events", label: "Status events", maxRangeDays: 3660,
    description: "Turbine status changes: main status, substatus, fault, warning and service flags." },
  { id: "weather", label: "Weather at the site", maxRangeDays: 3660,
    description: "Temperature, cloud, rain, visibility and wind from OpenWeather, about every 10 minutes." },
];

export const DATASET_IDS = DATASETS.map((d) => d.id);
