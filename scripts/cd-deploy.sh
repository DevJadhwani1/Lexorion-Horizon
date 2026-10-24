#!/bin/bash
# Deploy the published images into an ephemeral stack and wait until it is healthy.
# Uses infrastructure/ci/compose.env and compose.cd.yml. Does not read or replace the host .env or Postgres volume.
set -eu
cd "$(dirname "$0")/.."

export HORIZON_IMAGE_TAG="${HORIZON_IMAGE_TAG:-main}"
owner="${HORIZON_IMAGE_OWNER:-}"
if [ -z "$owner" ]; then
  owner=$(printf '%s' "${GITHUB_REPOSITORY_OWNER:-devjadhwani1}" | tr '[:upper:]' '[:lower:]')
fi
export HORIZON_IMAGE_REGISTRY="${HORIZON_IMAGE_REGISTRY:-ghcr.io/${owner}}"

files=(-f docker-compose.yml -f compose.cd.yml)
env_file=(--env-file infrastructure/ci/compose.env)
services=(eureka platform workforce payroll finance gateway frontend)

cleanup() {
  docker compose "${env_file[@]}" "${files[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose "${env_file[@]}" "${files[@]}" pull "${services[@]}"
docker compose "${env_file[@]}" "${files[@]}" up -d --no-build --wait --wait-timeout 600
docker compose "${env_file[@]}" "${files[@]}" ps
