#!/usr/bin/env bash
# Nightly logical backup of the app database (Supabase Postgres).
#
# The Supabase project is on the Free plan, which gives no backups we can
# restore from, so this dump is the backup. It reads DATABASE_URL from
# deploy/.env.prod, dumps it with pg_dump (custom format, compressed) into
# $BACKUP_DIR, keeps $BACKUP_KEEP_DAYS days of dumps, and copies each new dump
# to S3 when BACKUP_S3_URI is set (needs the aws CLI and the instance's IAM
# role allowed to s3:PutObject there).
#
# Usage (EC2): bash ~/hybent/deploy/scripts/backup_db.sh
# Cron (03:15 UTC daily):
#   15 3 * * * bash $HOME/hybent/deploy/scripts/backup_db.sh >> $HOME/hybent-backups/backup.log 2>&1
# Restore into an EMPTY database:
#   docker run --rm -i -e TARGET postgres:17-alpine sh -c 'pg_restore --no-owner --no-privileges -d "$TARGET"' < dump.pgdump
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$DEPLOY_DIR/.env.prod"
BACKUP_DIR="${BACKUP_DIR:-$HOME/hybent-backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
PG_IMAGE=postgres:17-alpine

[ -f "$ENV_FILE" ] || { echo "$(date -u +%FT%TZ) $ENV_FILE is missing"; exit 1; }

# Read only DATABASE_URL from the env file, without sourcing the whole file.
DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
[ -n "$DATABASE_URL" ] || { echo "$(date -u +%FT%TZ) DATABASE_URL is empty in $ENV_FILE"; exit 1; }
# The app's async driver prefix isn't something pg_dump understands.
DATABASE_URL="${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}"
DATABASE_URL="${DATABASE_URL/postgres:\/\//postgresql://}"
export DATABASE_URL

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/hybent_${STAMP}.pgdump"
# A failed run never leaves a half-written dump behind.
trap 'rm -f "$OUT.partial"' EXIT

echo "$(date -u +%FT%TZ) ==> Dumping to $OUT"
# The URL goes in through the environment, so it never shows up in `ps`.
docker run --rm -e DATABASE_URL "$PG_IMAGE" \
  sh -c 'pg_dump --format=custom --compress=6 --no-owner --no-privileges --schema=public "$DATABASE_URL"' \
  > "$OUT.partial"

# A dump that pg_restore can't list is not a backup.
docker run --rm -i "$PG_IMAGE" pg_restore --list < "$OUT.partial" > /dev/null
mv "$OUT.partial" "$OUT"
chmod 600 "$OUT"
echo "$(date -u +%FT%TZ) ==> OK ($(du -h "$OUT" | cut -f1))"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  aws s3 cp --only-show-errors "$OUT" "${BACKUP_S3_URI%/}/$(basename "$OUT")"
  echo "$(date -u +%FT%TZ) ==> Copied to $BACKUP_S3_URI"
fi

find "$BACKUP_DIR" -name 'hybent_*.pgdump' -mtime +"$BACKUP_KEEP_DAYS" -delete
