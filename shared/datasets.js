// Open datasets researchers can request. The files are the latest verified Zenodo release,
// downloaded and checksum-checked by the collector.

export const DATASETS = [
  { id: "scada_10m", label: "10-Minute SCADA Telemetry", fileName: "ace-wind-10m-latest.parquet", format: "Apache Parquet", archiveKind: "10m" },
  { id: "daily", label: "Daily Operational Aggregates & Yield", fileName: "ace-wind-daily-latest.parquet", format: "Apache Parquet", archiveKind: "daily" },
  { id: "events", label: "Chronological Status & Grid Events", fileName: "ace-wind-events-latest.parquet", format: "Apache Parquet", archiveKind: "events" },
];
