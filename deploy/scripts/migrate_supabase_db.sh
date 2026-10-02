#!/usr/bin/env bash
# One-off: copy the app's `public` schema (tables, data, indexes, sequences and
# alembic_version) from the old Supabase project into a new, empty one, then
# compare row counts table by table. The old database is only read.
#
# Usage (on the EC2 instance, app stopped):
#   OLD_DB=<old session pooler URL> NEW_DB=<new session pooler URL> bash migrate_supabase_db.sh
set -euo pipefail

: "${OLD_DB:?set OLD_DB to the OLD project's session pooler URL}"
: "${NEW_DB:?set NEW_DB to the NEW project's session pooler URL}"

PG_IMAGE=postgres:17-alpine
WORK="$HOME/db-migration"
mkdir -p "$WORK"
pg() { docker run --rm -v "$WORK":/work -w /work "$PG_IMAGE" "$@"; }

COUNT_SQL="select table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1"

echo "==> Server versions (old, new)"
pg psql "$OLD_DB" -Atc "show server_version"
pg psql "$NEW_DB" -Atc "show server_version"

echo "==> Checking the new database is empty"
existing=$(pg psql "$NEW_DB" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$existing" != "0" ]; then
  echo "The new database already has $existing table(s) in public. Aborting so nothing is overwritten."
  exit 1
fi

echo "==> Recreating the old database's extensions in the new one"
# pg_dump --schema=public skips extensions, but indexes depend on them
# (e.g. pg_trgm for the trigram search indexes), and must live in the same schema.
pg psql "$OLD_DB" -Atc "select extname || ' ' || extnamespace::regnamespace from pg_extension where extname <> 'plpgsql' order by 1" > "$WORK/extensions.txt"
while read -r name schema; do
  if pg psql "$NEW_DB" -qc "create extension if not exists \"$name\" with schema $schema" >/dev/null 2>&1; then
    echo "   ok: $name ($schema)"
  else
    echo "   skipped: $name ($schema) — not creatable here; fine unless the restore below fails on it"
  fi
done < "$WORK/extensions.txt"

echo "==> Dumping the old database (public schema)"
pg pg_dump "$OLD_DB" --schema=public --no-owner --no-privileges --format=custom --file=/work/hybent_public.dump
ls -lh "$WORK/hybent_public.dump"

# The new project already has a public schema; don't try to create it again.
pg pg_restore --list /work/hybent_public.dump | grep -vE 'SCHEMA - public |COMMENT - SCHEMA public ' > "$WORK/restore.list"

echo "==> Restoring into the new database (single transaction: all or nothing)"
pg pg_restore --dbname="$NEW_DB" --no-owner --no-privileges --single-transaction --exit-on-error \
  --use-list=/work/restore.list /work/hybent_public.dump

echo "==> Refreshing planner statistics"
pg psql "$NEW_DB" -qc "analyze"

echo "==> Comparing row counts"
pg psql "$OLD_DB" -Atc "$COUNT_SQL" > "$WORK/counts_old.txt"
pg psql "$NEW_DB" -Atc "$COUNT_SQL" > "$WORK/counts_new.txt"
if diff "$WORK/counts_old.txt" "$WORK/counts_new.txt" >/dev/null; then
  echo "   all $(wc -l < "$WORK/counts_old.txt" | tr -d ' ') tables match"
else
  echo "   MISMATCH (old vs new):"
  diff "$WORK/counts_old.txt" "$WORK/counts_new.txt" || true
  exit 1
fi

echo "==> Alembic version (old, new)"
pg psql "$OLD_DB" -Atc "select version_num from alembic_version"
pg psql "$NEW_DB" -Atc "select version_num from alembic_version"

echo "==> Database migration complete"
