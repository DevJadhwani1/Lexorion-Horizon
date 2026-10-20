# P0 database isolation — production approval package

Date: 2026-10-04. **Prepared and verified on disposable PostgreSQL; production migration pending explicit approval.** No existing-installation ownership/grant mutation or service restart was executed in this task. The previous automatic approval rejection has not been bypassed. This package explicitly includes Finance's database boundary, without Finance feature changes.

## 1. Current database topology

Read from the running containers and PostgreSQL catalogs, not inferred from Compose defaults:

| Service | Database | Current datasource / Flyway role | Intended runtime role | Intended migration / owner role | Current access |
| --- | --- | --- | --- | --- | --- |
| Platform | `platform_db` | `postgres` / same datasource | `horizon_platform` | `horizon_platform_migrator` | All databases, superuser |
| Workforce | `lexorion_workforce` | `postgres` / same datasource | `horizon_workforce` | `horizon_workforce_migrator` | All databases, superuser |
| Payroll | `lexorion_payroll` | `postgres` / same datasource | `horizon_payroll` | `horizon_payroll_migrator` | All databases, superuser |
| Finance | `lexorion_finance` | `postgres` / same datasource | `horizon_finance` | `horizon_finance_migrator` | All databases, superuser |

- All four datasources use `postgres:5432` on the private Docker network. No Flyway username/password override was present. Hibernate uses `ddl-auto=validate`; Flyway is enabled with baseline-on-migrate and baseline version 1.
- The only non-system role is `postgres`: LOGIN, SUPERUSER, CREATEDB, CREATEROLE, INHERIT, REPLICATION, BYPASSRLS. No application role memberships exist.
- `postgres` owns the four service databases and `postgres`, `template0`, `template1`. Service database ACLs are NULL: owner has all privileges; PUBLIC receives CONNECT and TEMPORARY by default. Superuser bypasses ACL checks anyway.
- Each service database has only the `public` application schema. Its owner is `pg_database_owner`, ACL `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner}`: database owner has USAGE/CREATE; PUBLIC has USAGE.
- Every application relation/index is owned by `postgres`, with NULL relation ACL (owner privileges; no explicit grants).

| Database | Tables, including Flyway | Indexes | Sequences | Successful Flyway versions |
| --- | ---: | ---: | ---: | --- |
| Platform | 22 | 55 | 0 | 1–9 |
| Workforce | 7 | 20 | 0 | 1–2 |
| Payroll | 15 | 45 | 0 | 1–7 |
| Finance | 1 | 2 | 0 | 1 |

There are no application functions, custom enum/domain/range types, foreign servers, large objects, custom default ACLs, or extensions beyond `plpgsql`. Finance's sole table is `flyway_schema_history`; its V1 baseline is an empty service shell. No migration SQL currently changes ownership or grants.

Startup dependencies: Platform and Finance wait for PostgreSQL/Eureka; Workforce also waits for Platform; Payroll also waits for Platform/Workforce. Gateway depends on Eureka and frontend on Gateway. Container health precedes Eureka client convergence: the disposable smoke test initially encountered unregistered downstream instances, then passed after registration. Operators must check routing before reopening traffic.

## 2. Root cause

The original databases and Flyway objects were created by the shared `postgres` superuser. Later environment hardening rotated passwords but retained that identity. The empty-volume initializer cannot change ownership on an already initialized volume. `infrastructure/postgres/init.sh` was inspected: it only provisions new databases and service owners on empty storage; it is **not** this existing-installation migration and must not be rerun against populated storage.

An ownership transfer requires administrative privileges across the four existing databases. It belongs in this separately reviewed operator procedure, not in application Flyway migrations running as runtime users.

## 3. Files changed in this task

- `compose.db-isolation.yml`: explicit independent Flyway credentials for each service.
- `scripts/db-isolation/manage.py`: read-only inventory, private exact SQL plan, guarded apply, isolation verification, preservation fingerprints and guarded rollback.
- `scripts/db-isolation/configure-runtime.py`: creates a new private env file; never overwrites the current file.
- `scripts/db-isolation/test-disposable.py`: restores all four existing databases into a labelled disposable cluster; tests repeatability, isolation, runtime restrictions, preservation and rollback.
- `scripts/db-isolation/start-disposable-apps.py`: starts existing images only against the labelled test database/network.
- `scripts/db-isolation/test-fresh-startup.py`: executes the complete existing Flyway histories with split credentials on empty disposable databases.
- `scripts/deployment-config.py`: `--isolated` and `--env-file` validation; rejects shared/missing migration credentials.
- Finance `application.properties`: removes the `postgres` username / empty-password fallback only. No Finance business code, tables or migrations changed.
- This report, `docs/docker.md`, and the current P0 section of `docs/horizon-flow-audit.md`.

Earlier uncommitted feature/audit files were preserved. No Workforce, Payroll, invitation or UI implementation changes were made in this pass.

## 4. Migration design and exact changes

For each service, create two independent LOGIN roles with random passwords and **NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT**. Neither is a member of the other or of a privileged role.

| Object / operation | Migration role | Runtime role | Other services / PUBLIC |
| --- | --- | --- | --- |
| Own database | Owner; CONNECT/CREATE/TEMP | CONNECT only | No privileges |
| Own public schema | Owner; USAGE/CREATE | USAGE only | No privileges |
| Own existing application tables | Owner / DDL | SELECT, INSERT, UPDATE, DELETE | No grants |
| Own Flyway history | Owner / DDL/DML | No privileges | No grants |
| Own sequences, if present / created later | Owner | USAGE, SELECT | No grants |
| Future tables created by own migration role | Owner | Default CRUD grant | No grants |
| Indexes / constraints / TOAST | Follow owning table | No ownership | No grants |
| Another service's database | Cannot connect | Cannot connect | — |
| `postgres` / `template1` maintenance DB | Cannot connect | Cannot connect | PUBLIC CONNECT/TEMP removed |

`postgres` remains the operator-only cluster administrator. It is not put into any application's environment after cutover. `template0` is already non-connectable. Restricting maintenance-database PUBLIC access may affect operator tooling that currently connects without an explicit grant; inventory showed no other login roles. Any changed topology requires a new DBA review.

### SQL artifact generation

`manage.py prepare` checks the exact inspected topology and writes these files privately:

- `inventory.json`, `manifest.json`: original catalog state and SHA-256 hashes binding all plan files to the named container/admin.
- `roles.env`: eight newly generated independent credentials; mode 0600, directory 0700. **Never commit, print or attach it.**
- `roles.sql`: guarded role creation and password assignment through `psql \getenv`; no literal secret values in SQL.
- `platform.sql`, `workforce.sql`, `payroll.sql`, `finance.sql`: exact database/schema/table/sequence statements using the catalog's object list.
- Corresponding `*.rollback.sql`, plus `maintenance.sql` and `maintenance.rollback.sql`.

The prepared review package for this session is `/private/tmp/horizon-production-role-review`. It has not been applied. Regenerate a new package at the approved maintenance window if the topology changes. SQL files can be reviewed without opening `roles.env` or `runtime.env`.

The generated per-service transaction is exactly this pattern, expanded to every inspected non-index relation with properly quoted identifiers:

```sql
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER DATABASE <existing_db> OWNER TO <own_migrator>;
REVOKE ALL ON DATABASE <existing_db> FROM PUBLIC;
-- Explicitly revoke database grants from all seven other new roles.
GRANT CONNECT ON DATABASE <existing_db> TO <own_runtime>;
ALTER SCHEMA public OWNER TO <own_migrator>;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO <own_runtime>;
ALTER TABLE public.<each_existing_table> OWNER TO <own_migrator>;
-- ALTER SEQUENCE for each existing sequence, if any.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO <own_runtime>;
REVOKE ALL ON TABLE public.flyway_schema_history FROM <own_runtime>;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO <own_runtime>;
ALTER DEFAULT PRIVILEGES FOR ROLE <own_migrator> IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO <own_runtime>;
ALTER DEFAULT PRIVILEGES FOR ROLE <own_migrator> IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO <own_runtime>;
COMMIT;
```

No REASSIGN OWNED shortcut, DROP DATABASE, DROP SCHEMA, data rewrite, or replacement database is used. Index ownership follows table ownership. `CREATE DATABASE` occurs only in explicitly disposable test setup, never in the production migration path.

### Runtime / migration separation

Base Compose continues to provide each service's explicit `DB_USERNAME`/`DB_PASSWORD`. The isolation overlay requires `<SERVICE>_MIGRATION_USERNAME` and `<SERVICE>_MIGRATION_PASSWORD`, mapped to Spring's `SPRING_FLYWAY_USER`/`SPRING_FLYWAY_PASSWORD`. Spring opens the migration datasource separately; Hibernate/JPA continues using runtime credentials. No code architecture change is needed.

Omitting the overlay after migration will make Flyway use the restricted runtime login and fail on its history table; there is no fallback to the old superuser. Missing any of the eight overlay inputs fails Compose expansion. `check --isolated` additionally rejects reused users/passwords, missing values and weak secrets.

Limitation: both per-service secrets exist inside the same service container because Flyway runs at application startup. A compromised process could use its own migration credential for DDL **within its own database**. It still cannot connect to another service's database. Moving migration execution into an independently credentialed deployment job is a future deployment change, not included here. Fresh-volume `init.sh` remains the earlier single-owner-per-service bootstrap path; this package specifically handles the inspected existing installation, and does not silently retrofit that separate path.

## 5. Disposable PostgreSQL verification

PostgreSQL 16 Alpine, matching the running database major version. All four databases were dumped read-only and restored into a new isolated cluster with a separate administrator password. All mutations targeted that disposable container; no production role/grant statement was executed.

Verified:

- Existing-table content fingerprints, every sequence position, index definition and Flyway checksum/history preserved through migration, repeated apply, rollback and reapply.
- Runtime INSERT/SELECT/UPDATE/DELETE and sequence usage; migration CREATE/ALTER TABLE, CREATE INDEX and sequence creation.
- Runtime CREATE TABLE, ALTER TABLE, TRUNCATE and Flyway-history SELECT rejected.
- Runtime roles have no privileged role attributes, no migration-role membership, no database/schema CREATE or Flyway DML privilege.
- Rollback restores original effective ownership/grants and retains new roles as NOLOGIN. NULL ACLs can become explicit owner ACLs: effective permissions match; catalog serialization need not be byte-identical.
- All four existing applications start against the restored/migrated data using split credentials. Live `pg_stat_activity` checks confirm all four runtime identities and reject shared or foreign identities in their application pools.
- A second empty disposable cluster executes **Platform 9, Workforce 2, Payroll 7, Finance 1** actual Flyway migrations. Every history `installed_by` is the correct migration role; all four services become healthy. This clean-schema fixture removes the initial default grant on newly created Flyway history after migration; the production existing-table plan explicitly removes it during cutover.

Reproduce (uses Docker; source reads only):

```sh
python3 scripts/db-isolation/test-disposable.py \
  --source-container lexorion-horizon-postgres-1 \
  --directory /private/tmp/horizon-isolation-new-verification
python3 scripts/db-isolation/start-disposable-apps.py \
  --directory /private/tmp/horizon-isolation-new-verification
python3 scripts/db-isolation/test-fresh-startup.py \
  --directory /private/tmp/horizon-isolation-new-verification
```

The first harness retains its labelled cluster and protected dumps for application checks; the fresh-startup harness removes only its own new test resources. Clean up the retained test Compose project/container/network by their recorded `state.json` identities after review; never use the existing installation's volume or `down -v` against it.

## 6. Isolation results

Each row was tested with a real TCP connection and the correct password (not merely `has_database_privilege`). Expected failures were specifically PostgreSQL `permission denied for database`; the same correct passwords succeeded against the intended databases.

| Runtime role | Platform | Workforce | Payroll | Finance |
| --- | --- | --- | --- | --- |
| `horizon_platform` | Allowed | Denied | Denied | Denied |
| `horizon_workforce` | Denied | Allowed | Denied | Denied |
| `horizon_payroll` | Denied | Denied | Allowed | Denied |
| `horizon_finance` | Denied | Denied | Denied | Allowed |

The same matrix passed for all four migration roles. All eight roles were denied access to `postgres` and `template1`. Total: **48 checks per verification, 8 allowed and 40 denied**. Repeated after reapplication. This establishes the database boundary, including Finance in both directions.

## 7. Application regressions

Targeted tests run this pass, no skips:

| Service | Tests | Result |
| --- | ---: | --- |
| Platform: bootstrap, entitlement security, PostgreSQL migration | 22 | Passed |
| Workforce: security/read-write behavior, PostgreSQL migration | 47 | Passed |
| Payroll: calculation, pay run, security, PostgreSQL migration | 39 | Passed |
| Finance: existing PostgreSQL migration only | 1 | Passed |

Commands use `DOCKER_HOST=unix:///Users/dev/.docker/run/docker.sock ./mvnw -B -Dtest=... test` in each service. Platform classes: `InitialPlatformAdminBootstrapTest,EntitlementSecurityIntegrationTest,PostgresMigrationTest`; Workforce: `WorkforceSecurityIntegrationTest,PostgresMigrationTest`; Payroll: `PayrollCalculationIntegrationTest,PayrollPayRunIntegrationTest,PayrollSecurityIntegrationTest,PostgresMigrationTest`; Finance: `PostgresMigrationTest`.

Real browser flow against `http://localhost:19000` on the isolated application network passed:

1. Existing administrator login → create/activate organization → assign plan → enter organization → create/select workspace.
2. Department, designation and employee create/read → employee profile.
3. Payroll employee → component → compensation → standalone calculation.
4. Pay run → add employee → process → finalize → ledger → payslip.
5. Reload/deep-link continuity; wrong workspace and organization both return 403.

Fixture organization `flow-18743217` existed only in the disposable copy. The first attempt reached a temporary Eureka registration gap; after registration converged, the same organization completed every remaining step. No permissions were broadened to make it pass. Disposable containers/networks and their copied database dumps were removed after final verification; the private production review plan and verification logs were retained. Finance startup and history preservation passed; no Finance business features were added or exercised.

## 8. Exact production approval / execution procedure

**DO NOT execute the mutation steps below until explicit operator approval.** The application remains on the current shared role until then. Use a maintenance window; all four services must be stopped because idle pooled superuser connections would otherwise survive ACL revocation. Do not mix an application schema release into this change.

These commands target the inspected local installation and preserve its existing Mailpit overlay. For another environment, retain that environment's existing overrides/SMTP configuration instead of adding Mailpit, and inspect the topology again.

### 1. Backup and approvals

Review this report and generated SQL. Approve all four ownership boundaries, maintenance-database PUBLIC revokes, credentials and rollback. Record the currently deployed image IDs and configuration, and use encrypted/protected backup storage with adequate space. Never print `.env` or the role secrets.

```sh
umask 077
backup_dir="$PWD/.env.db-isolation-backup-$(date +%Y%m%d%H%M%S)"
mkdir -m 700 "$backup_dir"
cp .env "$backup_dir/runtime.env"
docker compose -f docker-compose.yml -f compose.mailpit.yml config --format json > "$backup_dir/compose-before.json"
docker inspect lexorion-horizon-platform-1 lexorion-horizon-workforce-1 \
  lexorion-horizon-payroll-1 lexorion-horizon-finance-1 > "$backup_dir/containers-before.json"
```

The backup directory matches the repository's `.env.*` ignore rule. Its files include secrets. Store the absolute `backup_dir` path securely for rollback.

### 2. Maintenance window and consistent backup

Close ingress and stop every application database client; keep PostgreSQL/Eureka running. Ensure no other job uses the shared superuser against these databases.

```sh
docker compose -f docker-compose.yml -f compose.mailpit.yml stop frontend gateway platform workforce payroll finance
docker exec lexorion-horizon-postgres-1 pg_dumpall -U postgres --globals-only > "$backup_dir/globals.sql"
docker exec lexorion-horizon-postgres-1 pg_dump -U postgres -Fc platform_db > "$backup_dir/platform.dump"
docker exec lexorion-horizon-postgres-1 pg_dump -U postgres -Fc lexorion_workforce > "$backup_dir/workforce.dump"
docker exec lexorion-horizon-postgres-1 pg_dump -U postgres -Fc lexorion_payroll > "$backup_dir/payroll.dump"
docker exec lexorion-horizon-postgres-1 pg_dump -U postgres -Fc lexorion_finance > "$backup_dir/finance.dump"
```

Check every exit status; abort on failure. Use `set -e` in a reviewed operator script. Validate these backups by restoring into an isolated recovery cluster before proceeding. The disposable test above exercised that restore path. Do not test restoration over the existing databases.

### 3–5. Role creation, ownership transfer, grants/revokes

Prepare a **new** private directory (must not already exist), inspect each SQL file, and retain it until verification completes:

```sh
plan_dir="$backup_dir/plan"
python3 scripts/db-isolation/manage.py prepare \
  --container lexorion-horizon-postgres-1 --directory "$plan_dir"
# Review inventory.json and all *.sql privately. Do not print roles.env.
python3 scripts/db-isolation/manage.py apply \
  --container lexorion-horizon-postgres-1 --directory "$plan_dir" \
  --execute-reviewed-plan
```

This explicit invocation is the approval-gated mutation. It checks idle databases, target/container identity, artifact hashes, supported object types, role attributes/memberships and schema/history drift. It creates eight roles, transfers each existing database/schema/table in a per-database transaction, then applies maintenance-database revokes. A 10-second lock timeout fails explicitly. The four transactions are not cluster-wide atomic: on any failure keep traffic closed and inspect/reapply the same reviewed plan or roll back. Never continue by restoring a shared-role runtime fallback silently.

### 6. Explicit application credential update

```sh
python3 scripts/db-isolation/configure-runtime.py \
  --current .env --roles "$plan_dir/roles.env" --output "$plan_dir/runtime.env"
python3 scripts/deployment-config.py check --isolated --env-file "$plan_dir/runtime.env"
docker compose --env-file "$plan_dir/runtime.env" -f docker-compose.yml \
  -f compose.db-isolation.yml -f compose.mailpit.yml config -q
cp "$plan_dir/runtime.env" .env
chmod 600 .env
```

The generated file preserves unrelated existing configuration and replaces only the sixteen DB/migration username/password entries. Check that exported shell variables or deployment secrets do not override this file; validate effective Compose before starting. Add the isolation overlay permanently to the deployment command. Independent rotation is possible via an explicitly reviewed `ALTER ROLE ... PASSWORD` or interactive `psql \password`, paired with updating the corresponding private env value and recreating only the affected application. Changing `.env` alone does not rotate PostgreSQL credentials.

### 7–8. Restart and migration verification

```sh
docker compose -f docker-compose.yml -f compose.db-isolation.yml -f compose.mailpit.yml \
  up -d --no-build --no-deps --wait --wait-timeout 180 platform finance
# Start dependent services after upstream health is established.
docker compose -f docker-compose.yml -f compose.db-isolation.yml -f compose.mailpit.yml \
  up -d --no-build --no-deps --wait --wait-timeout 180 workforce payroll gateway frontend
python3 scripts/db-isolation/manage.py inspect \
  --container lexorion-horizon-postgres-1 > "$backup_dir/inventory-after.json"
```

Inspect each service's Flyway validation result and health without dumping environment secrets. Existing history versions/checksums must be unchanged; this release adds no business migration. Query `pg_stat_activity` as the administrator: application pools must use the four `horizon_<service>` runtime roles and their own database; migration connections may appear briefly as the matching migrator. There must be no application pool using `postgres`. Confirm Eureka registrations/downstream routing before the smoke test. Reopen public ingress only after the checks below pass; keep any external reverse proxy in maintenance while the local frontend is used for smoke verification.

### 9–10. Application smoke and isolation

Repeat section 7's approved QA business journey, including final ledger/payslip and wrong-context denials. Do not finalize real employee pay merely as a connectivity probe; use designated QA fixtures. Then:

```sh
python3 scripts/db-isolation/manage.py verify \
  --container lexorion-horizon-postgres-1 --directory "$plan_dir" --require-runtime-pools
python3 scripts/deployment-config.py check --isolated
```

Require 48 connection checks, runtime-privilege checks, correct live datasource roles, successful Flyway validation and complete business smoke. Only then reopen ingress and mark the existing installation's P0 closed. Retain the backup/plan securely according to operator retention policy.

### 11. Failure

Keep maintenance mode. Use the rollback below or investigate the exact failed transaction; no automatic credential downgrade occurs.

## 9. Exact rollback procedure

Applicable while schema/Flyway history is unchanged from the approved plan. Application data may have changed: ownership rollback does not delete/revert rows. If a new schema release has run, STOP for DBA review; the script refuses a stale relation/history plan.

```sh
docker compose -f docker-compose.yml -f compose.db-isolation.yml -f compose.mailpit.yml \
  stop frontend gateway platform workforce payroll finance
python3 scripts/db-isolation/manage.py rollback \
  --container lexorion-horizon-postgres-1 --directory "$plan_dir" \
  --execute-reviewed-plan
cp "$backup_dir/runtime.env" .env
chmod 600 .env
# Explicitly restore the original deployment command, without the isolation overlay.
docker compose -f docker-compose.yml -f compose.mailpit.yml \
  up -d --no-build --no-deps --wait --wait-timeout 180 platform finance
docker compose -f docker-compose.yml -f compose.mailpit.yml \
  up -d --no-build --no-deps --wait --wait-timeout 180 workforce payroll gateway frontend
```

Rollback revokes new runtime/default grants, transfers existing tables/sequences/databases back to `postgres`, restores `public` ownership to `pg_database_owner` and its PUBLIC USAGE, restores original database PUBLIC CONNECT/TEMP (template1 CONNECT only), and marks the eight new roles NOLOGIN. It checks data/index/sequence fingerprints before and after. Roles are retained, not dropped. This deliberately reopens the original P0 and must be recorded as rollback, not secure completion.

If apply failed before all roles existed, inspect which transaction committed first; generated database rollback files reference all eight roles. The role-creation transaction is atomic, so a successful role stage creates all eight; if it never committed, do not run ownership rollback against a nonexistent role set—restore the prior app configuration and investigate. Never restore dumps destructively over live databases. Catastrophic recovery uses the verified backups on a separate recovery cluster and a separately approved cutover.

## 10. Risk, existing data, Finance, remaining limitation

- **Availability:** ownership locks, connection-pool restarts, missing/incorrect passwords, wrong Compose overlays and registry convergence can prevent startup. Maintenance mode, finite lock timeout, explicit failure and tested rollback address this. A non-atomic cross-database failure requires staying in maintenance.
- **Data preservation:** production SQL changes catalog ownership/ACLs only. It does not delete, recreate or update application data. Per-table canonical row fingerprints, sequence positions, index definitions and Flyway checksums were unchanged in disposable tests, including rollback/reapply. A consistent maintenance-window backup remains mandatory; fingerprints are evidence, not a substitute for recovery storage.
- **Finance:** its existing database and Flyway table remain intact. Finance receives its own migration owner and restricted runtime login. Other service roles cannot connect to it; Finance roles cannot connect to other service databases. No Finance functionality changed.
- **Scope:** scripts deliberately reject unreviewed database names, roles/memberships, schemas, grants or unsupported objects rather than guessing how to transfer them. The prepared plan is specific to this installation's inspected topology.
- **Remaining limitation:** the existing installation still uses `postgres`; it has **not** been migrated. Approval and execution of this package, live isolation verification and the live application smoke are required to close P0. The same-container Flyway credential limitation is described above. No production-readiness percentage or claim is assigned.
