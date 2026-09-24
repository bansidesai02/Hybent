#!/bin/bash
#!/bin/bash
set -e

echo "==> [entrypoint] Waiting for PostgreSQL to be ready..."

MAX_RETRIES=30
COUNT=0
until python -c "
import asyncio, asyncpg, os, sys

async def check():
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        print('Postgres connection check failed: DATABASE_URL environment variable is not set!', file=sys.stderr)
        sys.exit(1)
    
    url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
        
    try:
        conn = await asyncpg.connect(url)
        await conn.close()
    except Exception as e:
        try:
            import urllib.parse, socket
            parsed = urllib.parse.urlparse(url)
            host = parsed.hostname
            port = parsed.port or 5432
            print(f'DIAGNOSTIC: Attempting lookup for {host}:{port}...', file=sys.stderr)
            ips = socket.getaddrinfo(host, port)
            print(f'DIAGNOSTIC: Resolved IPs: {ips}', file=sys.stderr)
        except Exception as dns_err:
            print(f'DIAGNOSTIC: DNS lookup failed: {dns_err}', file=sys.stderr)

        print(f'Postgres connection check failed: {e}', file=sys.stderr)
        sys.exit(1)

asyncio.run(check())
"; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "==> [entrypoint] ERROR: PostgreSQL not available after $MAX_RETRIES attempts. Exiting."
    exit 1
  fi
  echo "==> [entrypoint] Postgres not ready yet (attempt $COUNT/$MAX_RETRIES). Retrying in 2s..."
  sleep 2
done

echo "==> [entrypoint] PostgreSQL is ready."

if [ "$SKIP_PRESTART" != "true" ]; then
    echo "==> [entrypoint] Running Alembic migrations..."
    if [ -d "/app/alembic" ]; then
        # The Postgres-ready check above is a quick connect+close — on Render's
        # free tier the database can still be mid-wake-up and accept that ping
        # but then time out on Alembic's own connection moments later. Without
        # a retry here, that one flaky connection crashed the whole container;
        # Render then restarted it from scratch (re-running the full 60s
        # Postgres wait), which was slow enough to blow the deploy's overall
        # timeout before Uvicorn ever got to bind its port. Retrying in place
        # is seconds, not a full container restart.
        MIGRATION_RETRIES=5
        MIGRATION_COUNT=0
        until alembic upgrade head; do
            MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
            if [ "$MIGRATION_COUNT" -ge "$MIGRATION_RETRIES" ]; then
                echo "==> [entrypoint] ERROR: Alembic migrations failed after $MIGRATION_RETRIES attempts. Exiting."
                exit 1
            fi
            echo "==> [entrypoint] Alembic migration attempt $MIGRATION_COUNT/$MIGRATION_RETRIES failed. Retrying in 3s..."
            sleep 3
        done
        echo "==> [entrypoint] Migrations complete."
    else
        echo "==> [entrypoint] No /app/alembic directory found, skipping migrations."
    fi

    if [ "$RUN_SEED" = "true" ]; then
        echo "==> [entrypoint] Seeding database..."
        python seed.py
        echo "==> [entrypoint] Seeding complete."
    else
        echo "==> [entrypoint] RUN_SEED is not true, skipping seed."
    fi
else
    echo "==> [entrypoint] SKIP_PRESTART is true, skipping migrations and seeding."
fi

# If a command is passed to the entrypoint, execute it.
# Otherwise, start only the API process. Celery runs in its own compose services.
if [ $# -gt 0 ]; then
    echo "==> [entrypoint] Executing custom command: $@"
    exec "$@"
else
    # In the Render Free tier, we cannot deploy separate background workers.
    # We run the Celery worker and beat in the background of this web container.
    #
    # Memory is the constraint here (512Mi for everything), so:
    #  -B    runs beat inside the worker's main process instead of as a
    #        separate one — a whole extra copy of the app (~135Mi) saved.
    #  prefork, concurrency=1
    #        one child runs tasks. Forked from the main process, it shares its
    #        memory pages until it writes to them, so it costs little extra.
    #  --max-memory-per-child (KiB)
    #        once the child passes ~245Mi (a big batch of resume PDFs), it is
    #        replaced after its current task instead of staying that large.
    #        Needs prefork — the previous pool=solo has no child to recycle.
    echo "==> [entrypoint] Starting Celery worker + embedded beat in background (prefork, concurrency=1)..."
    celery -A app.core.celery_app worker -B --loglevel=info \
        --pool=prefork --concurrency=1 --max-memory-per-child=250000 &
 
    echo "==> [entrypoint] Starting Uvicorn..."
    if [ "${WEB_CONCURRENCY:-1}" -gt 1 ]; then
        exec uvicorn app.main:app \
            --host 0.0.0.0 \
            --port "${PORT:-8000}" \
            --workers "${WEB_CONCURRENCY}" \
            --loop uvloop \
            --http httptools
    else
        exec uvicorn app.main:app \
            --host 0.0.0.0 \
            --port "${PORT:-8000}" \
            --loop uvloop \
            --http httptools
    fi
fi
