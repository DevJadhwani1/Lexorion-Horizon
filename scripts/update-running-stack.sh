#!/bin/sh
# Rebuild the application images from the current checkout and recreate those containers.
# Postgres and its volume are left running. Secrets are read from the local .env and are not printed.
set -eu
cd "$(dirname "$0")/.."

unset LEXORION_QA_IDENTITY_ENABLED \
  LEXORION_QA_IDENTITY_ACK \
  LEXORION_QA_IDENTITY_PASSWORD \
  LEXORION_QA_IDENTITY_EMAIL \
  LEXORION_ENVIRONMENT

docker compose up -d --build eureka platform workforce payroll finance gateway frontend
docker compose ps
