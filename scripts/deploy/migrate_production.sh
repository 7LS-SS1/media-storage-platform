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

set -a
source "${ENV_FILE}"
set +a

if [[ -z "${DIRECT_URL:-}" ]]; then
  echo "DIRECT_URL is required in ${ENV_FILE} for production migration."
  exit 1
fi

echo "Running prisma migrate deploy using DIRECT_URL..."
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" run --rm \
  -e DATABASE_URL="${DIRECT_URL}" \
  web npx prisma migrate deploy

echo "Migration completed."
