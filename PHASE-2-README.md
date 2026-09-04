# Lexorion Horizon — Phase 2: Development of Microservices

## Project overview

Lexorion Horizon is a modular HR and business-management platform implemented as multiple Spring Boot microservices with a React and TypeScript frontend. The backend separates platform administration, workforce, payroll, and finance concerns into domain services. An API Gateway provides the central public API entry point, and Eureka provides service registration and discovery.

This document describes the implementation submitted for the university Phase 2 requirement. The React client is part of the application, but it is not itself a microservice.

## Implemented services

### Domain microservices

| Service | Purpose | Development port |
| --- | --- | ---: |
| Platform Service | Authentication, organizations and tenants, memberships and roles, workspaces, plans and entitlements, and organization administration | 9002 |
| Workforce Service | Employees, departments, designations, organization structure, employee lifecycle, and manager/self-service foundations | 9004 |
| Payroll Service | Payroll employees, compensation components and profiles, payroll calculations, pay runs, and payroll-processing foundations | 9005 |
| Finance Service | Finance microservice foundation, including persistence, security, discovery, and health configuration | 9006 |

### Infrastructure services

| Service | Purpose | Development port |
| --- | --- | ---: |
| API Gateway | Central public API entry point and discovery-backed routing to domain services | 9001 |
| Eureka Server | Service registry and discovery server | 9003 |

### Client and database

| Component | Purpose | Development port |
| --- | --- | ---: |
| React frontend | Browser client built with React, TypeScript, and Vite; communicates through the API Gateway | 9000 |
| PostgreSQL | Relational database used by the backend domain services | 5432 |

## Technology stack

- Java 21 and Spring Boot
- Spring Data JPA and Hibernate
- PostgreSQL
- Spring MVC REST APIs and Spring `RestClient` service-to-service calls
- Spring Security and JWT authentication
- Eureka service discovery
- Spring Cloud Gateway
- Swagger/OpenAPI support in the Workforce and Payroll services
- Maven and Maven Wrapper
- React, TypeScript, and Vite
- Docker and Docker Compose
- Jenkins declarative pipeline CI

## Architecture and microservice communication

The browser uses relative `/api/...` URLs. In the production frontend container, nginx forwards these requests to the API Gateway. The Gateway uses Eureka-backed, load-balanced routes to forward requests to Platform, Workforce, Payroll, or Finance without exposing internal service routes.

```text
React frontend
      |
      v
 API Gateway ----Eureka discovery----> Platform / Workforce / Payroll / Finance
                                            ^          ^
                                            |          |
                         Workforce ---------+          |
                         Payroll ----------------------+
```

Implemented synchronous REST communication includes:

- Frontend to API Gateway.
- API Gateway to the four domain services using Eureka service names.
- Workforce to Platform for trusted tenant and workspace authority.
- Payroll to Workforce for employee verification.
- Payroll to Platform for trusted authority and payroll-entitlement decisions.

These interactions use HTTP REST clients. The implementation does not claim a message broker or asynchronous event architecture. Service boundaries avoid direct cross-service database foreign keys where applicable; services exchange identifiers and verify authority through APIs instead.

### Gateway routing

| Public path | Eureka destination |
| --- | --- |
| `/api/platform/**` | `PLATFORM-SERVICE` |
| `/api/tenant/**` | `PLATFORM-SERVICE` |
| `/api/workforce/**` | `WORKFORCE-SERVICE` |
| `/api/payroll/**` | `PAYROLL-SERVICE` |
| `/api/finance/**` | `FINANCE-SERVICE` |

Internal `/internal/...` service-to-service endpoints are not included in the public Gateway route table.

## Major API endpoints

The following tables list the major endpoints present in the current controller source. Protected endpoints require the relevant authentication and tenant/workspace context.

### Platform Service

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/platform/auth/login` | Authenticate and issue a session token response |
| POST | `/api/platform/auth/refresh` | Refresh authentication tokens |
| POST | `/api/platform/auth/logout` | End the current authenticated session |
| GET | `/api/platform/me` | Get the current user |
| GET | `/api/platform/me/organizations` | List the current user's organizations |
| GET | `/api/platform/products` | List the product catalog |
| GET | `/api/platform/plans` | List plan definitions |
| GET | `/api/platform/entitlements` | List entitlement definitions |
| GET | `/api/tenant/organization` | Get the current tenant organization |
| PATCH | `/api/tenant/organization` | Update the organization profile |
| PATCH | `/api/tenant/organization/settings` | Update organization settings |
| GET | `/api/tenant/organization/members` | List organization members |
| PATCH | `/api/tenant/organization/members/{membershipId}/role` | Change a member role |
| DELETE | `/api/tenant/organization/members/{membershipId}` | Remove a member |
| GET | `/api/tenant/invitations` | List organization invitations |
| POST | `/api/tenant/invitations` | Create an organization invitation |
| DELETE | `/api/tenant/invitations/{invitationId}` | Revoke an invitation |
| GET | `/api/tenant/workspaces` | List workspaces |
| GET | `/api/tenant/workspaces/accessible` | List workspaces accessible to the current user |
| GET | `/api/tenant/workspaces/{workspaceKey}` | Get an accessible workspace |
| POST | `/api/tenant/workspaces` | Create a workspace |
| PATCH | `/api/tenant/workspaces/{workspaceKey}` | Update a workspace |
| DELETE | `/api/tenant/workspaces/{workspaceKey}` | Deactivate a workspace |
| GET | `/api/tenant/entitlements` | Get tenant entitlements |
| POST | `/api/tenant/plan-assignments/{productKey}` | Assign a product plan |
| DELETE | `/api/tenant/plan-assignments/{productKey}` | Remove a product plan assignment |

The Platform service also contains platform-administration controllers for organizations, users, memberships, and platform access. The table focuses on the principal authentication and tenant-facing API used by the current client and services.

### Workforce Service

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/workforce/employees` | Search and page employees |
| POST | `/api/workforce/employees` | Create an employee |
| GET | `/api/workforce/employees/{employeeCode}` | Get an employee |
| PATCH | `/api/workforce/employees/{employeeCode}` | Update an employee |
| GET | `/api/workforce/employees/{employeeCode}/history` | Get employee lifecycle history |
| PUT | `/api/workforce/employees/{employeeCode}/user-mapping` | Map an employee to a user |
| POST | `/api/workforce/employees/{employeeCode}/activate` | Activate an employee |
| POST | `/api/workforce/employees/{employeeCode}/leave` | Place an employee on leave |
| POST | `/api/workforce/employees/{employeeCode}/suspend` | Suspend an employee |
| POST | `/api/workforce/employees/{employeeCode}/resign` | Record resignation |
| POST | `/api/workforce/employees/{employeeCode}/terminate` | Terminate employment |
| GET | `/api/workforce/departments` | List departments |
| POST | `/api/workforce/departments` | Create a department |
| PATCH | `/api/workforce/departments/{key}` | Update a department |
| GET | `/api/workforce/designations` | List designations |
| POST | `/api/workforce/designations` | Create a designation |
| PATCH | `/api/workforce/designations/{key}` | Update a designation |
| GET | `/api/workforce/organization-structure` | Get the organization structure |
| GET | `/api/workforce/me` | Get the current user's employee profile |
| GET | `/api/workforce/me/team` | Get the current manager's team |

### Payroll Service

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/payroll/employees` | List payroll employees |
| POST | `/api/payroll/employees` | Add a payroll employee |
| GET | `/api/payroll/employees/{employeeCode}` | Get a payroll employee |
| PATCH | `/api/payroll/employees/{employeeCode}` | Update a payroll employee |
| GET | `/api/payroll/employees/{employeeCode}/compensation` | List compensation profiles |
| POST | `/api/payroll/employees/{employeeCode}/compensation` | Create a compensation profile |
| GET | `/api/payroll/employees/{employeeCode}/compensation/{profileKey}` | Get a compensation profile |
| GET | `/api/payroll/components` | List compensation components |
| POST | `/api/payroll/components` | Create a compensation component |
| PATCH | `/api/payroll/components/{componentKey}` | Update a compensation component |
| DELETE | `/api/payroll/components/{componentKey}` | Deactivate a compensation component |
| GET | `/api/payroll/employees/{employeeCode}/calculations` | List payroll calculations |
| POST | `/api/payroll/employees/{employeeCode}/calculations` | Create a payroll calculation |
| GET | `/api/payroll/pay-runs` | List pay runs |
| POST | `/api/payroll/pay-runs` | Create a pay run |
| GET | `/api/payroll/pay-runs/{payRunKey}` | Get a pay run |
| GET | `/api/payroll/pay-runs/{payRunKey}/employees` | List employees in a pay run |
| POST | `/api/payroll/pay-runs/{payRunKey}/employees` | Add an employee to a pay run |
| POST | `/api/payroll/pay-runs/{payRunKey}/process` | Process a pay run |
| POST | `/api/payroll/pay-runs/{payRunKey}/finalize` | Finalize a pay run |

### Finance Service

The current Finance Service is an intentionally limited foundation. Inspection of its source shows no Finance domain controller and therefore no implemented `/api/finance/...` business endpoint to list. It registers as `FINANCE-SERVICE`, has PostgreSQL/JPA configuration, and exposes the Spring Boot Actuator health endpoint at `GET /actuator/health`. The Gateway route is ready for future Finance APIs without implying that those APIs already exist.

### API Gateway and Eureka

The API Gateway exposes only the public route patterns shown above and has health information at `GET /actuator/health`. Eureka is available locally at `http://localhost:9003/`; registered clients use `http://localhost:9003/eureka/`, and server health is available at `http://localhost:9003/actuator/health`.

## Persistence and database boundaries

PostgreSQL is the backend database technology, accessed through Spring Data JPA and Hibernate. Each domain service has service-level datasource configuration and an intended data-ownership boundary: Platform defaults to `platform_db`, Workforce to `lexorion_workforce`, Payroll to `lexorion_payroll`, and Finance to `lexorion_finance`.

PostgreSQL is an external prerequisite and is not a Docker Compose service. Compose supplies configurable database names and a shared external host/credential connection pattern, so the repository does not claim enforced database-per-service runtime isolation. Operators must provision the required databases and permissions outside this project.

## Security model

Platform implements JWT authentication. Authenticated requests carry organization/tenant and workspace context, while role-based rules use the `OWNER`, `ADMIN`, `MANAGER`, and `MEMBER` roles. Tenant- and workspace-scoped authorization prevents one context from being treated as another.

Workforce and Payroll validate trusted authority through Platform, and Payroll also verifies employees through Workforce. Trusted organization, workspace, user, and role context is established and validated by backend services; client-supplied trusted-authority headers are not an authority mechanism.

## Docker and continuous integration

Dockerfiles are supplied for every component. `docker-compose.yml` defines seven containers/components: Eureka, Platform, Workforce, Payroll, Finance, Gateway, and the frontend. All share the `horizon` network; PostgreSQL remains external.

The root `Jenkinsfile` performs checkout, parallel backend compilation, parallel backend tests with JUnit report collection, frontend installation/lint/type checking/build, Docker image builds, and Docker Compose configuration validation. CI validates the stack but does not start containers, publish images, or manage PostgreSQL.

## Validated test results

| Project | Result |
| --- | ---: |
| Platform Service | 24 tests passed |
| Workforce Service | 39 tests passed |
| Payroll Service | 31 tests passed |
| Finance Service | 1 test passed |
| API Gateway | 3 tests passed |
| Eureka Server | 1 test passed |
| **Backend total** | **99 tests passed** |

Backend failures: **0**. Backend errors: **0**.

Frontend validation also passed:

- Lint
- TypeScript type checking
- Production build

Docker Compose configuration validation passed.

## How to run locally

### 1. Prerequisites

- Java 21
- Docker Engine with Docker Compose v2
- Node.js and npm (for direct frontend development/validation)
- A reachable PostgreSQL instance on port 5432
- Pre-created Platform, Workforce, Payroll, and Finance databases with a role permitted to access them

### 2. Configure the environment

Use environment-specific values; do not commit real credentials or secrets.

```sh
export DB_HOST='<postgres-host>'
export DB_PORT='5432'
export DB_USERNAME='<postgres-user>'
export DB_PASSWORD='<postgres-password>'
export PLATFORM_DB_NAME='platform_db'
export WORKFORCE_DB_NAME='lexorion_workforce'
export PAYROLL_DB_NAME='lexorion_payroll'
export FINANCE_DB_NAME='lexorion_finance'
export JWT_SECRET='<at-least-32-byte-secret>'
```

For Docker Desktop, `<postgres-host>` can commonly be `host.docker.internal`. PostgreSQL databases, roles, schemas, and seed data are not created by Compose.

### 3. Start the composed application

From the repository root:

```sh
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

### 4. Access the application

- Frontend: `http://localhost:9000/`
- API Gateway: `http://localhost:9001/`
- Gateway health: `http://localhost:9001/actuator/health`
- Eureka dashboard: `http://localhost:9003/`
- Eureka registry endpoint used by services: `http://localhost:9003/eureka/`
- Workforce Swagger UI: `http://localhost:9004/swagger-ui/index.html`
- Payroll Swagger UI: `http://localhost:9005/swagger-ui/index.html`

### 5. Run backend tests

Run each independent Maven project with its wrapper:

```sh
for service in platform-service workforce-service payroll-service finance-service api-gateway eureka-server; do
  (cd "backend/$service" && ./mvnw test)
done
```

Tests use service test configuration and do not require changing the external production database.

### 6. Run frontend validation

```sh
cd frontend
npm ci
npm run lint
npm run typecheck
npm run build
```

To stop the composed application without changing PostgreSQL:

```sh
docker compose down
```

## Academic clarification

The four domain microservices in this implementation are Platform, Workforce, Payroll, and Finance. User, Order, Product, and Payment in the assignment brief are examples of possible microservices; they are not requirements to rename or replace the project's actual business domains.

Lexorion Horizon therefore meets the Phase 2 objective through four domain-oriented Spring Boot projects, PostgreSQL persistence with JPA/Hibernate, synchronous REST communication where required, documented APIs, and supporting discovery, gateway, testing, frontend, containerization, and CI infrastructure.
