#!/bin/sh
set -eu
: "${RESTORE_DATABASE:?Set a NEW database name ending in _restore}"
case "$RESTORE_DATABASE" in *_restore) ;; *) echo 'Restore target must end in _restore' >&2; exit 1;; esac
: "${1:?Provide a backup directory}"
directory=$(cd "$1" && pwd)
(cd "$directory" && sha256sum -c checksums.sha256)
# createdb fails if the target exists: this command cannot overwrite a working database.
createdb "$RESTORE_DATABASE"
psql -d "$RESTORE_DATABASE" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS timescaledb; SELECT timescaledb_pre_restore();'
pg_restore --exit-on-error --no-owner --no-acl -d "$RESTORE_DATABASE" "$directory/history.dump"
psql -d "$RESTORE_DATABASE" -v ON_ERROR_STOP=1 -c 'SELECT timescaledb_post_restore(); SELECT COUNT(*),MIN(observed_at_utc),MAX(observed_at_utc) FROM history.scada_10m;'
echo 'Restore complete. Verify daily totals and restore files.tgz separately before switching the app.'
