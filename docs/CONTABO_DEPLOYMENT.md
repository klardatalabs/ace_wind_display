# Contabo preview — 12 October 2026

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

The app uses `HISTORY_BACKEND=legacy`; the independent collector uses `timescale`.
Live readings, screens and Ask Ace work. Historical screens/chat remain on their
existing readers; Grafana and CSV use the new table. Do not stop the legacy jobs
until historical reader acceptance and cutover are complete.

## Verified data and checks

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

- Zenodo's metadata API returns HTTP 403 from this server. Daily checks report the
  failure. Supplied files were verified and imported manually; future automatic
  release downloads are not yet proven. Local import remains available.
- Backups run on the server. The laptop copy is a one-time off-server copy;
  automatic off-server backup delivery still needs a destination.
- `acewind` has a locked password and no SSH key or administrator privileges.
  Deployment used root SSH. Set up a passphrase-protected key locally and install
  its public key for `acewind`; change the root password that was shared in chat.
- Review the screens and graphs before switching historical readers. For cutover,
  change app `HISTORY_BACKEND` to `timescale` in `compose.contabo.yml`, stop the
  independent collector and restart the app. The app then maintains history itself.
  Roll back by restoring app `legacy` and restarting the separate collector.
- The free `sslip.io` hostname is for the preview. A purchased domain can replace it later.

## Basic operations

From `/home/acewind/weston-wind`, use `docker compose -f compose.contabo.yml ps`
to check services, and `logs --tail 50 collector` or `logs --tail 50 backup` for outcomes.
Never use `down -v`: it removes stored database volumes.
Grafana's username is `acewind`. Its password is in the private laptop file
`data/operations/contabo/contabo-login.txt`, outside Git. Keep it private.
