#!/bin/sh
set -eu
umask 077
backup() {
  mkdir -p /backups/daily /backups/monthly /data/operations /data/zenodo
  day=$(date -u +%Y-%m-%d)
  directory=$(mktemp -d "/backups/daily/$day-XXXXXX")
  pg_dump --format=custom --no-owner --no-acl --file="$directory/history.dump"
  tar -czf "$directory/files.tgz" -C /data operations zenodo
  (cd "$directory" && sha256sum history.dump files.tgz > checksums.sha256)
  month=$(date -u +%Y-%m)
  if [ ! -d "/backups/monthly/$month" ]; then cp -R "$directory" "/backups/monthly/$month"; fi
  if [ "${BACKUP_COPY_OFFHOST:-0}" = 1 ]; then
    mkdir -p /offhost/daily /offhost/monthly
    cp -R "$directory" /offhost/daily/
    if [ ! -d "/offhost/monthly/$month" ]; then cp -R "/backups/monthly/$month" /offhost/monthly/; fi
  fi
  # Retention is applied only after a successful dump and optional off-host copy.
  find /backups/daily -mindepth 1 -maxdepth 1 -type d -mtime +13 -exec rm -r {} +
  ls -1 /backups/monthly | sort -r | tail -n +7 | while IFS= read -r old; do
    case "$old" in 20[0-9][0-9]-[01][0-9]) rm -r "/backups/monthly/$old";; esac
  done
  printf '{"ok":true,"lastSuccessAt":"%s","offhost":%s}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${BACKUP_COPY_OFFHOST:-0}" > /data/operations/backup.json.tmp
  mv /data/operations/backup.json.tmp /data/operations/backup.json
  chmod 644 /data/operations/backup.json
  echo "History backup completed: $day"
  echo "$day" > /backups/last-success-day
  date -u +%Y-%m-%dT%H:%M:%SZ > /backups/last-success-at
}
if [ "${1:-once}" = loop ]; then
  last=$(cat /backups/last-success-day 2>/dev/null || true)
  first=1
  while true; do
    day=$(date -u +%Y-%m-%d)
    if [ "$last" != "$day" ] && { [ "$(date -u +%H)" = 02 ] || [ "$first" = 1 ]; }; then
      # A separate shell preserves errexit even though the result is tested by if.
      if sh "$0" once; then last="$day"; first=0;
      else
        first=1
        mkdir -p /data/operations
        previous=$(cat /backups/last-success-at 2>/dev/null || true)
        printf '{"ok":false,"lastAttemptAt":"%s","lastSuccessAt":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$previous" > /data/operations/backup.json.tmp
        mv /data/operations/backup.json.tmp /data/operations/backup.json
        chmod 644 /data/operations/backup.json
        echo 'History backup failed; retrying in one minute' >&2
      fi
    else
      first=0
    fi
    sleep 60
  done
else backup; fi
