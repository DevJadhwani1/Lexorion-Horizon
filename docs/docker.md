# Local Docker stack

The Docker stack runs Eureka, Gateway, Platform, Workforce, Payroll, Finance, and the production frontend. Compose includes PostgreSQL 16 and an initialization script for the service databases. You can instead set DB_HOST to an existing PostgreSQL server; all required databases must then already exist there. PostgreSQL has no published host port. Eureka and diagnostic gateway/frontend ports bind only to 127.0.0.1. This Compose file is a local stack, not a production ingress or backup setup.

## Prerequisites

- Docker Engine with Docker Compose v2
- Explicit PostgreSQL provisioner credentials, independent database roles/passwords for each service, JWT_SECRET, WORKFORCE_SERVICE_TOKEN, PAYROLL_SERVICE_TOKEN and FINANCE_SERVICE_TOKEN supplied in the environment or private ignored `.env`
- For an external database: existing service databases and a role with access

Export configuration before starting the stack:

```sh
export DB_HOST=postgres # or host.docker.internal for an external database
export DB_PORT=5432
export POSTGRES_DATA_VOLUME='<existing-data-volume-name-or-new-empty-volume>'
export POSTGRES_USER='<database-provisioning-administrator>'
export POSTGRES_PASSWORD='<independent-random-secret>'
export PLATFORM_DB_USERNAME='<platform-only-role>'
export PLATFORM_DB_PASSWORD='<independent-random-secret>'
export WORKFORCE_DB_USERNAME='<workforce-only-role>'
export WORKFORCE_DB_PASSWORD='<independent-random-secret>'
export PAYROLL_DB_USERNAME='<payroll-only-role>'
export PAYROLL_DB_PASSWORD='<independent-random-secret>'
export FINANCE_DB_USERNAME='<existing-finance-role>'
export FINANCE_DB_PASSWORD='<existing-finance-password>'
export PLATFORM_DB_NAME=platform_db
export WORKFORCE_DB_NAME=lexorion_workforce
export PAYROLL_DB_NAME=lexorion_payroll
export FINANCE_DB_NAME=lexorion_finance
export JWT_SECRET='<at-least-32-byte-secret>'
export WORKFORCE_SERVICE_TOKEN='<independent-random-secret-at-least-32-bytes>'
export PAYROLL_SERVICE_TOKEN='<independent-random-secret-at-least-32-bytes>'
export FINANCE_SERVICE_TOKEN='<independent-random-secret-at-least-32-bytes>'
```

`DB_HOST` may need the host's LAN address on Docker environments that do not support `host.docker.internal`. Full JDBC URLs can instead be supplied with `PLATFORM_DB_URL`, `WORKFORCE_DB_URL`, `PAYROLL_DB_URL`, or `FINANCE_DB_URL` through an environment override.

## Commands

```sh
python3 scripts/deployment-config.py check
docker compose config -q
docker compose build
docker compose up -d
docker compose ps
docker compose down
```

On an empty bundled PostgreSQL data directory, infrastructure/postgres/init.sh creates the service databases and isolated, non-superuser owner roles. Changing an environment password does not change credentials in an existing PostgreSQL data directory; rotate those credentials explicitly before updating configuration. Do not delete existing data volumes to apply these defaults. Each service applies its own versioned Flyway migrations and Hibernate validates the resulting schema; migrations are non-destructive and must be reviewed before deployment.

## Ports and health

| Service | Port | Health URL |
| --- | ---: | --- |
| Frontend | 9000 | `http://localhost:9000/` |
| Gateway | 9001 | `http://localhost:9001/actuator/health` |
| Eureka | 9003 | `http://localhost:9003/actuator/health` |

Platform 9002, Workforce 9004, Payroll 9005, and Finance 9006 are internal `horizon` network ports and are intentionally not published on the host. Their health checks run inside their containers. Use Gateway for application APIs; use an explicit development-only Compose override if direct diagnostics are necessary.

The browser sends relative `/api/...` requests to nginx on port 9000. Nginx proxies those requests to Gateway over the internal `horizon` network. Backend services use the Eureka, Platform, and Workforce Compose service names rather than `localhost`.

Startup dependencies wait for basic health where useful, but Eureka health does not imply immediate service registration. Clients retain their normal discovery behavior during registration convergence.

If a database or credential is absent, the corresponding service is expected to remain unhealthy. Fix the database credentials and configuration. Bootstrap is disabled by default; for a new local stack explicitly set LEXORION_BOOTSTRAP_ENABLED=true and supply LEXORION_BOOTSTRAP_EMAIL and LEXORION_BOOTSTRAP_PASSWORD to provision the initial operator, then disable bootstrap again. There is no default administrator password. These changes take effect only after the relevant containers are recreated; editing Compose does not harden an already running stack. Persist and back up database storage explicitly for production; do not replace an existing volume during an upgrade.

## Runtime configuration and rotation

For a NEW empty local database, `python3 scripts/deployment-config.py init` generates independent random credentials into mode-0600 `.env` and prints the `docker volume create` command for a new volume. Run that command before Compose startup. It refuses to overwrite an existing file. It never seeds an administrator. Do not run it to rotate an existing database.

Compose maps each service's dedicated database variables to that service's `DB_USERNAME`/`DB_PASSWORD`; Spring datasource properties consume those at startup. The provisioner password is supplied only to PostgreSQL, not application containers. `JWT_SECRET` is loaded by Core JwtService (minimum 32 bytes). Workforce and Payroll tokens authenticate their corresponding internal authority endpoints; Platform and Workforce receive only the tokens they verify or send. Gateway strips browser-supplied service/trusted headers. There is no local JWT fallback. Secrets are never frontend build arguments.

Use a secret manager/environment injector or private `.env` with restricted host and Docker access. Docker administrators can inspect container environment; this Compose setup is not a protection boundary against host administrators. Do not publish `docker compose config` or `docker inspect` output; `config -q` and the validation helper avoid printing secret values.

For an existing database, changing environment variables does **not** change PostgreSQL credentials or object ownership. Back up first and schedule a maintenance window. A DBA must provision the dedicated service roles, transfer each service database's tables/sequences to its role, and revoke cross-database CONNECT. Do not apply the empty-volume init script to an existing installation. Never delete or renew data volumes to make initialization rerun. The current local ownership migration is pending explicit approval; application fixes can use the already-running database identities until it is approved.

Rotate a database password using PostgreSQL's interactive `\password <role>` from an authorized DBA session (avoids passwords in shell history/SQL arguments), update the matching private configuration, then recreate that service. Keep the old secret in a restricted rollback location until health and tenant reads/writes are confirmed. Rotate JWT_SECRET by replacing it and recreating Platform; old access tokens fail validation, but refresh tokens can establish new access tokens. For a compromise, also revoke stored refresh sessions using the supported session-revocation API. Rotate WORKFORCE_SERVICE_TOKEN together on Platform/Workforce, PAYROLL_SERVICE_TOKEN together on Platform/Workforce/Payroll, and FINANCE_SERVICE_TOKEN together on Platform/Finance; schedule maintenance because single-key verification has no rolling overlap window.

Bootstrap is allowed only on an empty identity store. Set its enabled flag/email/password explicitly for one initial Platform instance, start it, then disable and remove credentials before normal operation. Enabled bootstrap on an existing identity store fails startup instead of restoring a removed administrator or promoting an existing user. Recover accounts through authenticated administration or an explicitly reviewed DBA recovery procedure.

For a local client login, the optional client seed creates `dev@lexorion.in`, a fresh `Lexorion Client` trial organization, and an `ADMIN` membership. It is disabled by default and is idempotent:

```sh
export LEXORION_CLIENT_SEED_ENABLED=true
export LEXORION_CLIENT_SEED_PASSWORD='<12-to-72-byte-development-password>'
docker compose up -d --force-recreate platform
```

Do not commit the password or enable this seed in production. Disable `LEXORION_CLIENT_SEED_ENABLED` after local provisioning.

## Unified HRM MVP demo workflow

After the stack is healthy, open `http://localhost:9000/` and sign in with the
local client account created by the optional seed. Select `Lexorion Client` in
the organization context selector. The Home screen is the resumable setup
entry point: organization administrators can follow each action in order, and the
checklist derives its state from the current organization, plan, workspace,
workforce, and payroll data rather than browser-only flags.

1. Review **Organization details**.
2. Open **Workspace and plan**. Confirm an active Starter or Business plan,
   then create a workspace without selecting individual products. Enabled
   capabilities are resolved from the organization's assigned plan.
3. Configure departments and designations, then add an active employee under
   **Workforce**.
4. Open **Payroll**, enroll the employee, and add an effective compensation
   profile with components.
5. Confirm payroll readiness, create a pay run, process it, review the
   calculation, and finalize it. Finalized pay runs and their ledger entries
   are immutable.

If there is no active plan, an inactive plan, or the workspace limit has been
reached, the workspace screen reports the actionable server response instead
of allowing a bypass. Non-administrators see the request-access state until an
administrator provisions a workspace. Workforce and Payroll remain protected
by the selected tenant context and workspace authorization.

Frontend validation for the unified setup flow:

```sh
cd frontend
npm test -- --run src/pages/HomePage.test.tsx src/pages/admin/AdminWorkspaces.test.tsx src/workspace/WorkspaceProvider.test.tsx
npm run typecheck
npm run build
```

The focused run passed 13 tests, type-checking passed, and the production
build passed. Backend provisioning and entitlement validation:

```sh
cd backend/platform-service
./mvnw -q -Dtest=WorkspaceSecurityIntegrationTest,EntitlementSecurityIntegrationTest test
```

This passed with 34 tests and no failures. The backend suite uses H2 and
does not replace a full deployed-stack smoke test against PostgreSQL.

Production operators must also configure TLS ingress and hostname routing, database backups/persistence, and the external SMTP relay described in [invitation-lifecycle.md](invitation-lifecycle.md). The frontend binds to loopback by default; set `HORIZON_BIND_ADDRESS` explicitly only behind the intended ingress. DB, registry and service endpoints must remain private. Compose is not a TLS certificate or backup manager.

## Existing data volume

`POSTGRES_DATA_VOLUME` names an explicitly external Docker volume. On the current local installation it points to the exact volume already mounted at `/var/lib/postgresql/data`; no data was moved. This prevents a later Compose recreation from silently initializing a different anonymous volume. `docker compose down` does not delete this external volume. For a new installation create the named empty volume first. Backups remain the operator's responsibility.

Current local security preflight: Compose syntax/interpolation passes, but `scripts/deployment-config.py check` intentionally rejects the still-shared legacy database role. Secret rotation, disabled bootstrap and private ports are active. Database ownership separation is the remaining approval-gated P0 item; do not treat the local shared-role configuration as production-approved.

## Existing-installation database role isolation

The approval-gated migration, tested rollback and exact current/target grants are in
[`database-isolation-approval.md`](database-isolation-approval.md). Do not rerun the
empty-volume initializer to migrate existing data. After the approved transfer,
include `-f compose.db-isolation.yml` in deployment commands and validate with:

```sh
python3 scripts/deployment-config.py check --isolated
```

Each service then needs independent `<SERVICE>_DB_USERNAME/PASSWORD` and
`<SERVICE>_MIGRATION_USERNAME/PASSWORD`. Required migration credentials have no
fallback. `--env-file <private-file>` validates a proposed configuration before
installation. The existing deployment has not yet undergone this ownership transfer.

## Applying code changes

The `frontend` container serves the bundle built inside its image; a local `frontend/dist` is not used.
After pulling changes, rebuild the affected images and hard-refresh the browser:

```sh
docker compose up -d --build frontend payroll-service workforce-service platform-service
```

### Setups created before the Finance service

A `.env` and database volume created before Finance existed lack the `FINANCE_*` settings and the Finance
database, and Compose stops with "required variable FINANCE_SERVICE_TOKEN is missing". Run once:

```sh
sh scripts/add-finance-to-existing-setup.sh
docker compose up -d --build
```

It appends random secrets to `.env` without printing them and creates the Finance role and database in the
existing volume. Existing settings and data are not changed, and running it again is harmless.
