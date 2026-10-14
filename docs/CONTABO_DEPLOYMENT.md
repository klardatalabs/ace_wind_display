# Contabo deployment — updated 14 October 2026

Website: https://we-do-wind.89-117-57-40.sslip.io/

Grafana: https://we-do-wind.89-117-57-40.sslip.io/grafana/

Stored coverage: https://we-do-wind.89-117-57-40.sslip.io/api/history/health

Combined CSV: https://we-do-wind.89-117-57-40.sslip.io/api/history/export?format=csv

## What runs

The app is in `/home/acewind/weston-wind` on `89.117.57.40`.
`compose.contabo.yml` runs a separate database, Redis, app, history collector,
Grafana and backup job under the Docker project `we-do-wind`.
App and collector run as the existing `acewind` UID/GID 1003.
Database and Redis have no public ports. App and Grafana bind to localhost.
`deploy/nginx.contabo.conf` adds a separate HTTPS website to the existing Nginx.
The existing sites, Grafana, InfluxDB and MLflow were not redeployed.
HTTPS renewal is configured by Certbot.

The app uses `HISTORY_BACKEND=timescale` and runs the sole history worker.
Historical screens, Ask Ace history, Grafana and CSV read the new table.
Today's energy is an estimate from that table, with explicit labels and chat metadata.
Current turbine readings stay in memory and remain live. The separate collector
is stopped and behind the `history-test` profile. Legacy stores remain for rollback.

## Verified data and checks

On 14 October, the missing homepage rotor and Cesium fixes from `codex/story-rail`
were brought into `history-wip` and deployed. Docker now passes the configured
map coordinates into the frontend build. The server uses the mapped ACE foundation
at `51.5378881, -2.6740022`, replacing the incorrect fallback location. Browser checks
confirmed that scrolling keeps the homepage rotor attached to its hub and the default
site view shows one turbine at ACE. Polygon cutouts expose flat satellite terrain in
small patches; devices without polygon clipping support use satellite terrain instead.
The app alone was restarted; database, backup and unrelated services were not restarted.

Initial ACE import: 11,962 complete readings, 21 July 2026 10:40 through
12 October 2026 12:10 UTC, with no missing buckets. Collection continues.
All three supplied Zenodo files matched the checksums published for release
`10.5281/zenodo.23114177`. The 10-minute import checked 10,304 turbine records:
zero rejected, zero differences in retained fields, zero inserted because ACE
already supplied every overlapping time. Original files remain downloadable.

All nine Grafana panel queries passed. Live and historical chatbot replies completed.
A startup backup succeeded; restore into `ace_wind_deployment_restore` recovered
11,962 rows. That separate database is a recovery rehearsal, not an app reader.
Nightly backups run at 02:00 UTC with startup catch-up; keep 14 daily and six monthly copies.
One recovery bundle was copied to the laptop under the Git-ignored
`data/operations/contabo-private-bundle.tgz`. It contains private settings: do not share it.

## Remaining work

- The current Zenodo release was reverified and registered. Daily ACE discovery
  skips an already imported immutable release. Node metadata requests still returned
  HTTP 403 or timed out, while a Python request succeeded; automatically downloading
  a future new release remains unproven. Local verified import remains available.
- Backups run on the server. The laptop copy is a one-time off-server copy;
  automatic off-server backup delivery still needs a destination.
- `acewind` has a locked password and no SSH key or administrator privileges.
  Deployment used root SSH. Set up a passphrase-protected key locally and install
  its public key for `acewind`; change the root password that was shared in chat.
- Reader cutover completed on 14 October. To roll back, restore app `legacy` in
  `compose.contabo.yml` and `.env`, restart the app and explicitly start the collector.
- The free `sslip.io` hostname is for the preview. A purchased domain can replace it later.

## Basic operations

Before cutover, raw wind/power readings and peak records matched. Estimated total
energy was about 0.34% higher than meter-difference totals. Best-day date was corrected
to 9 October using London calendar dates. Eight targeted tests passed against an isolated
database, including clock changes, recovery, CSV, cached release checks and estimate metadata.
The frontend build passed. Pre-switch SQLite and Postgres backups were saved.
Current coverage at the switch was 12,202 complete observations with no gaps.

Manual `backup once` now overrides the default loop correctly. Nightly server backups
run at **07:30 India time (02:00 UTC)**; only one scheduled backup container remains.

From `/home/acewind/weston-wind`, use `docker compose -f compose.contabo.yml ps`
to check services, and `logs --tail 50 collector` or `logs --tail 50 backup` for outcomes.
Never use `down -v`: it removes stored database volumes.
Grafana's username is `acewind`. Its password is in the private laptop file
`data/operations/contabo/contabo-login.txt`, outside Git. Keep it private.
