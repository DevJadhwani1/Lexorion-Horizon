#!/bin/bash
# Update the running application containers.
# With HORIZON_IMAGE_TAG set, pull that published tag and recreate the app services.
# Without it, rebuild from the current checkout.
# Postgres and its volume are left in place. Secrets are not printed.
set -eu
cd "$(dirname "$0")/.."

unset LEXORION_QA_IDENTITY_ENABLED \
  LEXORION_QA_IDENTITY_ACK \
  LEXORION_QA_IDENTITY_PASSWORD \
  LEXORION_QA_IDENTITY_EMAIL \
  LEXORION_ENVIRONMENT

ENV_FILE="${HORIZON_ENV_FILE:-.env}"
if [ ! -f "$ENV_FILE" ]; then
  echo "Deployment env file is missing." >&2
  exit 1
fi

services="eureka platform workforce payroll finance gateway frontend"
compose() {
  docker compose --env-file "$ENV_FILE" "$@"
}

logged_in=0
cleanup() {
  if [ "$logged_in" -eq 1 ]; then
    docker logout ghcr.io >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [ -n "${HORIZON_IMAGE_TAG:-}" ]; then
  if [ -n "${GHCR_TOKEN:-}" ]; then
    user=$(printf '%s' "${GHCR_USERNAME:-github}" | tr '[:upper:]' '[:lower:]')
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$user" --password-stdin >/dev/null
    logged_in=1
  fi
  compose pull $services
  compose up -d --no-build $services
else
  compose up -d --build $services
fi

compose ps
