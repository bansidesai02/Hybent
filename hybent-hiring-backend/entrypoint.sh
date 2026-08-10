#!/bin/bash
#!/bin/bash
set -e

echo "==> [entrypoint] Waiting for PostgreSQL to be ready..."

MAX_RETRIES=30
COUNT=0
until python -c "
import asyncio, asyncpg, os, sys, socket

# Monkeypatch socket.getaddrinfo to force IPv4 resolution.
# This prevents '[Errno 101] Network is unreachable' errors on Render/Docker environments
# that lack outbound IPv6 routing.
orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(*args, **kwargs):
    responses = orig_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET]
socket.getaddrinfo = getaddrinfo_ipv4

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
        alembic upgrade head
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
    echo "==> [entrypoint] Starting Uvicorn..."
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers "${WEB_CONCURRENCY:-2}" \
        --loop uvloop \
        --http httptools
fi
