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

echo "==> [entrypoint] Starting Uvicorn..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 2 \
    --loop uvloop \
    --http httptools
