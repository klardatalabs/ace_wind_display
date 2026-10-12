# Maintained TimescaleDB history

The default is `HISTORY_BACKEND=legacy` until after the 28 October 2026 presentation.
The canonical path is implemented but requires explicit migration, validation and cutover.
No application startup runs that migration. Never use `docker compose down -v` for an upgrade.

## Current evidence and data contract

ACE's public status was inspected on 12 October 2026: `wecstd.10m` spans
21 July 2026 10:40 UTC through 12 October 2026 08:20 UTC (82.903 days).
Its daily stream spans 140 days; advertised 10m retention is 366 days.
Retention and actual coverage are different. Monthly Zenodo release reported by ACE:
`10.5281/zenodo.23114177`, covering data through 1 October UTC.
Local latest 10m archive spans 21 July–30 September, with 10,304 turbine observations.
After Phase 0 normalization the local SQLite database contains 11,825 distinct instants.

`history.scada_10m` is the sole maintained canonical measurement table. `public.*`
legacy data is preserved temporarily for rollback. The PK is asset plus observation
instant; UTC source timestamps are never rounded or shifted. Numeric measurements are
wind mean/max (m/s), power mean/max (kW), and cumulative energy meter (kWh).
Source, immutable archive release, complete/partial quality and last changed ingestion
time accompany each observation. Missing instants are computed gaps, not artificial rows.
Current power/wind/rotor/yaw/status remain ephemeral in memory/WebSocket, never inserted.
Ask Ace reads the same memory snapshot; raw live snapshots are no longer written to
Redis, whose append-only persistence would otherwise retain the supposedly ephemeral lane.
Past status events have no current historical consumer; original event downloads remain.

| Column | Unit / ACE field | Zenodo field | Required by |
|---|---|---|---|
| `asset_id` | Requested asset | `asset` | Every historical query; primary key |
| `observed_at_utc` | UTC / `timestamps` (microseconds) | `observed_at` | Every historical query; primary key |
| `wind_speed_mean_ms` | m/s / `wind_speed_mean` | `values.wind_speed_mean` | College `PowerCurvePanel.jsx`; `generationHistory.js` |
| `wind_speed_max_ms` | m/s / `wind_speed_max` | `values.wind_speed_max` | Records/comparisons in `timescaleDb.js`; history chat |
| `active_power_mean_kw` | kW / `active_power_mean` | `values.active_power_mean` | Curve, range, estimated daily energy, history chat |
| `active_power_max_kw` | kW / `active_power_max` | `values.active_power_max` | Peak records/comparisons and history chat |
| `energy_meter_kwh` | cumulative kWh / `energy_produced` | `values.energy_produced` | Counter reconciliation/reset diagnostics; never summed |
| `source` | winning `live` / `zenodo` | Assigned at import | Export, reconciliation, Grafana |
| `source_release` | null for API | Immutable record DOI | Import reproducibility and export |
| `quality` | complete/partial validation | Validation and archive quality | Coverage and export |
| `ingested_at` | UTC last changed ingestion | Assigned at import | Freshness/operational inspection |

Consumer paths: `frontend/src/pages/screens/components/PowerCurvePanel.jsx`,
`frontend/src/pages/screens/components/DailyBarsPanel.jsx`,
`frontend/src/pages/screens/useScreenData.js`, `server/db/timescaleDb.js`,
`server/chat/tools/generationHistory.js`. Numeric measurements are nullable;
the primary key, source, quality and ingestion time are mandatory.

Daily estimated energy is sum of mean net power / 6, including valid negative net power.
The meter is retained for reconciliation, never summed. Source interval start/end labeling
is still unverified, so midnight allocation is an observation-label convention, not a
claim of exact fiscal yield. London DST days have 138/144/150 expected observations.

Storage estimate (one asset, table/index only, 200–400 bytes per observation): six months
26,352 rows/5–10 MiB; 700 days 100,800/19–39 MiB; commissioning-to-12-October
approximately 186,200/36–71 MiB. Retain all available data; there is no deletion policy.
Measure all chunks/indexes with `SELECT hypertable_size('history.scada_10m');`;
`pg_total_relation_size` alone measures only the hypertable root, omitting chunk storage.

## Phase 0: protect the presentation

`npm run history:normalise` creates an online SQLite backup and recovery report under
`HISTORY_OPERATIONS_DIR`, then transactionally normalizes UTC text and prefers API rows
at duplicate instants. It is idempotent; the local run merged one duplicate.
Both legacy syncs now paginate, overlap 24 hours and avoid concurrent same-process runs.
Shared time and SQLite London dates use the timezone database instead of date heuristics.
Live input validation preserves previous good values; status/today success cannot refresh
power freshness. `npm run test:history` checks these behaviors with mocked API responses.

The optional real database test is `node --test server/history/integration.test.mjs`
with `HISTORY_TEST_DB=1`, `HISTORY_BACKEND=timescale`, `PGPORT=55433` and a disposable
`PGDATABASE` ending in `_test`. It intentionally rebuilds ONLY the history schema in that guarded test database;
never point it at an application database. It covers DST, corrections/replay, failed-page
checkpoints, writer locks and continued live polling during historical database failure.

## Prepare and migrate after the presentation

1. Supply strong `PGPASSWORD`, `GRAFANA_ADMIN_PASSWORD` and `GRAFANA_DB_PASSWORD` in `.env`.
   Existing process environment takes priority over `.env`. Keep `HISTORY_BACKEND=legacy`.
   If an existing database volume has different credentials, use its actual credentials;
   changing Compose environment does not rotate users in an existing database.
2. Start the existing database/Redis and build the portable app:
   `docker compose --profile app up -d --build`. Choose tested image versions in the
   environment. Do not downgrade an existing Timescale volume to an older image;
   restore into a separate matching-version test volume before any version change.
   On Linux, create `./data`, `./data/zenodo` and `./data/operations` before starting
   the backup profile and make them writable by the app's container UID 1000.
   Existing SQLite DB/WAL files must also be writable by that UID. This avoids
   Docker creating root-owned bind directories on a fresh Quantabo deployment.
3. Back up before migration using the backup command below. Then explicitly run
   `docker compose --profile app run --rm app npm run history:migrate`.
   This creates `history.scada_10m`, the London aggregate and a read-only Grafana role;
   legacy tables and their consumers remain intact.
4. `docker compose --profile app run --rm app npm run history:sync` backfills API first.
   Inspect `data/operations/api-sync.json`: actual upstream bounds, completed checkpoint,
   fetched/changed/rejected counts. Failed pages do not advance the window checkpoint.
5. `docker compose --profile app run --rm app npm run history:zenodo` downloads a verified
   immutable release, validates checksums/Parquet, compares overlap and inserts absent
   keys only. Read the release report. Archive corrections do not overwrite existing rows.
6. Start Grafana with `docker compose --profile history up -d grafana`; visit localhost:3000.
   Query `/api/history/health` and `/api/history/export?format=csv` for canonical preview.
   Verify records, selected days, curve bins and backup/restore against old readers.
7. After acceptance, set `HISTORY_BACKEND=timescale`, restart the app and verify all
   screens/chat. The server now starts one canonical worker and no legacy syncs. Keep
   `HISTORY_SYNC_ENABLED=0` on any second app process that must not maintain history.
   Keep the old SQLite file/public schema at least 30 days; retire them manually later.

Health/cutover: all historical routes and history chat use canonical data; DB-down history
returns unavailable rather than silently using SQLite. The live stream continues; today's
stored estimate has independent stale metadata. Existing route names, arrays, JSON field
names and microsecond timestamps remain compatible. Records mean stored-period records.

## Maintenance and freshness

One completed API run schedules the next ten minutes later. Backfill uses seven-day
windows and sequential 5,000-point pages, timeouts/backoff, a persistent checkpoint and
24-hour overlap. The daily gap/partial repair pass uses the actual available API range,
independent of newer Zenodo rows. A Postgres advisory lock serializes canonical writers.
An API row can correct earlier API/Zenodo values; null corrections never erase good fields.

Release detection runs daily against ACE's verified Zenodo pointer, rather than guessing
a fixed publication date. Successful unchanged releases need no download/import. Failed
updates retain public files and are retried on the next daily check. A missed month is
recovered from a later cumulative archive; only genuine observations fill gaps.
Unrecoverable gaps outside API/archive coverage stay visible. No interpolation occurs.

`GET /api/history/health` reports actual range, partial/missing counts, lag, sync/release
receipts and database availability. The initial stale threshold is 30 minutes. Receipts
live on `/data/operations`; sanitized sync/import outcomes are also mirrored into the
table comment for Grafana, without adding another measurement table.
Grafana uses a read-only Postgres role, Europe/London dates and week/month/all calendar
windows. Today's full-day coverage is necessarily partial. Raw source counts and freshness
come from the same table. Queries do not zero-fill missing days.

## Exports

`GET /api/history/export?asset=wec-1&start=2026-07-21T10:40:00Z&end=2026-10-01T00:00:00Z&format=csv`
uses inclusive start/exclusive end; omitted bounds export available history. CSV includes
units, quality, provenance, nulls as empty cells and CC-BY attribution headers. Bounded
pages share one read-only snapshot, with stream backpressure and disconnect cleanup.
Only two exports run concurrently. Existing `/api/datasets/*` downloads remain original
archive files. Parquet combined export is deferred; CSV meets the initial requirement.

## Backups and restore

Start nightly backups: `docker compose --profile backup up -d backup` (02:00 UTC,
with startup catch-up if today's backup was missed while the laptop was asleep).
Manual backup: `docker compose --profile backup run --rm backup once`.
Backups include a consistent custom-format Postgres dump, checksums, original archives
and operational/reconciliation receipts. Retain 14 days and six monthly snapshots.
Keep the repository/version and Grafana provisioning alongside backup recovery material;
store environment secrets separately and securely, not inside receipts or logs.
The full database dump can contain existing researcher/download audit records and
signed links; keep backup directories private and protect the off-host destination.

`BACKUP_COPY_OFFHOST=0` until a real network/off-host destination is mounted through
`BACKUP_OFFHOST_PATH`. The default local folder is NOT protection against laptop loss.
Then set the flag to 1 and verify a copy from another machine. Mirror retention is a
separate destination policy; the backup job does not delete files from the remote mirror.

List backups using `docker compose --profile backup run --rm --entrypoint sh backup -c 'ls /backups/daily'`.
Restore explicitly into a NEW name ending in `_restore`:
`docker compose --profile backup run --rm --entrypoint sh -e RESTORE_DATABASE=ace_wind_restore backup /scripts/history-restore.sh /backups/daily/<snapshot>`.
The command checks checksums, refuses an existing target, brackets restore with Timescale
pre/post-restore hooks and reports counts/range. Restore `files.tgz` separately into an
empty staging directory; compare row counts, daily totals, export and coverage before
switching `PGDATABASE`. Re-run the role provisioning migration on the restored database.
Rehearse weekly while testing, monthly afterward. Default recovery point is the last
nightly backup; a restored checkpoint safely replays API overlap.

## Move to Quantabo and rollback

Use the same pinned Compose stack. Transfer a verified dump and staged archive/receipt
files, restore into a matching-version new database, configure env, and validate every
screen before enabling the worker. Bind Grafana/database locally; expose the app/Grafana
through authenticated HTTPS on Quantabo. Do not enable workers on both hosts against the
same database. DNS, available RAM/disk and the off-host backup destination remain deployment
inputs; no assumption about a Quantabo-specific filesystem path is embedded in code.

Rollback: set `HISTORY_BACKEND=legacy` and restart the previous readers/legacy jobs.
The canonical worker stops on restart; the preserved public schema/SQLite resume their
existing contracts. Do not delete canonical or legacy data during rollback. Return to
`HISTORY_BACKEND=timescale` only after correcting and verifying the failed acceptance check.
