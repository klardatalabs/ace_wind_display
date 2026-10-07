import os
import glob
import psycopg2
from psycopg2.extras import execute_values
import pyarrow.parquet as pq
import pandas as pd

DB_HOST = os.environ.get("PGHOST", "127.0.0.1")
DB_PORT = int(os.environ.get("PGPORT", "5432"))
DB_USER = os.environ.get("PGUSER", "ace_user")
DB_PASS = os.environ.get("PGPASSWORD", "ace_password")
DB_NAME = os.environ.get("PGDATABASE", "ace_wind")

ZENODO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "zenodo"))

def ingest():
    print(f"Connecting to TimescaleDB at {DB_HOST}:{DB_PORT}/{DB_NAME}...")
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASS,
        dbname=DB_NAME
    )
    conn.autocommit = False
    cur = conn.cursor()

    # Find 10m files (sort so latest is processed last)
    ten_m_files = glob.glob(os.path.join(ZENODO_DIR, "*10m*.parquet"))
    ten_m_files.sort(key=lambda p: os.path.getmtime(p))

    min_ts_overall = None
    max_ts_overall = None
    total_10m_inserted = 0

    for fpath in ten_m_files:
        print(f"Processing 10m file: {os.path.basename(fpath)}")
        df = pq.read_table(fpath).to_pandas()
        df_wec = df[df['family'] == 'wecstd'].sort_values('observed_at')
        if df_wec.empty:
            continue

        records = []
        for _, row in df_wec.iterrows():
            ts = row['observed_at'].to_pydatetime()
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

        if records:
            file_min_ts = records[0][0]
            file_max_ts = records[-1][0]
            if min_ts_overall is None or file_min_ts < min_ts_overall:
                min_ts_overall = file_min_ts
            if max_ts_overall is None or file_max_ts > max_ts_overall:
                max_ts_overall = file_max_ts

            query = """
            INSERT INTO scada_10m (
                ts, wind_speed_mean, wind_speed_max, wind_speed_min,
                active_power_mean, active_power_max, active_power_min,
                rotor_speed_mean, rotor_speed_max, nacelle_position_mean,
                energy_produced, operating_hours, source
            ) VALUES %s
            ON CONFLICT (ts) DO UPDATE SET
                wind_speed_mean = EXCLUDED.wind_speed_mean,
                wind_speed_max = EXCLUDED.wind_speed_max,
                wind_speed_min = EXCLUDED.wind_speed_min,
                active_power_mean = EXCLUDED.active_power_mean,
                active_power_max = EXCLUDED.active_power_max,
                active_power_min = EXCLUDED.active_power_min,
                rotor_speed_mean = EXCLUDED.rotor_speed_mean,
                rotor_speed_max = EXCLUDED.rotor_speed_max,
                nacelle_position_mean = EXCLUDED.nacelle_position_mean,
                energy_produced = EXCLUDED.energy_produced,
                operating_hours = EXCLUDED.operating_hours,
                source = 'zenodo';
            """
            execute_values(cur, query, records, page_size=2000)
            conn.commit()
            total_10m_inserted += len(records)
            print(f"  Upserted {len(records)} rows from {os.path.basename(fpath)}")

    print(f"Total 10m rows upserted: {total_10m_inserted}")

    # Process events parquets
    event_files = glob.glob(os.path.join(ZENODO_DIR, "*event*.parquet"))
    event_files.sort(key=lambda p: os.path.getmtime(p))
    total_events_inserted = 0

    for fpath in event_files:
        print(f"Processing events file: {os.path.basename(fpath)}")
        df = pq.read_table(fpath).to_pandas()
        df_status = df[df['event_family'] == 'wec_status'].sort_values('observed_at')
        if df_status.empty:
            continue

        seen_keys = set()
        ev_records = []
        for _, row in df_status.iterrows():
            ts = row['observed_at'].to_pydatetime()
            node_id = str(row.get('opc_node_id', ''))
            key = (ts, node_id)
            if key in seen_keys:
                continue
            seen_keys.add(key)

            raw = str(row.get('raw_value', ''))
            parts = [int(p) if p.isdigit() else 0 for p in raw.split(',')]
            while len(parts) < 7:
                parts.append(0)
            main_st, sub_st, fault_flag, info, add_info, warn_flag, srv_flag = parts[:7]

            ev_records.append((
                ts,
                str(row.get('asset', 'wec-1')),
                node_id,
                'wec_status',
                main_st,
                sub_st,
                fault_flag,
                warn_flag,
                srv_flag,
                raw,
                'zenodo'
            ))

        if ev_records:
            ev_query = """
            INSERT INTO status_events (
                observed_at, asset, opc_node_id, event_family,
                main_status, substatus, fault_message_flag,
                warning_message_flag, service_flag, raw_value, source
            ) VALUES %s
            ON CONFLICT (observed_at, opc_node_id) DO UPDATE SET
                main_status = EXCLUDED.main_status,
                substatus = EXCLUDED.substatus,
                fault_message_flag = EXCLUDED.fault_message_flag,
                warning_message_flag = EXCLUDED.warning_message_flag,
                service_flag = EXCLUDED.service_flag,
                raw_value = EXCLUDED.raw_value,
                source = 'zenodo';
            """
            execute_values(cur, ev_query, ev_records, page_size=2000)
            conn.commit()
            total_events_inserted += len(ev_records)
            print(f"  Upserted {len(ev_records)} events from {os.path.basename(fpath)}")

    print(f"Total status events upserted: {total_events_inserted}")

    # Refresh continuous aggregate daily_rollup for the affected range
    if min_ts_overall and max_ts_overall:
        conn.commit()
        conn.autocommit = True
        print(f"Refreshing continuous aggregate daily_rollup from {min_ts_overall} to {max_ts_overall}...")
        cur.execute(
            "CALL refresh_continuous_aggregate('daily_rollup', %s, %s);",
            (min_ts_overall, max_ts_overall)
        )
        print("Continuous aggregate daily_rollup refreshed successfully.")

    cur.close()
    conn.close()
    print("Zenodo TimescaleDB ingest complete!")

if __name__ == "__main__":
    ingest()
