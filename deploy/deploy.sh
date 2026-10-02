#!/usr/bin/env bash
# Usage: ./deploy.sh <image-tag>
# Switches the stack to that backend image tag, waits for /health, and rolls
# back to the previous tag if the new one never becomes healthy.
set -euo pipefail
cd "$(dirname "$0")"

NEW_TAG="${1:?usage: ./deploy.sh <image-tag>}"
COMPOSE="docker compose -f docker-compose.prod.yml"

[ -f .env.prod ] || { echo "deploy/.env.prod is missing"; exit 1; }
grep -q '^BACKEND_IMAGE_REPO=' .env 2>/dev/null || { echo "deploy/.env is missing BACKEND_IMAGE_REPO"; exit 1; }

set_tag() {
  if grep -q '^BACKEND_IMAGE_TAG=' .env; then
    sed -i "s|^BACKEND_IMAGE_TAG=.*|BACKEND_IMAGE_TAG=$1|" .env
  else
    echo "BACKEND_IMAGE_TAG=$1" >> .env
  fi
}

wait_healthy() {
  for _ in $(seq 1 40); do
    curl -fsS --max-time 5 http://127.0.0.1:8000/health >/dev/null 2>&1 && return 0
    sleep 3
  done
  return 1
}

PREV_TAG="$(grep '^BACKEND_IMAGE_TAG=' .env | cut -d= -f2- || true)"

echo "==> Deploying $NEW_TAG (previous: ${PREV_TAG:-none})"
set_tag "$NEW_TAG"
$COMPOSE pull backend worker
$COMPOSE up -d --remove-orphans

if wait_healthy; then
  echo "==> $NEW_TAG is healthy"
  $COMPOSE ps
  # Keeps the last week of images so a rollback doesn't need a re-pull.
  docker image prune -af --filter "until=168h" >/dev/null || true
  exit 0
fi

echo "==> $NEW_TAG failed its health check. Last backend logs:"
$COMPOSE logs --tail=80 backend || true

if [ -n "$PREV_TAG" ] && [ "$PREV_TAG" != "$NEW_TAG" ]; then
  echo "==> Rolling back to $PREV_TAG"
  set_tag "$PREV_TAG"
  $COMPOSE up -d
  if wait_healthy; then
    echo "==> Rolled back to $PREV_TAG"
  else
    echo "==> Rollback to $PREV_TAG is also unhealthy — check the logs on the server"
  fi
fi
exit 1
