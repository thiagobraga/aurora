#!/bin/bash
set -e

# Loads PROJECTS_DIR, AURORA_PORT, ... so the URL below matches .env.
[ -f .env ] || cp .env.example .env
set -a; . ./.env; set +a

# Aurora's compose.yml declares the Traefik network as external.
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

docker compose down --timeout=0
docker compose build
docker compose up -d

echo "[aurora] Waiting for app and api to be healthy..."
until [ "$(docker compose ps app api --format json | jq -s -r 'map(.Health) | unique | join(",")')" = "healthy" ]; do sleep 1; done

URL="http://localhost:${AURORA_PORT:-7700}"
echo "[aurora] App and API are healthy: $URL"
(xdg-open "$URL" || open "$URL") >/dev/null 2>&1 || true
