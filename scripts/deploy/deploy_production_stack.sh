#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Missing ${COMPOSE_FILE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

echo "Building images..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" build --pull

echo "Starting web + worker..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d

echo "Current status:"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps

echo "Tail logs (Ctrl+C to exit):"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" logs -f --tail=100
