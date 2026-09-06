# Local Docker stack

The Docker stack runs Eureka, Gateway, Platform, Workforce, Payroll, Finance, and the production frontend. PostgreSQL is **not containerized**: an existing PostgreSQL server must be reachable from the containers on port 5432, with all required databases and schemas already present.

## Prerequisites

- Docker Engine with Docker Compose v2
- Existing PostgreSQL databases for each database-backed service
- A PostgreSQL role that can connect to those databases

Export configuration before starting the stack:

```sh
export DB_HOST=host.docker.internal
export DB_PORT=5432
export DB_USERNAME='<existing-role>'
export DB_PASSWORD='<existing-password>'
export PLATFORM_DB_NAME=platform_db
export WORKFORCE_DB_NAME=lexorion_workforce
export PAYROLL_DB_NAME=lexorion_payroll
export FINANCE_DB_NAME=lexorion_finance
export JWT_SECRET='<at-least-32-byte-secret>'
export WORKFORCE_SERVICE_TOKEN='<independent-random-secret-at-least-32-bytes>'
export PAYROLL_SERVICE_TOKEN='<independent-random-secret-at-least-32-bytes>'
```

`DB_HOST` may need the host's LAN address on Docker environments that do not support `host.docker.internal`. Full JDBC URLs can instead be supplied with `PLATFORM_DB_URL`, `WORKFORCE_DB_URL`, `PAYROLL_DB_URL`, or `FINANCE_DB_URL` through an environment override.

## Commands

```sh
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose down
```

Compose does not create databases, users, or seed data. Each service applies its own versioned Flyway migrations and Hibernate validates the resulting schema; migrations are non-destructive and must be reviewed before deployment.

## Ports and health

| Service | Port | Health URL |
| --- | ---: | --- |
| Frontend | 9000 | `http://localhost:9000/` |
| Gateway | 9001 | `http://localhost:9001/actuator/health` |
| Eureka | 9003 | `http://localhost:9003/actuator/health` |

Platform 9002, Workforce 9004, Payroll 9005, and Finance 9006 are internal `horizon` network ports and are intentionally not published on the host. Their health checks run inside their containers. Use Gateway for application APIs; use an explicit development-only Compose override if direct diagnostics are necessary.

The browser sends relative `/api/...` requests to nginx on port 9000. Nginx proxies those requests to Gateway over the internal `horizon` network. Backend services use the Eureka, Platform, and Workforce Compose service names rather than `localhost`.

Startup dependencies wait for basic health where useful, but Eureka health does not imply immediate service registration. Clients retain their normal discovery behavior during registration convergence.

If a database or credential is absent, the corresponding service is expected to remain unhealthy. Fix the external environment rather than adding or initializing PostgreSQL through Compose.
