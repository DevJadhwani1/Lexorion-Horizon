# Lexorion Horizon — Product Implementation Audit

**Audit date:** 2026-10-21
**Commit audited:** `5612019` on `main` (equal to `origin/main` at the last fetch), **plus the uncommitted working tree** described below.
**Type:** Evidence-based audit only. No application code, schema or configuration was changed by the audit.

## Documents

| Document | Purpose |
|---|---|
| [horizon-feature-inventory.md](horizon-feature-inventory.md) | One row per capability, with a stable feature ID, a status for each evidence dimension, evidence and a priority |
| [horizon-service-audit.md](horizon-service-audit.md) | Responsibilities, APIs, dependencies, persistence, tests and status of each backend service |
| [horizon-frontend-audit.md](horizon-frontend-audit.md) | Routes, screens, components, API integration, UX/accessibility/responsive findings |
| [horizon-workflow-audit.md](horizon-workflow-audit.md) | End-to-end traces of the major workflows, from UI through gateway and services to the database |
| [horizon-test-coverage-audit.md](horizon-test-coverage-audit.md) | Test suites, commands run, results, coverage gaps and tests that could not run |
| [horizon-security-and-readiness-audit.md](horizon-security-and-readiness-audit.md) | Security findings, tenant-isolation verification, operational gaps and release blockers |
| [horizon-gaps-and-priorities.md](horizon-gaps-and-priorities.md) | Deduplicated backlog with feature IDs, evidence and a recommended batch order |

## Scope and sources

- **Code:** all six backend modules (`platform-service`, `workforce-service`, `payroll-service`, `finance-service`, `api-gateway`, `eureka-server`), `frontend/`, Docker Compose files, `Jenkinsfile`, `infrastructure/`, `scripts/` and Flyway migrations.
- **Requirements:** `docs/Phase-1/Synopsis/Lexorion_Horizon_Synopsis.docx` (product scope), `docs/Phase-1/ERD/` (service architecture), `docs/development-plans.md` (plan model), `docs/horizon-customer-journey.md`, `docs/invitation-lifecycle.md`, `docs/payroll-period-semantics.md` and `docs/pay-run-preparation.md`.
- **Prior audits reconciled:** `docs/horizon-current-functionality.md` (2026-10-20) and `docs/horizon-flow-audit.md`. Where these disagree with the code, this audit records the code as authoritative. The inaccuracies are listed under DOC-001 in the inventory and in [the gaps backlog](horizon-gaps-and-priorities.md).

### Scope conflict that needs a decision

The Synopsis requires Recruitment, Client, Finance (billing/invoices/payments/expenses), Notification (email/SMS/alerts) and Reporting services, plus Attendance, Leave, Performance and Asset management. Later repository documents narrow the delivered scope to Core identity, Workforce and Payroll. `docs/horizon-current-functionality.md` §11 explicitly says *"Do not introduce unrequested attendance, leave, or performance modules."* This audit marks those capabilities **Not implemented** and flags them as scope decisions, not defects.

## Working tree at audit time (preserved, not modified)

These changes are uncommitted and were audited as part of the current state:

- **Last-used organization/workspace restoration.** Platform `V10__last_used_context.sql`, `CurrentUser*` and `PUT /api/platform/me/context`, frontend `AuthProvider` and `WorkspaceProvider`, plus tests.
- **AXON login-event publisher.** `core/integration/AxonEventPublisher.java`, `AuthenticationService`, `AuditRecorder`, `application.properties` and `docker-compose.yml`.
- **Application shell redesign, in progress.** `AppShell`, `Sidebar`, `SidebarIcon`, new `AccountMenu`, `AppSwitcher` and `ContextSelector`, admin pages, `styles.css`, favicons, plus an untracked `styles.css.bak`.
- **Untracked `scratch/test-shell-experience.cjs`.** See SEC-009.

## Evidence rules

Each feature records six evidence dimensions: source implementation, frontend–backend integration, workflow completeness, automated tests, runtime verification, and security/authorization (where relevant).

- A page, endpoint, entity or button existing is not enough to count as **Implemented**.
- **Automated integration tests that exercise the workflow count as verification.** Runtime (browser/API) verification is recorded separately. When only one of the two exists, the inventory says which.
- Nothing destructive was run. Runtime checks used the local Docker stack and synthetic QA data only.

### Status definitions

| Status | Meaning |
|---|---|
| Implemented | The intended behavior is present and its workflow has been verified (automated or runtime) |
| Partially implemented | Some required behavior exists; identifiable requirements or steps are missing |
| Not implemented | Absent after checking the relevant code paths and configuration |
| Broken | Evidence shows an implemented capability fails or behaves incorrectly |
| Unverified | Evidence is insufficient to conclude it works |
| Not applicable | Demonstrably outside agreed scope |

### Priority definitions

- **P0:** critical security, data integrity, tenant isolation or a release blocker.
- **P1:** a core workflow is unavailable or materially incorrect.
- **P2:** an important functional or UX gap.
- **P3:** polish, convenience or maintainability.
- **—:** no action needed.

## Runtime environment and limitations

- **Stack.** The local Docker Compose stack (`docker-compose.yml` + `compose.mailpit.yml`), healthy, was reached through nginx `127.0.0.1:9000` and the gateway `127.0.0.1:9001`. Browser checks used installed Chrome driven by the repository's Puppeteer (`scratch/browser-test`), because the Chrome extension was unavailable.
- **Accounts.** The existing org-admin/platform-admin dev account was used. One synthetic `EMPLOYEE` account (`audit-employee-…@qa.test`) was created through the product's own invitation flow in the QA organization `flow-26096132`. Its credentials are kept outside the repository and are not reproduced here.
- **Environment correction made during the audit.** A container recreate earlier in the session (before this audit) used only `docker-compose.yml`, which dropped the Mailpit SMTP override. The platform container was recreated with both compose files (`--no-build`, same image) to restore the intended local configuration. The first audit invitation's `FAILED` delivery and the successful **Retry delivery** are recorded as runtime evidence for INV-002. INF-007 records the operational fragility.
- **Not verifiable here:**
  - production hosts (`horizon.lexorion.in`, shared cookie, TLS)
  - Jenkins execution
  - a real SMTP relay
  - manager-role browser sessions
  - write paths that would add pay runs or change plans (covered by automated tests instead)

## How to refresh this audit

1. Record `git rev-parse HEAD` and `git status --short`, and update the header of this file.
2. Run the backend suites (`./mvnw test` in each module) and the frontend checks (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm audit --omit=dev --audit-level=high`). Update [horizon-test-coverage-audit.md](horizon-test-coverage-audit.md).
3. Re-extract the endpoint inventory from `@*Mapping` and `@PreAuthorize` annotations and diff it against [horizon-service-audit.md](horizon-service-audit.md).
4. Re-run the runtime checks listed in [horizon-workflow-audit.md](horizon-workflow-audit.md).
5. Update rows in place by feature ID. Never renumber, and add new IDs at the end of each domain.
