#!/bin/sh
# Adds the Finance service to a local setup created before Finance existed.
#  1. Appends any missing FINANCE_* settings to .env with fresh random secrets (values are never printed).
#  2. Creates the Finance database role and database in the existing PostgreSQL volume, if they are missing.
# Existing settings and data are left untouched, and running it again changes nothing.
set -eu
cd "$(dirname "$0")/.."
ENV_FILE=.env
[ -f "$ENV_FILE" ] || { echo "No .env found. For a brand-new setup run: python3 scripts/deployment-config.py init" >&2; exit 1; }

has() { grep -Eq "^(export[[:space:]]+)?$1=." "$ENV_FILE"; }
secret() { openssl rand -hex 32; }
added=""
add() { printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"; added="$added $1"; }

has FINANCE_DB_USERNAME || add FINANCE_DB_USERNAME finance_app
has FINANCE_DB_PASSWORD || add FINANCE_DB_PASSWORD "$(secret)"
has FINANCE_SERVICE_TOKEN || add FINANCE_SERVICE_TOKEN "$(secret)"
chmod 600 "$ENV_FILE"
if [ -n "$added" ]; then echo "Added to .env:$added"; else echo ".env already has the Finance settings."; fi

# Recreate PostgreSQL with the new settings (the data volume is kept), then create the role and database once.
docker compose up -d postgres
echo "Waiting for PostgreSQL…"
i=0
until docker compose exec -T postgres sh -c 'pg_isready -q -U "$POSTGRES_USER"'; do
  i=$((i + 1)); [ "$i" -lt 30 ] || { echo "PostgreSQL did not become ready." >&2; exit 1; }; sleep 2
done
docker compose exec -T postgres sh -c '
  export APP_DB_NAME="$FINANCE_DB_NAME" APP_DB_USER="$FINANCE_DB_USERNAME" APP_DB_PASSWORD="$FINANCE_DB_PASSWORD"
  psql -q -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres' <<'SQL'
\getenv db APP_DB_NAME
\getenv appuser APP_DB_USER
\getenv apppassword APP_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'appuser', :'apppassword')
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'appuser') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'appuser')
  WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db', :'appuser') \gexec
SQL
echo "Finance database is ready. Next: docker compose up -d --build"
