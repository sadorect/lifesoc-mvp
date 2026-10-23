#!/usr/bin/env bash
# Deploy the self-hosted LifeSOC container from the current checkout.
#
#   selfhost/deploy.sh             pull main, rebuild, swap, health-check (auto-rollback on failure)
#   selfhost/deploy.sh --rollback  go back to the image that was running before the last deploy
#
# Needs: docker compose (sudo), selfhost/.env with the production variables.
set -euo pipefail

cd "$(dirname "$0")"
DOCKER="${DOCKER:-sudo docker}"
PORT="$(grep -E '^LIFESOC_PORT=' .env 2>/dev/null | cut -d= -f2 || true)"
URL="http://127.0.0.1:${PORT:-3010}/up"

healthy() {
  for _ in $(seq 1 20); do
    curl -fs -o /dev/null "$URL" && return 0
    sleep 1
  done
  return 1
}

if [[ "${1:-}" == "--rollback" ]]; then
  $DOCKER image inspect lifesoc:previous >/dev/null
  $DOCKER tag lifesoc:previous lifesoc:latest
  $DOCKER compose up -d --no-build --force-recreate
  healthy && echo "Rolled back." || { echo "Rollback container is not healthy." >&2; exit 1; }
  exit 0
fi

[[ -f .env ]] || { echo "selfhost/.env is missing." >&2; exit 1; }

git -C .. pull --ff-only https://github.com/sadorect/lifesoc-mvp.git main
echo "Deploying $(git -C .. rev-parse --short HEAD)"

# Keep the running image so a failed deploy (or --rollback) can return to it.
if $DOCKER image inspect lifesoc:latest >/dev/null 2>&1; then
  $DOCKER tag lifesoc:latest lifesoc:previous
fi

$DOCKER compose build
$DOCKER compose up -d --force-recreate

if healthy; then
  echo "Deployed and healthy."
  $DOCKER image prune -f >/dev/null
else
  echo "New container failed its health check; rolling back." >&2
  $DOCKER compose logs --tail 50 >&2 || true
  "$0" --rollback
  exit 1
fi
