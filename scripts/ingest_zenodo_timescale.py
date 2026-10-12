"""Fill missing canonical history observations; never overwrite API or archive rows."""
import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path

FIELDS = ['wind_speed_mean', 'wind_speed_max', 'active_power_mean', 'active_power_max', 'energy_produced']
COLUMNS = ['wind_speed_mean_ms', 'wind_speed_max_ms', 'active_power_mean_kw', 'active_power_max_kw', 'energy_meter_kwh']

def normalize_values(values):
    result = []
    for i, field in enumerate(FIELDS):
        value = values.get(field)
        good = isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)
        if i in (0, 1, 4):
            good = good and value >= 0
        if i in (0, 1):
            good = good and value <= 100
        if i in (2, 3):
            good = good and -1000 <= value <= 6500
        result.append(float(value) if good else None)
    for mean, maximum in ((0, 1), (2, 3)):
        if result[mean] is not None and result[maximum] is not None and result[maximum] < result[mean]:
            result[maximum] = None
    return result

def ingest(file, release, validate_files=()):
    import pyarrow.parquet as pq
    import psycopg2
    from psycopg2.extras import execute_values

    asset = os.environ.get('HISTORY_ASSET', 'wec-1')
    for candidate in [file, *validate_files]:
        pq.read_metadata(candidate)
    parquet = pq.ParquetFile(file)
    required = {'observed_at', 'family', 'asset', 'values'}
    if not required.issubset(parquet.schema_arrow.names):
        raise ValueError('Archive schema is missing required columns')
    conn = psycopg2.connect(host=os.environ.get('PGHOST', '127.0.0.1'), port=os.environ.get('PGPORT', '5432'),
        user=os.environ.get('PGUSER', 'ace_user'), password=os.environ.get('PGPASSWORD'), dbname=os.environ.get('PGDATABASE', 'ace_wind'), connect_timeout=10)
    report = {'release': release, 'read': 0, 'rejected': 0, 'inserted': 0, 'overlap': 0, 'mismatches': {}, 'archive_corrections': {}, 'differences': []}
    seen = {}
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute('SELECT pg_try_advisory_lock(877001)')
            if not cur.fetchone()[0]:
                raise RuntimeError('Another history job is running')
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute('CREATE TEMP TABLE archive_stage (LIKE history.scada_10m INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES) ON COMMIT PRESERVE ROWS')
            selected = list(required) + (['quality'] if 'quality' in parquet.schema_arrow.names else [])
            for batch in parquet.iter_batches(batch_size=2000, columns=selected):
                records = []
                for row in batch.to_pylist():
                    if row['family'] != 'wecstd' or row['asset'] != asset:
                        continue
                    report['read'] += 1
                    ts = row['observed_at']
                    if not isinstance(ts, dt.datetime) or ts.tzinfo is None or ts.microsecond or ts.second or ts.minute % 10:
                        raise ValueError('Invalid or unaligned archive timestamp')
                    ts = ts.astimezone(dt.timezone.utc)
                    if ts > dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=15):
                        raise ValueError('Archive contains future observations')
                    if row.get('quality') not in (None, 'good'):
                        report['rejected'] += 1
                        continue
                    values = normalize_values(dict(row['values']))
                    if all(v is None for v in values):
                        report['rejected'] += 1
                        continue
                    if ts in seen:
                        if seen[ts] != values:
                            raise ValueError('Conflicting duplicate archive observation')
                        continue
                    seen[ts] = values
                    records.append((asset, ts, *values, 'zenodo', release, 'complete' if all(v is not None for v in values) else 'partial'))
                if records:
                    # Conflicting duplicate observations fail the release instead of selecting by file order.
                    execute_values(cur, f'INSERT INTO archive_stage (asset_id,observed_at_utc,{",".join(COLUMNS)},source,source_release,quality) VALUES %s', records)
            if not seen:
                raise ValueError('Empty or unusable wecstd archive')
            cur.execute("SELECT COUNT(*) FROM archive_stage z JOIN history.scada_10m a USING(asset_id,observed_at_utc) WHERE a.source='live'")
            report['overlap'] = cur.fetchone()[0]
            for column in COLUMNS:
                cur.execute(f"SELECT COUNT(*) FILTER(WHERE a.{column} IS DISTINCT FROM z.{column}),MAX(ABS(a.{column}-z.{column})) FROM archive_stage z JOIN history.scada_10m a USING(asset_id,observed_at_utc) WHERE a.source='live'")
                count, difference = cur.fetchone()
                report['mismatches'][column] = {'count': count, 'max_absolute_difference': difference}
                cur.execute(f"SELECT COUNT(*) FILTER(WHERE a.{column} IS DISTINCT FROM z.{column}),MAX(ABS(a.{column}-z.{column})) FROM archive_stage z JOIN history.scada_10m a USING(asset_id,observed_at_utc) WHERE a.source='zenodo'")
                count, difference = cur.fetchone()
                report['archive_corrections'][column] = {'count': count, 'max_absolute_difference': difference}
            condition = ' OR '.join(f'a.{c} IS DISTINCT FROM z.{c}' for c in COLUMNS)
            cur.execute(f"SELECT z.observed_at_utc,ROW_TO_JSON(a),ROW_TO_JSON(z) FROM archive_stage z JOIN history.scada_10m a USING(asset_id,observed_at_utc) WHERE a.source='live' AND ({condition}) ORDER BY z.observed_at_utc LIMIT 20")
            report['differences'] = [{'observed_at_utc': ts.isoformat(), 'api': a, 'zenodo': z} for ts, a, z in cur.fetchall()]
            cur.execute(f'INSERT INTO history.scada_10m (asset_id,observed_at_utc,{",".join(COLUMNS)},source,source_release,quality) SELECT asset_id,observed_at_utc,{",".join(COLUMNS)},source,source_release,quality FROM archive_stage ON CONFLICT(asset_id,observed_at_utc) DO NOTHING')
            report['inserted'] = cur.rowcount
            cur.execute('SELECT MIN(observed_at_utc),MAX(observed_at_utc) FROM archive_stage')
            first, last = cur.fetchone()
            report['first'] = first.isoformat()
            report['latest'] = last.isoformat()
            cur.execute('SELECT COUNT(*) FROM (SELECT energy_meter_kwh,LAG(energy_meter_kwh) OVER(ORDER BY observed_at_utc) AS previous FROM archive_stage WHERE energy_meter_kwh IS NOT NULL) meters WHERE energy_meter_kwh<previous')
            report['meter_resets'] = cur.fetchone()[0]
        conn.commit()
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("CALL refresh_continuous_aggregate('history.daily_base',%s,%s)", (first-dt.timedelta(days=2), last+dt.timedelta(days=2)))
        return report
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True)
    parser.add_argument('--release', required=True)
    parser.add_argument('--validate-file', action='append', default=[])
    args = parser.parse_args()
    if not args.release.startswith('10.5281/zenodo.') or not args.release.removeprefix('10.5281/zenodo.').isdigit():
        parser.error('Use the immutable Zenodo record DOI as --release')
    report = ingest(args.file, args.release, args.validate_file)
    operations = Path(os.environ.get('HISTORY_OPERATIONS_DIR', Path(os.environ.get('DATA_DIR', 'data')) / 'operations'))
    operations.mkdir(parents=True, exist_ok=True)
    target = operations / f'zenodo-report-{args.release.split(".")[-1]}.json'
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(report, default=str, indent=2), encoding='utf8')
    temporary.replace(target)
    print(json.dumps(report, default=str))
