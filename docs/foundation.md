# Lexorion Foundation

## Scope and architecture

Lexorion Horizon currently consists of Platform, Workforce, Payroll, a Finance service shell, API Gateway, Eureka, and a legacy functional React client. Platform owns users, authentication, organizations, membership, workspaces, products, plans, assignments, and entitlement evaluation. Workforce owns employee and organization-structure data. Payroll owns compensation, salary templates, pay runs, finalized calculation snapshots, ledger entries, and payslip history. Finance is intentionally a secured service shell; no Finance business domain is claimed.

PostgreSQL schema ownership follows service ownership: `platform_db`, `lexorion_workforce`, `lexorion_payroll`, and `lexorion_finance`. Services must not read another service's database. Each schema is controlled by versioned Flyway migrations; deployed profiles use Hibernate validation rather than runtime schema mutation. V1 files are exact baselines of the previously established schemas. Existing non-empty databases are baselined at V1 and receive later migrations without destructive recreation.

## Authentication and authorization

Platform issues short-lived JWT access tokens and opaque, hashed refresh tokens. A login creates a session and token family. Refresh rotates the opaque token; presenting a previously rotated token revokes its family. Logout revokes one token and the authenticated revoke-all endpoint revokes all active sessions for the user. Production requires `JWT_SECRET`; the only fallback is in the explicit `local` profile.

The organization RBAC model is exactly `ADMIN`, `MANAGER`, and `EMPLOYEE`. ADMIN is the highest organization authority. Backend membership and resource-scope checks are authoritative; frontend visibility is not authorization. Tenant requests establish authenticated user, authoritative organization membership, role, and workspace/entitlement context as applicable. Public selectors `X-Lexorion-Organization` and `X-Lexorion-Workspace` identify requested context but never grant authority.

## Internal calls

The Gateway removes all `X-Lexorion-Trusted-*` headers and `X-Lexorion-Service-Token` supplied by clients. Internal Platform endpoints require both the delegated user credential and a service token specific to Workforce or Payroll. The Payroll-only Workforce verification endpoint likewise requires the Payroll service token in addition to the delegated, Platform-validated context. Configure independent random values of at least 32 characters in `WORKFORCE_SERVICE_TOKEN` and `PAYROLL_SERVICE_TOKEN`; rotate them through deployment secret management.

The current shared-secret mechanism is deliberately small and deployment-compatible. It authenticates the caller service but does not replace network policy or TLS. A future production deployment should source credentials from a secret manager and use TLS between services; mTLS can replace shared credentials when infrastructure supports it.

## API and operational conventions

Existing `/api/...` contracts remain compatible. New APIs should use `/api/v1/...`; existing consumers should migrate through additive aliases before any removal. Customer-facing large collections use bounded pagination. Mutating lifecycle commands reject illegal transitions, and payroll finalization persists immutable snapshots/ledger history. Retrying non-idempotent mutations is prohibited unless the operation has an explicit idempotency contract.

Errors include timestamp, status, stable `LEX-<status>` error code, safe message, path, correlation ID, and validation details where available. `X-Correlation-ID` is accepted only in a bounded safe format, otherwise generated, returned to callers, stored in logging MDC, and propagated on synchronous Workforce/Payroll calls.

Health endpoints provide liveness/readiness probes and dependency health through Actuator. Application metrics are collected by Actuator; sensitive actuator endpoints are not publicly routed. Logs and audit metadata must never contain passwords, JWT secrets, access/refresh tokens, or unnecessary employee data.

Platform stores append-oriented authentication audit events, including login, token reuse, refresh, logout, and revoke-all outcomes. Workforce lifecycle/organization change histories and Payroll's immutable ledger/history provide domain audit records. Audit tables are service-owned and are not ordinary application logs.

## Deployment topology

Compose exposes the frontend (`9000`), Gateway (`9001`), and Eureka (`9003`) on the host. Platform (`9002`), Workforce (`9004`), Payroll (`9005`), and Finance (`9006`) retain their established ports but are reachable only on the `horizon` network. PostgreSQL remains an external dependency. Required secrets are `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `WORKFORCE_SERVICE_TOKEN`, and `PAYROLL_SERVICE_TOKEN`.

The current frontend and historical wireframes are functional/legacy references, not the approved Lexorion design system. Future visual work must use the Brand Book and supplied logo assets; this foundation phase makes compatibility changes only.

## Reliability and known limits

Synchronous service clients use bounded connection/read timeouts and fail closed. There are no blind retries for employee, membership, payroll-processing, or finalization mutations. Circuit breaking is deferred until production traffic/error data justifies its operational cost. Email verification, password reset/recovery, MFA, granular permissions, billing, complete Finance, and additional HR domains remain product/engineering decisions rather than implied functionality.
