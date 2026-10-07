import os
import sqlite3
import pyarrow.parquet as pq
import pandas as pd

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "ace_history.db"))
ZENODO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "zenodo"))

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(ZENODO_DIR, exist_ok=True)

print(f"Opening database: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# 1. Create scada_10m table
cur.execute("""
CREATE TABLE IF NOT EXISTS scada_10m (
  timestamp TEXT PRIMARY KEY,
  wind_speed_mean REAL,
  wind_speed_max REAL,
  wind_speed_min REAL,
  active_power_mean REAL,
  active_power_max REAL,
  active_power_min REAL,
  rotor_speed_mean REAL,
  rotor_speed_max REAL,
  nacelle_position REAL,
  energy_produced REAL,
  operating_hours REAL,
  source TEXT
);
""")

# Index on timestamp
cur.execute("CREATE INDEX IF NOT EXISTS idx_scada_10m_ts ON scada_10m(timestamp);")

# 2. Create status_events table
cur.execute("""
CREATE TABLE IF NOT EXISTS status_events (
  observed_at TEXT PRIMARY KEY,
  asset TEXT,
  event_family TEXT,
  main_status INTEGER,
  substatus INTEGER,
  fault_message_flag INTEGER,
  warning_message_flag INTEGER,
  service_flag INTEGER,
  raw_value TEXT,
  source TEXT
);
""")

cur.execute("CREATE INDEX IF NOT EXISTS idx_status_events_at ON status_events(observed_at);")

# 3. Create daily_rollup VIEW grouped by Europe/London date
# UK daylight saving (BST): UTC+1 between late March and late October, otherwise UTC+0 (GMT).
# We compute date_london using SQLite's datetime modifiers.
cur.execute("DROP VIEW IF EXISTS daily_rollup;")
cur.execute("""
CREATE VIEW daily_rollup AS
WITH adjusted AS (
  SELECT *,
    strftime('%Y-%m-%d', datetime(timestamp, CASE 
      WHEN strftime('%m', timestamp) IN ('04','05','06','07','08','09') THEN '+1 hour'
      WHEN strftime('%m', timestamp) = '03' AND strftime('%d', timestamp) >= '25' THEN '+1 hour'
      WHEN strftime('%m', timestamp) = '10' AND strftime('%d', timestamp) < '25' THEN '+1 hour'
      ELSE '+0 hour'
    END)) AS date_london
  FROM scada_10m
)
SELECT 
  date_london,
  MIN(timestamp) AS start_utc,
  MAX(timestamp) AS end_utc,
  COUNT(*) AS sample_count,
  ROUND(MAX(energy_produced) - MIN(energy_produced), 1) AS energy_kwh,
  ROUND(AVG(wind_speed_mean), 2) AS wind_speed_avg,
  ROUND(MAX(wind_speed_max), 2) AS wind_speed_max,
  ROUND(AVG(active_power_mean), 1) AS active_power_avg,
  ROUND(MAX(active_power_max), 1) AS active_power_peak,
  ROUND(AVG(rotor_speed_mean), 2) AS rotor_speed_avg
FROM adjusted
GROUP BY date_london;
""")

conn.commit()

# --- Ingest Zenodo 10m parquet ---
ten_m_files = [f for f in ["ace-wind-2026-10m-latest.parquet", "ace-wind-2026-10m.parquet"] 
               if os.path.exists(os.path.join(ZENODO_DIR, f))]

if ten_m_files:
    target_10m = os.path.join(ZENODO_DIR, ten_m_files[0])
    print(f"Reading Zenodo 10m: {target_10m}")
    df_10m = pq.read_table(target_10m).to_pandas()
    df_wec = df_10m[df_10m['family'] == 'wecstd'].sort_values('observed_at')
    print(f"Found {len(df_wec)} wecstd rows in 10m parquet.")

    records = []
    for _, row in df_wec.iterrows():
        ts = row['observed_at'].strftime("%Y-%m-%dT%H:%M:%SZ")
        vals = dict(row['values'])
        records.append((
            ts,
            vals.get('wind_speed_mean'),
            vals.get('wind_speed_max'),
            vals.get('wind_speed_min'),
            vals.get('active_power_mean'),
            vals.get('active_power_max'),
            vals.get('active_power_min'),
            vals.get('rotor_speed_mean'),
            vals.get('rotor_speed_max'),
            vals.get('nacelle_position'),
            vals.get('energy_produced'),
            vals.get('operating_hours'),
            'zenodo'
        ))

    print(f"Inserting/upserting {len(records)} 10m rows into scada_10m...")
    cur.executemany("""
    INSERT INTO scada_10m (
      timestamp, wind_speed_mean, wind_speed_max, wind_speed_min,
      active_power_mean, active_power_max, active_power_min,
      rotor_speed_mean, rotor_speed_max, nacelle_position,
      energy_produced, operating_hours, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(timestamp) DO UPDATE SET
      wind_speed_mean=excluded.wind_speed_mean,
      wind_speed_max=excluded.wind_speed_max,
      wind_speed_min=excluded.wind_speed_min,
      active_power_mean=excluded.active_power_mean,
      active_power_max=excluded.active_power_max,
      active_power_min=excluded.active_power_min,
      rotor_speed_mean=excluded.rotor_speed_mean,
      rotor_speed_max=excluded.rotor_speed_max,
      nacelle_position=excluded.nacelle_position,
      energy_produced=excluded.energy_produced,
      operating_hours=excluded.operating_hours,
      source=excluded.source;
    """, records)
    conn.commit()
    print(f"scada_10m now has {cur.execute('SELECT COUNT(*) FROM scada_10m').fetchone()[0]} rows.")

# --- Ingest Zenodo events parquet ---
event_files = [f for f in ["ace-wind-2026-events-latest.parquet", "ace-wind-2026-events.parquet"]
               if os.path.exists(os.path.join(ZENODO_DIR, f))]

if event_files:
    target_ev = os.path.join(ZENODO_DIR, event_files[0])
    print(f"Reading Zenodo events: {target_ev}")
    df_ev = pq.read_table(target_ev).to_pandas()
    df_status = df_ev[df_ev['event_family'] == 'wec_status'].sort_values('observed_at')
    print(f"Found {len(df_status)} wec_status rows.")

    ev_records = []
    for _, row in df_status.iterrows():
        ts = row['observed_at'].strftime("%Y-%m-%dT%H:%M:%SZ")
        raw = str(row.get('raw_value', ''))
        parts = [int(p) if p.isdigit() else 0 for p in raw.split(',')]
        while len(parts) < 7:
            parts.append(0)
        main_st, sub_st, fault_flag, info, add_info, warn_flag, srv_flag = parts[:7]

        ev_records.append((
            ts,
            str(row.get('asset', 'wec-1')),
            'wec_status',
            main_st,
            sub_st,
            fault_flag,
            warn_flag,
            srv_flag,
            raw,
            'zenodo'
        ))

    print(f"Inserting/upserting {len(ev_records)} events into status_events...")
    cur.executemany("""
    INSERT INTO status_events (
      observed_at, asset, event_family,
      main_status, substatus, fault_message_flag,
      warning_message_flag, service_flag, raw_value, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(observed_at) DO UPDATE SET
      main_status=excluded.main_status,
      substatus=excluded.substatus,
      fault_message_flag=excluded.fault_message_flag,
      warning_message_flag=excluded.warning_message_flag,
      service_flag=excluded.service_flag,
      raw_value=excluded.raw_value,
      source=excluded.source;
    """, ev_records)
    conn.commit()
    print(f"status_events now has {cur.execute('SELECT COUNT(*) FROM status_events').fetchone()[0]} rows.")

print("Ingest script completed successfully.")
conn.close()
