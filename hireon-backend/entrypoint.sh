#!/bin/bash
set -e

echo "==> [entrypoint] Waiting for PostgreSQL to be ready..."

MAX_RETRIES=30
COUNT=0
until python -c "
import asyncio, asyncpg, os, sys

async def check():
    url = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://')
    try:
        conn = await asyncpg.connect(url)
        await conn.close()
    except Exception as e:
        sys.exit(1)

asyncio.run(check())
" 2>/dev/null; do
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

    echo "==> [entrypoint] Seeding database..."
    python seed.py
    echo "==> [entrypoint] Seeding complete."
else
    echo "==> [entrypoint] SKIP_PRESTART is true, skipping migrations and seeding."
fi

# If a command is passed to the entrypoint, execute it. 
# Otherwise, default to starting our multi-process stack.
if [ $# -gt 0 ]; then
    echo "==> [entrypoint] Executing custom command: $@"
    exec "$@"
else
    echo "==> [entrypoint] Starting Celery Worker..."
    celery -A app.celery_app worker --loglevel=info --concurrency=1 &

    echo "==> [entrypoint] Starting Celery Beat..."
    celery -A app.celery_app beat --loglevel=info &

    echo "==> [entrypoint] Starting Uvicorn..."
    # Reduce workers to 1 to fit in 512MB RAM along with Celery
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --workers 1 \
        --loop uvloop \
        --http httptools
fi
