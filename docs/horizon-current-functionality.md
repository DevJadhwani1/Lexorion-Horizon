# Lexorion Horizon — Consolidated Current-Functionality Audit

**Document Date:** October 20, 2026  
**Audited Baseline:** Repository current working tree (including verified uncommitted enhancements and additive migrations)  
**Primary Reference Documents:**
- `docs/horizon-flow-audit.md`
- `docs/horizon-customer-journey.md`
- `docs/invitation-lifecycle.md`
- `docs/database-isolation-approval.md`
- `docs/payroll-period-semantics.md`
- `docs/pay-run-preparation.md`

---

## 1. Executive Summary

Lexorion Horizon is a multi-tenant business execution platform providing **Core Identity & Organization Management**, **Workforce Management**, and **Payroll Processing**.

This document establishes the verified operational reality of Horizon. Features are evaluated strictly by what is implemented in code, validated in automated integration suites, and demonstrated end-to-end in deployed browser sessions. Speculative features, empty service shells, or documented intentions that lack implementation are categorized accordingly.

### Key Milestones Achieved
1. **End-to-End Workforce & Payroll Core Journey:** An administrator can log in, create an organization and workspace, establish departments, designations, and employees, configure salary components and compensation profiles, prepare a draft pay run with real-time period eligibility validation, process calculations, and finalize immutable double-entry ledger entries and employee payslips.
2. **P1 Invitation & Email Lifecycle Complete:** The application features complete organization invitation delivery via SMTP, captured locally by Mailpit. Invitations feature cryptographically secure token generation, SHA-256 hash persistence, URL fragment routing (`/invitations/accept#token=...`), token rotation on resend, safe failure recording, and unified onboarding for new accounts (atomic creation and acceptance) and existing accounts.
3. **P1 Payroll Period Semantics & Recovery:** Rigorous period rules enforce full calendar months or 7/14-day intervals anchored to employee eligibility. Overlapping calculation periods, mid-period profile changes, and repeat payouts of one-time earnings are prevented. Processing failures cleanly roll back and allow explicit "Recover to draft", while calculated runs support "Reset for recalculation" while preserving historical calculation objects.
4. **Pay-Run Preparation Slice:** A dedicated preparation panel inspects candidate eligibility, displays employee-specific blocking reasons without persisting calculation snapshots, and enforces explicit draft selection saves before calculation.
5. **Context & Tenant Boundary Enforcement:** Strict server-side verification ensures complete isolation across organizations and workspaces. The frontend HTTP client prevents context leakage, replaying stale headers, or race conditions during token refresh or workspace switching.

### Critical Blockers Remaining Before Production Launch
1. **P0 Database Isolation (Pending Operational Approval):** The current running Docker environment still executes all services (`platform`, `workforce`, `payroll`, `finance`) using the shared PostgreSQL superuser (`postgres`). The dedicated per-service credentials and ownership migration plan are fully prepared and verified on disposable PostgreSQL, but have **not yet been applied to the live installation**.
2. **Production SMTP Relay & Domain Configuration:** Mailpit is exclusively a local development sink. Production delivery requires operator-configured SMTP credentials, SPF/DKIM verification, and public HTTPS origin configuration.
3. **Password Recovery & Self-Service Sign-Up:** Password recovery is deliberately **not implemented** in Horizon; account recovery requires administrator intervention. Public open registration is disabled by design.
4. **Finance Service Shell:** `finance-service` exists only as a bare Spring Boot skeleton with an empty Flyway baseline; no business features, ledger ingestion, or external disbursements are implemented.

---

## 2. Current Product Capabilities

### 2.1 Core Authentication, Sessions, Organizations, and Memberships
* **Status:** `IMPLEMENTED AND VERIFIED`
* **Current Behavior:** Users authenticate via email/password. Successful authentication issues a short-lived access JWT (15-minute TTL) and a single-use refresh token (30-day TTL) stored hashed in the database. Refresh tokens are exchanged using family rotation. On browser clients, refresh tokens are delivered in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Users belong to Organizations with specific roles (`ADMIN`, `MANAGER`, `EMPLOYEE`, `OWNER`). Initial bootstrap provisioning is gated by `LEXORION_BOOTSTRAP_ENABLED` and only executes if the identity store is completely empty.
* **Relevant Frontend Pages/Components:**
  - `frontend/src/pages/LoginPage.tsx`
  - `frontend/src/pages/RegisterPage.tsx` (Informational notice directing users to contact company admin; self-registration is disabled)
  - `frontend/src/auth/AuthProvider.tsx`
  - `frontend/src/api/session.ts`
  - `frontend/src/components/auth/AuthLayout.tsx`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `POST /api/core/auth/login`, `POST /api/core/auth/refresh`, `POST /api/core/auth/logout`, `GET /api/platform/me`, `GET /api/platform/organizations`, `POST /api/platform/organizations`, `GET /api/platform/organizations/{id}`, `PATCH /api/platform/organizations/{id}`, `GET /api/tenant/organization`, `PATCH /api/tenant/organization`, `PATCH /api/tenant/organization/settings`, `GET /api/tenant/organization/members`, `PATCH /api/tenant/organization/members/{id}/role`, `DELETE /api/tenant/organization/members/{id}`
  - Services: `AuthenticationService`, `UserService`, `OrganizationService`, `TenantAdministrationService`, `InitialPlatformAdminBootstrap`
* **Data Models & Migrations:**
  - `users`, `refresh_tokens`, `organizations`, `organization_memberships`, `horizon_membership_roles`
  - Platform Migrations: `V1__baseline.sql`, `V2__rbac_and_session_security.sql`, `V3__audit_foundation.sql`, `V7__core_membership_ownership.sql`
* **Authorization & Tenant/Workspace Enforcement:** Enforced by Spring Security filters (`JwtAuthenticationFilter`, `CoreBearerFilter`, `TenantAccessContextFilter`). Tenant requests require active organization membership.
* **Existing Tests:**
  - `backend/platform-service/src/test/java/com/lexorion/platform/auth/AuthenticationSessionIntegrationTest.java`
  - `backend/platform-service/src/test/java/com/lexorion/platform/CoreStandaloneIntegrationTest.java`
  - `backend/platform-service/src/test/java/com/lexorion/platform/CoreFoundationIntegrationTest.java`
  - `backend/platform-service/src/test/java/com/lexorion/platform/bootstrap/InitialPlatformAdminBootstrapTest.java`
  - `frontend/src/auth/AuthProvider.test.tsx`
* **Verification Evidence:** Automated tests pass; verified in Chrome browser for login, session recovery, cookie persistence, and role modification.
* **Known Limitations:** Inactive existing accounts require administrative reactivation. No self-service password reset.
* **End-to-End Usability:** Yes.

---

### 2.2 Workspaces, Organization Context, Roles, and Entitlements
* **Status:** `IMPLEMENTED AND VERIFIED`
* **Current Behavior:** Organizations can define multiple workspaces. Workspaces contain assigned Horizon products (`workforce`, `payroll`). Organizations subscribe to plans (`starter`, `business`, `enterprise`) that determine workspace quotas and feature entitlements (e.g., `payroll.processing`, `workforce.custom_fields`). Workspace keys are unique within a tenant organization (tenant-scoped), allowing separate companies to each use standard names like `main`.
* **Relevant Frontend Pages/Components:**
  - `frontend/src/pages/admin/AdminWorkspaces.tsx`
  - `frontend/src/pages/admin/AdminPage.tsx` (Entitlements view)
  - `frontend/src/workspace/WorkspaceProvider.tsx`
  - `frontend/src/context/ApplicationContext.tsx`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `GET /api/tenant/workspaces/accessible`, `POST /api/tenant/workspaces`, `GET /api/tenant/workspaces`, `PATCH /api/tenant/workspaces/{id}/status`, `PATCH /api/tenant/workspaces/{id}/products`, `GET /api/tenant/organization/entitlements`
  - Services: `WorkspaceAccessService`, `HorizonWorkspaceService`, `PlanEntitlementService`
* **Data Models & Migrations:**
  - `horizon_workspaces`, `horizon_products`, `horizon_workspace_products`, `plans`, `products`, `organization_plans`
  - Platform Migrations: `V4__cross_product_plans.sql`, `V5__workspace_products.sql`, `V6__lexorion_core_product_access.sql`, `V8__organization_plan_assignment.sql`
  - Workforce `V2__workspace_keys_are_tenant_local.sql`, Payroll `V6__workspace_keys_are_tenant_local.sql`
* **Authorization & Tenant/Workspace Enforcement:** `WorkspaceAccessService` verifies workspace ownership, `ACTIVE` status, and attached product entitlements. Gateway strips any client-supplied `X-Lexorion-Trusted-*` headers.
* **Existing Tests:**
  - `backend/platform-service/src/test/java/com/lexorion/platform/workspace/WorkspaceSecurityIntegrationTest.java`
  - `backend/platform-service/src/test/java/com/lexorion/platform/entitlement/EntitlementSecurityIntegrationTest.java`
  - `frontend/src/pages/admin/AdminWorkspaces.test.tsx`
  - `frontend/src/workspace/WorkspaceProvider.test.tsx`
* **Verification Evidence:** Passed 18 entitlement security tests; verified in browser that detached products immediately block access (HTTP 403), and quota enforcement prevents exceeding plan limits.
* **Known Limitations:** Product attachments must be managed by an administrator. Detaching a product disables API access but preserves existing historical data.
* **End-to-End Usability:** Yes.

---

### 2.3 Horizon Shell, Dashboard, Navigation, and Onboarding
* **Status:** `IMPLEMENTED AND VERIFIED`
* **Current Behavior:** The Horizon UI presents a unified application shell with persistent organization and workspace selectors. The overview dashboard (`HomePage.tsx`) identifies active context, provides a guided setup checklist distinguishing required calculation prerequisites (Workforce enrollment, Payroll enrollment, Compensation profile) from optional steps (Departments, Designations, Reporting structure, Salary templates), reports real-time payroll readiness counts, and displays recent pay runs with deep links.
* **Relevant Frontend Pages/Components:**
  - `frontend/src/layout/AppShell.tsx`
  - `frontend/src/layout/Sidebar.tsx`
  - `frontend/src/pages/HomePage.tsx`
  - `frontend/src/components/HorizonWorkflowNav.tsx`
  - `frontend/src/app/Router.tsx`
  - `frontend/src/app/RouteErrorPage.tsx`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `GET /api/payroll/readiness`, `GET /api/payroll/pay-runs`, `GET /api/tenant/workspaces/accessible`
  - Services: `PayrollReadinessService`, `PayRunService`
* **Data Models & Migrations:** No dedicated shell tables; consumes projections over `payroll_employees`, `compensation_profiles`, and `pay_runs`.
* **Authorization & Tenant/Workspace Enforcement:** Route guards check application mode, active tenant membership, and product availability. HTTP client discards responses from outdated contexts.
* **Existing Tests:**
  - `frontend/src/pages/HomePage.test.tsx`
  - `frontend/src/layout/AppShell.test.tsx`
  - `frontend/src/components/HorizonWorkflowNav.test.tsx`
  - `frontend/src/api/httpClient.test.ts`
* **Verification Evidence:** 58 frontend Vitest tests passed. Verified in Chrome that switching organizations resets forms, cancels inflight requests, and prevents data replay.
* **Known Limitations:** Overview readiness counts represent configuration existence, not period-specific eligibility.
* **End-to-End Usability:** Yes.

---

### 2.4 Workforce: Departments, Designations, Employees, and Reporting
* **Status:** `IMPLEMENTED AND VERIFIED`
* **Current Behavior:** Manages workforce master data within an active workspace. Supports creating departments, designations, and employee profiles with unique employee codes, personal and contact information, joining dates, and employment status (`ACTIVE`, `TERMINATED`, `ON_LEAVE`). Supports hierarchical reporting managers and rendering the reporting tree. Supports linking platform user IDs to employee records for self-service (`/api/workforce/me`).
* **Relevant Frontend Pages/Components:**
  - `frontend/src/pages/workforce/WorkforcePage.tsx` (Subsections: `dashboard`, `employees`, `departments`, `designations`, `structure`, `team`, `me`)
  - `frontend/src/features/workforce/workforceApi.ts`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `GET/POST /api/workforce/departments`, `GET/POST /api/workforce/designations`, `GET/POST /api/workforce/employees`, `GET/PATCH /api/workforce/employees/{code}`, `PUT /api/workforce/employees/{code}/user-mapping`, `GET /api/workforce/structure`, `GET /api/workforce/team`, `GET /api/workforce/me`
  - Services: `EmployeeService`, `DepartmentService`, `DesignationService`, `SelfServiceService`, `StructureService`
* **Data Models & Migrations:**
  - `workforce_workspaces`, `departments`, `designations`, `employees`
  - Workforce Migrations: `V1__baseline.sql`, `V2__workspace_keys_are_tenant_local.sql`
* **Authorization & Tenant/Workspace Enforcement:** `TrustedTenantFilter` inspects gateway-trusted headers. Methods enforce `@PreAuthorize("hasRole('ADMIN')")` or `@PreAuthorize("hasAnyRole('ADMIN','MANAGER')")`. `/api/workforce/me` strictly derives employee context from the authenticated user token.
* **Existing Tests:**
  - `backend/workforce-service/src/test/java/com/lexorion/workforce/WorkforceSecurityIntegrationTest.java` (46 tests passed)
  - `backend/workforce-service/src/test/java/com/lexorion/workforce/migration/PostgresMigrationTest.java`
* **Verification Evidence:** All 46 workforce security and functionality tests passed. Verified in browser that cyclic manager assignments are rejected, employee email normalization is enforced, and non-admin users cannot access administrative employee endpoints.
* **Known Limitations:** Leave management, attendance tracking, shift scheduling, and performance reviews are not implemented.
* **End-to-End Usability:** Yes.

---

### 2.5 Compensation: Components, Templates, Profiles, and Assignments
* **Status:** `IMPLEMENTED AND VERIFIED`
* **Current Behavior:** Manages compensation structure. Components are categorized by type (`FIXED_EARNING`, `PERCENTAGE_EARNING`, `FIXED_DEDUCTION`, `PERCENTAGE_DEDUCTION`) and occurrence (`RECURRING`, `ONE_TIME`). Percentage components declare a basis component key. Salary templates version component bundles. Compensation profiles define an employee's effective salary package from an `effectiveFrom` date, snapshotting the employee's pay frequency (`MONTHLY`, `WEEKLY`, `BIWEEKLY`). Component assignments can override default amounts or percentages.
* **Relevant Frontend Pages/Components:**
  - `frontend/src/pages/payroll/PayrollPage.tsx` (Subsections: `components`, `compensation`, `salary-templates`)
  - `frontend/src/features/payroll/payrollApi.ts`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `GET/POST /api/payroll/components`, `GET/POST /api/payroll/salary-templates`, `POST /api/payroll/salary-templates/{key}/versions`, `GET/POST /api/payroll/compensation-profiles`, `GET /api/payroll/compensation-profiles/{employeeCode}`
  - Services: `CompensationService`, `ComponentService`, `SalaryTemplateService`
* **Data Models & Migrations:**
  - `payroll_components`, `salary_templates`, `salary_template_versions`, `salary_template_components`, `compensation_profiles`, `component_assignments`
  - Payroll Migrations: `V1__baseline.sql` through `V5__salary_template_updates.sql`, `V7__payroll_period_snapshots_and_recovery.sql`
* **Authorization & Tenant/Workspace Enforcement:** Scoped to workspace UUID via `TrustedTenantFilter`. Modifying compensation requires `ADMIN` role.
* **Existing Tests:**
  - `backend/payroll-service/src/test/java/com/lexorion/payroll/PayrollCalculationIntegrationTest.java`
  - `backend/payroll-service/src/test/java/com/lexorion/payroll/PayrollSecurityIntegrationTest.java`
* **Verification Evidence:** Automated tests pass; verified in browser that missing compensation surfaces clear setup links, and component assignments correctly validate currency and non-negative values.
* **Known Limitations:** Proration for mid-period compensation start dates is not supported; profiles must align with pay period boundaries. Off-cycle bonus assignments are not supported.
* **End-to-End Usability:** Yes.

---

### 2.6 Payroll: Periods, Eligibility, Preparation, Calculation, Processing, and Recovery
* **Status:** `IMPLEMENTED AND VERIFIED`
* **Current Behavior:**
  - **Period Semantics:** Enforces strict calendar months or anchored 7/14-day periods. Employees must have an active compensation profile covering the entire period. Frequencies must match.
  - **One-Time Assignments:** One-time components only contribute in the profile's first aligned period and are verified against committed historical lines to prevent duplicate payouts.
  - **Preparation Panel:** `GET /api/payroll/pay-runs/{key}/preparation` calculates candidate eligibility and specific blocking reasons without persisting calculation records. Draft membership is updated via `PUT /api/payroll/pay-runs/{key}/preparation` and requires explicit save before calculation.
  - **Processing & Concurrency:** Processing acquires a database lock on the workspace. Concurrent overlapping runs are rejected. Calculations are evaluated atomically per employee.
  - **Failure & Recovery:** Any calculation error rolls back all employee snapshots and marks the run `FAILED` with a sanitized reason. Administrators can invoke "Recover to draft" to correct inputs and retry. `CALCULATED` runs can execute "Reset for recalculation", which detaches prior calculations and returns the run to `DRAFT` while preserving audit snapshots.
* **Relevant Frontend Pages/Components:**
  - `frontend/src/pages/payroll/PayrollPage.tsx` (Subsections: `pay-runs`, `calculations`)
  - `frontend/src/pages/payroll/PayRunPreparation.tsx`
  - `frontend/src/features/payroll/payrollApi.ts`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `GET/POST /api/payroll/pay-runs`, `GET /api/payroll/pay-runs/{key}`, `GET/PUT /api/payroll/pay-runs/{key}/preparation`, `POST /api/payroll/pay-runs/{key}/process`, `POST /api/payroll/pay-runs/{key}/recover`, `POST /api/payroll/pay-runs/{key}/reset`, `POST /api/payroll/pay-runs/{key}/finalize`, `POST /api/payroll/calculations` (standalone preview)
  - Services: `PayRunPreparationService`, `PayRunProcessingService`, `PayRunTransactions`, `CalculationService`, `PayRunEligibility`, `PayrollPeriod`
* **Data Models & Migrations:**
  - `pay_runs`, `pay_run_employees`, `calculations`, `calculation_lines`
  - Payroll Migrations: `V1__baseline.sql`, `V6__workspace_keys_are_tenant_local.sql`, `V7__payroll_period_snapshots_and_recovery.sql`
* **Authorization & Tenant/Workspace Enforcement:** Requires active workspace context, `ADMIN` role, and commercial `payroll.processing` entitlement.
* **Existing Tests:**
  - `backend/payroll-service/src/test/java/com/lexorion/payroll/PayrollPayRunIntegrationTest.java` (26 tests)
  - `backend/payroll-service/src/test/java/com/lexorion/payroll/PayrollPreparationPostgresTest.java` (27 tests against real PostgreSQL)
  - `backend/payroll-service/src/test/java/com/lexorion/payroll/PayrollCalculationIntegrationTest.java` (10 tests)
  - `frontend/src/pages/payroll/PayRunPreparation.test.tsx`
  - `frontend/src/pages/payroll/PayrollPage.test.tsx`
* **Verification Evidence:** All 76 backend Payroll tests passed. Verified in Chrome that invalid periods fail with HTTP 409, blocked employees cannot be processed, failed runs recover to draft cleanly, and reset runs preserve calculation history.
* **Known Limitations:** Candidate list in preparation is currently unpaginated in the UI. Tax withholding rules and localized statutory deductions are not implemented.
* **End-to-End Usability:** Yes.

---

### 2.7 Ledger and Payslips
* **Status:** `IMPLEMENTED AND VERIFIED`
* **Current Behavior:** Finalizing a calculated pay run atomically transitions `PayRun` status to `FINALIZED`, creates balanced double-entry ledger entries (payroll expenses and liabilities), and generates immutable payslips for all included employees. Repeated finalization calls are rejected with HTTP 409 Conflict. Finalized runs cannot be modified, reset, or deleted. Employees can view their payslips via self-service.
* **Relevant Frontend Pages/Components:**
  - `frontend/src/pages/payroll/PayrollPage.tsx` (Subsections: `ledger`, `payslips`)
  - `frontend/src/features/payroll/payrollApi.ts`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `GET /api/payroll/ledger`, `GET /api/payroll/payslips`, `POST /api/payroll/pay-runs/{key}/finalize`
  - Services: `PayrollLedgerService`, `PayslipService`, `PayRunProcessingService`
* **Data Models & Migrations:**
  - `payroll_ledger_entries`, `employee_payslips`
  - Payroll Migrations: `V1__baseline.sql`, `V7__payroll_period_snapshots_and_recovery.sql`
* **Authorization & Tenant/Workspace Enforcement:** Scoped to workspace. Viewing ledger requires `ADMIN`. Payslip listing allows admins to view all payslips, while employees can only retrieve their own payslips.
* **Existing Tests:**
  - Covered in `PayrollPayRunIntegrationTest.java`, `PayrollPreparationPostgresTest.java`, and `PayrollSecurityIntegrationTest.java`.
* **Verification Evidence:** Verified in live Chrome that finalizing a run generates debit/credit balanced ledger rows and accessible payslips matching calculated net amounts.
* **Known Limitations:** Ledger entries are internal accounting records; no external banking, payment file export (e.g., NACHA, SEPA), or Finance integration exists.
* **End-to-End Usability:** Yes.

---

### 2.8 Email Lifecycle and Mailpit Configuration
* **Status:** `IMPLEMENTED AND VERIFIED` (Invitations, Failure/Retry, Mailpit Sink); `NOT IMPLEMENTED` (Password Recovery, Open Registration)
* **Current Behavior:**
  - **Delivery Sink:** Outgoing emails are handled by `SmtpInvitationDelivery` and routed to the Mailpit container (`lexorion-horizon-mailpit-1`) on internal port `1025`. Mailpit UI/API is available at `http://localhost:8025`.
  - **Invitations:** Creating an invitation generates a cryptographically secure token, stores its SHA-256 hash in `organization_invitations`, and sends an email containing `/invitations/accept#token=<token>`.
  - **Failure & Retry:** SMTP failures are captured, recording `delivery_status = 'FAILED'` and a safe user-facing message. Administrators can invoke retry, which rotates the token, invalidates prior links, and preserves the original expiration date.
  - **Acceptance:** Unauthenticated preview returns email and organization name. New users register name and password via `POST /api/invitations/register`, which creates the Core account and accepts the invitation atomically. Existing users log in and accept via `POST /api/invitations/accept`.
  - **Password Recovery:** Explicitly **not implemented**. The login page displays "Forgot password? Unavailable" with a tooltip noting it is unsupported.
* **Relevant Frontend Pages/Components:**
  - `frontend/src/pages/InvitationPage.tsx`
  - `frontend/src/pages/admin/AdminPage.tsx` (Invitations table)
  - `frontend/src/pages/LoginPage.tsx`
* **Relevant Backend Endpoints/Services:**
  - Endpoints: `POST /api/tenant/invitations`, `GET /api/tenant/invitations`, `POST /api/tenant/invitations/{id}/resend`, `DELETE /api/tenant/invitations/{id}`, `POST /api/invitations/preview`, `POST /api/invitations/register`, `POST /api/invitations/accept`
  - Services: `OrganizationInvitationService`, `InvitationRegistrationService`, `InvitationTokenService`, `SmtpInvitationDelivery`
* **Data Models & Migrations:**
  - `organization_invitations` (`token_hash`, `status`, `expires_at`, `delivery_status`, `delivery_error`, `delivery_attempted_at`)
  - Platform Migration: `V9__invitation_delivery_tracking.sql`
* **Authorization & Tenant/Workspace Enforcement:** Managing invitations requires tenant `ADMIN`. Preview and registration are public (`permitAll`); acceptance requires matching authenticated email.
* **Existing Tests:**
  - `backend/platform-service/src/test/java/com/lexorion/platform/invitation/InvitationLifecycleIntegrationTest.java` (5 integration tests)
  - `backend/platform-service/src/test/java/com/lexorion/horizon/invitation/delivery/SmtpInvitationDeliveryTest.java` (5 unit tests covering origin validation, link generation, and error handling)
  - `frontend/src/pages/InvitationPage.test.tsx` (4 component tests)
* **Verification Evidence:** Verified against live Mailpit container: simulated relay outage caused `FAILED` delivery; starting Mailpit and selecting retry delivered a fresh rotated link; link accepted in browser.
* **Known Limitations:** Mailpit is for local testing only; messages never leave the container. Production requires an operator-configured relay. Password reset is unsupported.
* **End-to-End Usability:** Yes for invitations and registration; No for password recovery.

---

### 2.9 PostgreSQL Isolation, Service Database Boundaries, and Production Migration Status
* **Status:** `BLOCKED BY OPERATIONAL APPROVAL`
* **Current Behavior:**
  - In the **current live environment**, all four services (`platform`, `workforce`, `payroll`, `finance`) connect to PostgreSQL using the shared superuser `postgres` against four databases (`platform_db`, `lexorion_workforce`, `lexorion_payroll`, `lexorion_finance`).
  - In the **prepared isolation plan** (`docs/database-isolation-approval.md`), each service receives a dedicated runtime role (e.g., `horizon_payroll`) with table CRUD and sequence permissions, and a separate migration role (e.g., `horizon_payroll_migrator`) that owns the database and executes Flyway DDL.
  - The isolation package was verified on disposable PostgreSQL: 48 cross-database access checks confirmed that services cannot access other service databases or maintenance databases.
* **Relevant Files & Scripts:**
  - `compose.db-isolation.yml`
  - `scripts/db-isolation/manage.py`
  - `scripts/db-isolation/configure-runtime.py`
  - `scripts/db-isolation/test-disposable.py`
  - `scripts/deployment-config.py`
  - `docs/database-isolation-approval.md`
* **Data Models & Migrations:** Platform V1–V9, Workforce V1–V2, Payroll V1–V7, Finance V1.
* **Verification Evidence:** Verified on disposable PostgreSQL clusters in prior audit passes.
* **Known Limitations:** Production database ownership has not been transferred. Executing the migration requires an approved maintenance window and the explicit invocation of `python3 scripts/db-isolation/manage.py apply --execute-reviewed-plan`.
* **End-to-End Usability:** The application is fully functional today using the shared role, but remains blocked for secure production multi-tenant deployment until isolation is applied.

---

### 2.10 Deployment Configuration, Observability, and Production Readiness
* **Status:** `IMPLEMENTED, PARTIALLY VERIFIED`
* **Current Behavior:** Docker Compose defines the multi-service architecture with strict environment variable checks. Missing required secrets cause immediate startup failure. Internal infrastructure ports (PostgreSQL, Eureka) are bound to `127.0.0.1`. API Gateway injects and preserves `X-Correlation-ID` headers across microservices. Spring Boot Actuator exposes `/actuator/health` and `/actuator/info`.
* **Relevant Configuration Files:**
  - `docker-compose.yml`, `compose.mailpit.yml`, `compose.db-isolation.yml`
  - `backend/api-gateway/src/main/resources/application.properties`
  - `frontend/nginx.conf`
* **Verification Evidence:** Compose validation tests reject weak or missing secrets. Health probes actively monitor container readiness.
* **Known Limitations:**
  - Eureka service registration can experience a 5–15 second lag after cold restarts.
  - Production HTTPS certificates and public reverse proxy (DNS/TLS) are external and not managed in repo.
  - Finance service is an unintegrated shell.
* **End-to-End Usability:** Fully usable locally and in test environments. Production deployment requires external TLS and database isolation approval.

---

## 3. Actual End-to-End Customer Journey

Below is the verified customer journey executable in Lexorion Horizon today:

```
[Operator Provisioning]
         │
         ▼
[Admin Workspace & Setup] ────────► [Invite Users via Mailpit] ──► [Recipient Register & Accept]
         │
         ▼
[Workforce Structure & Employees]
         │
         ▼
[Payroll Enrollment & Compensation]
         │
         ▼
[Pay-Run Preparation (Eligibility & Draft Selection)]
         │
         ▼
[Process Calculation & Snapshots] (Failed? ──► [Recover to Draft] ──► Retry)
         │
         ▼
[Review Calculated Totals] (Need changes? ──► [Reset for Recalculation])
         │
         ▼
[Finalize Pay Run]
         │
         ├──────────────────────────────┐
         ▼                              ▼
[Balanced Double-Entry Ledger]    [Immutable Employee Payslips]
```

### Phase 1: Platform Provisioning & Onboarding
1. An operator signs in at `/login` with credentials (e.g., `admin@lexorion.in`).
2. Navigates to Platform Administration (`/platform/organizations`) and creates an organization (e.g., `Test Org`, slug `test-org`).
3. Selects the organization, activates it (`ACTIVE`), and assigns a commercial plan (`Starter` or `Business`).

### Phase 2: Organization Administration & Invitations
1. The organization administrator enters the organization workspace at `/organization`.
2. Creates an active workspace (e.g., `main` or `flow-a`) and enables `workforce` and `payroll` products.
3. Opens `/organization/invitations` and issues an invitation for a new employee.
4. The system validates the email, persists the SHA-256 token hash, and submits the email to Mailpit.
5. In Mailpit (`http://localhost:8025`), the administrator can view the delivered message containing the link `http://localhost/invitations/accept#token=<rawToken>`.

### Phase 3: Recipient Onboarding & Activation
1. The invited user opens the invitation link in their browser.
2. The page calls `POST /api/invitations/preview` without authentication, displaying the organization name and verifying `accountExists: false`.
3. The recipient enters their first name, last name, and password, then submits "Create account and accept".
4. The backend atomically creates the Core user record, creates the active organization membership, and marks the invitation `ACCEPTED`.
5. The recipient is automatically logged in and redirected into their new organization console.

### Phase 4: Workforce Setup
1. The administrator navigates to `/workforce/departments` and creates departments (e.g., `Engineering`).
2. Navigates to `/workforce/designations` and creates designations (e.g., `Software Engineer`).
3. Navigates to `/workforce/employees` and creates an employee (e.g., `EMP-001`, `Grace Hopper`, joining date `2026-01-01`).
4. Optionally edits the employee profile to assign a reporting manager and inspects the reporting tree in `/workforce/structure`.

### Phase 5: Compensation Setup
1. Navigates to `/payroll/employees` and enrolls `EMP-001` into Payroll (setting pay currency `USD`, frequency `MONTHLY`, effective date `2026-01-01`).
2. Navigates to `/payroll/components` and defines earning/deduction components (e.g., recurring fixed earning `Base Salary`, one-time earning `Performance Bonus`).
3. Navigates to `/payroll/compensation`, selects `EMP-001`, and creates an active compensation profile assigning the components.

### Phase 6: Pay-Run Preparation, Calculation, and Processing
1. Navigates to `/payroll/runs` and creates a new Draft pay run (e.g., key `RUN-2026-10`, period `2026-10-01` to `2026-10-31`, calculation date `2026-10-31`, currency `USD`).
2. Opens the preparation panel: The backend evaluates active Payroll employees against the period. Eligible employees show a green badge; employees with missing compensation or mismatched frequencies display clear blocking explanations.
3. Selects eligible employees and clicks **Save selection**.
4. The status updates to **Ready to calculate**. The admin clicks **Process**.
5. The backend acquires the workspace lock, evaluates compensation lines, and creates frozen calculation snapshots.
   - *If a failure occurs:* Status transitions to `FAILED`. The admin resolves the issue and clicks **Recover to draft** to retry.
   - *If calculation changes are needed:* The admin clicks **Reset for recalculation** to return the run to `DRAFT` while preserving audit records.

### Phase 7: Finalization, Ledger, and Payslip Generation
1. The administrator reviews calculated gross, deduction, and net totals.
2. Clicks **Finalize pay run**.
3. The backend transitions the pay run to `FINALIZED` and atomically creates:
   - Balanced double-entry ledger entries in `payroll_ledger_entries`.
   - Immutable employee payslips in `employee_payslips`.
4. The admin reviews ledger entries under `/payroll/ledger` and payslips under `/payroll/payslips`.

### Phase 8: Employee Self-Service & Multi-Tenant Switching
1. An employee signs in with their account.
2. Navigating to `/workforce/me` displays their profile information.
3. Navigating to `/payroll/payslips` allows them to view and inspect their finalized payslips.
4. Users with memberships in multiple organizations switch tenants using the top navigation header; the frontend immediately fences and re-verifies access context.

---

## 4. Feature-by-Feature Functionality Matrix

| Module | Feature / Capability | Frontend Route / Component | Backend Endpoint(s) | Operational Status | Verification Type |
|---|---|---|---|---|---|
| **Core Auth** | Email/Password Login | `/login` (`LoginPage`) | `POST /api/core/auth/login` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Core Auth** | Session Refresh & HttpOnly Cookie | `AuthProvider` | `POST /api/core/auth/refresh` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Core Auth** | Logout | `AppShell` User Menu | `POST /api/core/auth/logout` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Core Auth** | Self-Service Public Registration | `/register` (`RegisterPage`) | N/A (Disabled) | `NOT IMPLEMENTED` | Source / UI Confirmed |
| **Core Auth** | Password Recovery / Reset | `/login` ("Forgot password") | N/A (Disabled) | `NOT IMPLEMENTED` | Source / UI Confirmed |
| **Platform** | Organization Directory & Creation | `/platform/organizations` | `GET/POST /api/platform/organizations` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Platform** | Plan Assignment & Activation | `/platform/organizations/:id` | `PATCH /api/platform/organizations/:id` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workspaces** | Workspace Management | `/organization/workspaces` | `GET/POST /api/tenant/workspaces` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workspaces** | Product Attachment & Quotas | `/organization/workspaces` | `PATCH /api/tenant/workspaces/:id/products` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workspaces** | Tenant-Local Workspace Keys | `AdminWorkspaces` | `POST /api/tenant/workspaces` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Invitations**| Organization User Invitations | `/organization/invitations` | `POST /api/tenant/invitations` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Invitations**| Mailpit Local SMTP Delivery | Mailpit Web UI (`:8025`) | Internal SMTP `:1025` | `IMPLEMENTED AND VERIFIED` | Automated + Live Mailpit |
| **Invitations**| Delivery Failure & Retry | `/organization/invitations` | `POST /api/tenant/invitations/:id/resend` | `IMPLEMENTED AND VERIFIED` | Automated + Live Mailpit |
| **Invitations**| Token Rotation & Expiry | `/invitations/accept` | `POST /api/invitations/preview` | `IMPLEMENTED AND VERIFIED` | Automated + Live Mailpit |
| **Invitations**| New User Register & Accept | `/invitations/accept` | `POST /api/invitations/register` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Invitations**| Existing User Sign-in & Accept | `/invitations/accept` | `POST /api/invitations/accept` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Overview**   | Guided Setup Checklist | `/overview` (`HomePage`) | Projections over entities | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Overview**   | Readiness Projections | `/overview` (`HomePage`) | `GET /api/payroll/readiness` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Overview**   | Recent Pay Runs & Continuation | `/overview` (`HomePage`) | `GET /api/payroll/pay-runs` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workforce**  | Department Master Data | `/workforce/departments` | `GET/POST /api/workforce/departments` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workforce**  | Designation Master Data | `/workforce/designations` | `GET/POST /api/workforce/designations` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workforce**  | Employee Management | `/workforce/employees` | `GET/POST/PATCH /api/workforce/employees`| `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workforce**  | Reporting Hierarchy & Structure| `/workforce/structure` | `GET /api/workforce/structure` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workforce**  | Self-Service Profile (`/me`) | `/workforce/me` | `GET /api/workforce/me` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Workforce**  | Leave & Attendance | N/A | N/A | `NOT IMPLEMENTED` | Source Confirmed |
| **Workforce**  | Performance & Recruitment | N/A | N/A | `NOT IMPLEMENTED` | Source Confirmed |
| **Payroll**    | Payroll Employee Enrollment | `/payroll/employees` | `GET/POST /api/payroll/employees` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Salary Components & Templates | `/payroll/components` | `GET/POST /api/payroll/components` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Compensation Profiles | `/payroll/compensation` | `GET/POST /api/payroll/compensation-profiles` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Pay-Run Preparation Panel | `/payroll/runs` | `GET/PUT /api/payroll/pay-runs/:key/preparation` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Standalone Calculation Preview| `/payroll/calculations` | `POST /api/payroll/calculations` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Period Semantics & One-Time Rules| Pay Run Processing | `POST /api/payroll/pay-runs/:key/process` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Processing & Failure Recovery | `/payroll/runs` | `POST /api/payroll/pay-runs/:key/recover` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Reset for Recalculation | `/payroll/runs` | `POST /api/payroll/pay-runs/:key/reset` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Finalization & Snapshot Freeze| `/payroll/runs` | `POST /api/payroll/pay-runs/:key/finalize` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Double-Entry General Ledger | `/payroll/ledger` | `GET /api/payroll/ledger` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | Immutable Payslips | `/payroll/payslips` | `GET /api/payroll/payslips` | `IMPLEMENTED AND VERIFIED` | Automated + Browser |
| **Payroll**    | External Bank Disbursements | N/A | N/A | `NOT IMPLEMENTED` | Source Confirmed |
| **Database**   | Service Database Separation | PostgreSQL Catalog | Separate DBs on shared host | `IMPLEMENTED AND VERIFIED` | Docker / Catalog |
| **Database**   | Dedicated Database Roles | PostgreSQL Grants | `scripts/db-isolation/manage.py` | `BLOCKED BY OPERATIONAL APPROVAL` | Disposable Cluster |
| **Finance**    | Finance Service Business Logic| N/A | `GET /api/finance/**` (Shell only) | `NOT IMPLEMENTED` | Source Confirmed |

---

## 5. Architecture and Service Boundaries

```
                             Browser Client
                                   │
               ┌───────────────────┴───────────────────┐
               ▼ (Port 80/9000)                        ▼ (Port 8025)
      [ Frontend: Nginx ]                        [ Mailpit Web UI ]
               │
               ▼ (Port 9001)
     [ API Gateway: Spring Cloud Gateway MVC ]
               │
      ┌────────┼────────────────┬────────────────┐
      ▼        ▼                ▼                ▼
 [Platform] [Workforce]     [Payroll]        [Finance]
  (Port 9002) (Port 9004)   (Port 9005)      (Port 9006 - Shell)
      │        │                │                │
      └────────┼────────────────┼────────────────┘
               ▼                ▼
     [ Eureka: Port 9003 ]  [ PostgreSQL: Port 5432 ]
                             ├── platform_db
                             ├── lexorion_workforce
                             ├── lexorion_payroll
                             └── lexorion_finance
```

### 5.1 Service Topologies & Deployables
1. **Frontend (`lexorion-horizon-frontend`):** React 18, TypeScript, Vite, served via Nginx on port `9000` (mapped to `80` and `9000`). Handles route authentication, context persistence, and UI rendering.
2. **API Gateway (`api-gateway`):** Spring Cloud Gateway Server WebMVC running on port `9001`. Strips untrusted authority headers (`X-Lexorion-Trusted-*`), preserves host headers, and routes traffic via Eureka service discovery:
   - `/api/core/**` ➔ `lb://PLATFORM-SERVICE`
   - `/api/platform/**` ➔ `lb://PLATFORM-SERVICE`
   - `/api/tenant/**` ➔ `lb://PLATFORM-SERVICE`
   - `/api/invitations/**` ➔ `lb://PLATFORM-SERVICE`
   - `/api/workforce/**` ➔ `lb://WORKFORCE-SERVICE`
   - `/api/payroll/**` ➔ `lb://PAYROLL-SERVICE`
   - `/api/finance/**` ➔ `lb://FINANCE-SERVICE`
3. **Platform Service (`platform-service`):** Spring Boot service on port `9002`. Houses Core identity, authentication, platform administration, organization plans, workspaces, and organization invitations.
4. **Workforce Service (`workforce-service`):** Spring Boot service on port `9004`. Houses departments, designations, employee master records, and reporting hierarchy.
5. **Payroll Service (`payroll-service`):** Spring Boot service on port `9005`. Houses compensation components, profiles, salary templates, pay-run state machine, calculation engine, ledger, and payslips.
6. **Finance Service (`finance-service`):** Spring Boot service on port `9006`. Currently a skeleton shell containing Eureka registration, Actuator, and an empty baseline Flyway table.
7. **Eureka Server (`eureka-server`):** Spring Cloud Netflix Eureka registry running on port `9003`.

### 5.2 Service-to-Service Communication
- Services communicate over HTTP using Eureka discovery.
- Cross-service requests (e.g., Payroll verifying that a workforce employee exists) pass trusted service tokens (`WORKFORCE_SERVICE_TOKEN`, `PAYROLL_SERVICE_TOKEN`).
- No service directly queries another service's database tables.

---

## 6. Email Lifecycle and Mailpit Configuration

### 6.1 Configuration
- Defined in `compose.mailpit.yml`:
  ```yaml
  services:
    mailpit:
      image: axllent/mailpit:v1.29
      ports: ["127.0.0.1:8025:8025"]
      networks: [horizon]
    platform:
      environment:
        SMTP_HOST: mailpit
        SMTP_PORT: 1025
        SMTP_AUTH: "false"
        SMTP_STARTTLS: "false"
        INVITATION_FROM: horizon@local.test
        INVITATION_PUBLIC_ORIGIN: http://localhost
  ```
- `platform-service` configures bounded timeouts:
  - Connection timeout: 3,000 ms
  - Socket read timeout: 5,000 ms
  - Socket write timeout: 5,000 ms
  - `management.health.mail.enabled=false`: Prevents SMTP relay outages from marking `platform-service` unhealthy.

### 6.2 Delivery Workflow & State Transitions
1. **Creation:** An administrator issues an invitation. A random raw token is generated; its SHA-256 hash is saved with status `PENDING`.
2. **Synchronous Submission:** `SmtpInvitationDelivery` validates the origin (must be HTTPS, or HTTP localhost for development) and formats a message with the URL fragment `/invitations/accept#token=<rawToken>`.
3. **Delivery Status:**
   - On SMTP acceptance: `delivery_status = 'SUBMITTED'`, `delivery_error = null`.
   - On exception: `delivery_status = 'FAILED'`, `delivery_error = "Email submission failed. Check SMTP configuration and retry delivery."`. Internal stack traces or credentials are never exposed.
4. **Resend / Retry:**
   - Calling `/resend` generates a new raw token, updates `token_hash`, preserves the original expiration date, and attempts delivery again.
   - The prior token is instantly invalidated.

### 6.3 Password Recovery & Public Registration Status
- **Password Recovery:** Explicitly **not supported** in Horizon.
- **Public Registration:** Open signup is disabled. Account creation is strictly authorized via organization invitations or platform administration.

---

## 7. Security and Tenant-Isolation Findings

1. **Context Protection in Frontend HTTP Client:**
   - `frontend/src/api/httpClient.ts` tracks context revisions. If a user switches organizations or workspaces while a request is in flight, late responses are discarded.
   - Requests retain their originating tenant headers rather than dynamically adopting late selector state on retries.
2. **Authority Stripping at API Gateway:**
   - The gateway automatically strips `X-Lexorion-Trusted-Organization-Id`, `X-Lexorion-Trusted-Workspace-Id`, `X-Lexorion-Trusted-User-Id`, `X-Lexorion-Trusted-Role`, and `X-Lexorion-Service-Token` from incoming client requests.
3. **URL Fragment Security for Tokens:**
   - Invitation links place bearer tokens in the URL fragment (`#token=...`), ensuring tokens are not logged in HTTP access logs, proxy headers, or server request logs.
4. **Database-Level Isolation Reality:**
   - The current live PostgreSQL deployment uses the shared superuser `postgres`.
   - The production isolation approval package (`docs/database-isolation-approval.md`) defines the required migration to dedicated per-service runtime and migrator roles, but requires maintenance-window execution.

---

## 8. Test and Browser-Verification Evidence

### 8.1 Automated Test Execution Summary
- **Platform Service:** **61 passed**, 2 skipped (optional local Postgres tests). Includes `InvitationLifecycleIntegrationTest` (5 tests), `SmtpInvitationDeliveryTest` (5 tests), `WorkspaceSecurityIntegrationTest`, `EntitlementSecurityIntegrationTest`, `PostgresMigrationTest`.
- **Workforce Service:** **46 passed**, 0 skipped. `WorkforceSecurityIntegrationTest` validates role boundaries, input normalization, and context isolation.
- **Payroll Service:** **76 passed**, 0 skipped. Includes 26 H2 integration tests, 27 real PostgreSQL tests (`PayrollPreparationPostgresTest`), 10 calculation tests, and 12 security tests.
- **Frontend Vitest Suite:** **58 passed across 17 files**. Validates `InvitationPage`, `HomePage`, `PayRunPreparation`, `PayrollPage`, `AdminWorkspaces`, and HTTP client session protections.

### 8.2 Browser Verification Summary
Browser verification using Google Chrome against the local container deployment confirmed:
1. Operator sign-in, organization provisioning, and Starter/Business plan assignment.
2. Invitation delivery to Mailpit, failure on relay shutdown, and successful delivery after restart.
3. New user registration from email link, token rotation invalidation, and session startup.
4. Department, designation, and employee creation with reporting manager assignment.
5. Payroll enrollment, component creation, and compensation profile assignment.
6. Pay-run preparation, candidate eligibility filtering, and explicit selection saving.
7. Pay-run calculation, processing, failure recovery, and recalculation reset.
8. Pay-run finalization, balanced ledger generation, and payslip rendering.
9. Cross-tenant and cross-workspace denial (HTTP 403) on tampered headers.

---

## 9. Incomplete Functionality and Operational Blockers

1. **Production Database Isolation Execution:** The running Docker database has not been cut over to dedicated runtime roles. Execution of `docs/database-isolation-approval.md` remains pending.
2. **External Email Relay:** Local delivery uses Mailpit. A production SMTP provider (SendGrid, AWS SES, Postmark) must be configured with authorized sender addresses and DNS records (SPF, DKIM).
3. **Production TLS & Hostname Routing:** The system currently runs over HTTP localhost. Production deployment requires valid TLS certificates and wildcard DNS mapping (e.g., `*.horizon.lexorion.in`).
4. **Finance Service Implementation:** `finance-service` is an unintegrated shell. No general ledger syncing or payment disbursements are supported.
5. **Absence of HR Management Modules:** Attendance tracking, leave requests, recruitment, and performance evaluations are not implemented.
6. **Absence of Self-Service Password Reset:** Password recovery is unavailable.
7. **Large Workspace Pagination in Preparation:** The pay-run candidate list in preparation is currently unpaginated.

---

## 10. Recommended Next Implementation Slice

### Pay-Run Review and Reconciliation Slice
Following pay-run preparation, calculation, and finalization, the recommended next implementation slice is an **Enhanced Pay-Run Review & Reconciliation Screen**:
1. **Employee-Level Calculation Breakdown:** Display detailed component-by-component calculation breakdowns for all employees in `CALCULATED` status prior to finalization.
2. **Variance Reporting:** Compare current draft totals against the previous finalized pay run to highlight gross pay or deduction discrepancies.
3. **Audit Trail Pre-Check:** Surface one-time assignment payouts and frequency checks before committing the final ledger entries.

*Note: Production Database Isolation Cutover should be scheduled during an approved maintenance window independently of feature slices.*

---

## 11. Explicit List of Areas That Should NOT Be Changed Without Further Evidence

1. **Database Isolation Configuration & Scripts:** Do not modify `compose.db-isolation.yml` or `scripts/db-isolation/manage.py`.
2. **Core Identity & Authentication Boundary:** Do not alter the JWT structure, refresh cookie attributes, or token family rotation logic.
3. **Payroll Period Rules:** Do not change full-calendar-month or anchored 7/14-day interval calculations without product owner sign-off; do not add ad-hoc proration.
4. **Finalized Run & Snapshot Immutability:** Finalized pay runs, ledger entries, and payslips must never be editable or recalculable.
5. **Invitation Token Fragment Routing:** Do not move the invitation token from the URL fragment (`#token=...`) to query parameters or path variables.
6. **Finance Service Speculation:** Do not add speculative business code or tables to `finance-service` without an approved architecture design.
7. **Generic HR Modules:** Do not introduce unrequested attendance, leave, or performance modules.

---

## 12. Conclusion: What a Real Customer Can Do Today vs. Launch Prerequisites

### What a Real Customer Can Do Today
In the current Lexorion Horizon deployment, an organization can:
- Be provisioned and enrolled by an operator with commercial plan limits.
- Create workspaces and invite team members via automated email.
- Onboard new employees via email invitation links.
- Maintain a structured company directory (departments, designations, employee profiles, reporting hierarchies).
- Define compensation packages with recurring and one-time components.
- Prepare monthly, weekly, or biweekly pay runs with automated eligibility checking.
- Calculate and verify payroll with protection against overlapping periods or repeat payouts.
- Recover from calculation failures or reset draft runs.
- Finalize pay runs to generate balanced accounting ledgers and employee payslips.
- Allow employees to log in and inspect their personal profiles and payslips.

### What Remains Necessary Before a Production SaaS Launch
1. **Execute Production Database Isolation:** Apply the approved role and ownership transfer procedure (`scripts/db-isolation/manage.py apply`) to eliminate shared superuser usage.
2. **Configure Production SMTP Relay:** Provide live relay credentials and configure sender domain authentication (SPF/DKIM).
3. **Configure Production Ingress & TLS:** Deploy public reverse proxies with valid SSL/TLS certificates and wildcard cookie domains (`.horizon.lexorion.in`).
4. **Formalize Password Reset Procedures:** Document an operator procedure or implement a secure self-service password reset flow.
5. **Pagination & Performance Optimization:** Benchmark and paginate pay-run preparation for workspaces with thousands of employees.
