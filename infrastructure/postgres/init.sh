#!/bin/sh
set -eu
# Runs only for an empty PostgreSQL volume. Each service owns only its database.
for service in PLATFORM WORKFORCE PAYROLL FINANCE; do
    export APP_DB_NAME="$(printenv "${service}_DB_NAME")"
    export APP_DB_USER="$(printenv "${service}_DB_USERNAME")"
    export APP_DB_PASSWORD="$(printenv "${service}_DB_PASSWORD")"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<'SQL'
\getenv db APP_DB_NAME
\getenv appuser APP_DB_USER
\getenv apppassword APP_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'appuser', :'apppassword') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'appuser') \gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db', :'appuser') \gexec
SQL
done
unset APP_DB_NAME APP_DB_USER APP_DB_PASSWORD
