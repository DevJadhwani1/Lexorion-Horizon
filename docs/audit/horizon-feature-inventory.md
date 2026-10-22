# Horizon Feature Inventory

Audit date 2026-10-21 · commit `5612019` plus the working tree · definitions in [README.md](README.md).

**Path legend**

| Prefix | Expands to |
|---|---|
| `P:` | `backend/platform-service/src/main/java/com/lexorion/` |
| `W:` | `backend/workforce-service/src/main/java/com/lexorion/workforce/` |
| `Y:` | `backend/payroll-service/src/main/java/com/lexorion/payroll/` |
| `F:` | `frontend/src/` |
| `PT:` `WT:` `YT:` | the matching `src/test/java/...` trees |

"RT" means runtime-verified in this audit (local stack); see [horizon-workflow-audit.md](horizon-workflow-audit.md).

**Dimension values:** Impl, Partial, Missing, Broken, Unver. **Security:** Verified, Gap, Unver, n/a. **Primary** is the single primary status used for counts.

## Core identity and sessions (AUTH)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-001 | Email/password login | Valid credentials yield an access + refresh token; invalid ones get a generic 401 | Impl | Impl | Impl | Impl | Verified | Implemented | `F:pages/LoginPage.tsx:89`, `F:auth/AuthProvider.tsx:105`, `P:core/auth/service/AuthenticationService.java:58`; `AuthenticationSessionIntegrationTest`; RT: login 200; wrong password and unknown user both return 401 "Email or password is invalid" | — | — | — |
| AUTH-002 | Refresh rotation and reuse detection | Refresh rotates the token; reusing a rotated token revokes the family | n/a | Impl | Impl | Impl | Verified | Implemented | `AuthenticationService.java:81`, `F:api/httpClient.ts` `refreshAccess`; `httpClient.test.ts`; RT: rotate 200, reuse 401, newest token after reuse 401 | — | AUTH-001 | — |
| AUTH-003 | Logout and revocation | Logout revokes the refresh token and clears the client context | Impl | Impl | Impl | Impl | Verified | Implemented | `AuthenticationService.java:106`, `AuthProvider.tsx:112`; RT: logout 204, then refresh 401 | — | AUTH-001 | — |
| AUTH-004 | Shared-domain HttpOnly refresh cookie | On `horizon.lexorion.in` hosts the refresh token lives only in an HttpOnly cookie | Impl | Impl | Unver | Unver | Unver | Unverified | `F:api/session.ts:2` `usesSharedSessionCookie`, `F:auth/authApi.ts` `restoreSession`; `authApi.test.ts` | Production hosts and TLS not available to verify | SEC-010 | P1 |
| AUTH-005 | Token storage on non-cookie hosts | Tokens are not exposed to page scripts | Partial | n/a | Impl | Impl | Gap | Partially implemented | `F:api/session.ts:10-11`: access **and refresh** tokens are kept in `sessionStorage` on localhost and custom hosts | Any XSS can read the refresh token; there is no CSP (SEC-005) | SEC-005 | P2 |
| AUTH-006 | Password hashing | Vetted adaptive hashing | n/a | Impl | n/a | Impl | Verified | Implemented | `P:core/security/CoreSecurityConfiguration.java:36-39` (DelegatingPasswordEncoder, default bcrypt); `LegacyPbkdf2PasswordEncoder` kept for verifying older hashes | Earlier Stage-1 hand-rolled PBKDF2 debt is resolved for new hashes | — | — |
| AUTH-007 | Brute-force protection | Login is throttled or locked after repeated failures | Missing | Missing | Missing | Missing | Gap | Not implemented | No rate-limit or lockout code in platform-service or the gateway (search for ratelimit/lockout/failedAttempt returned nothing); only a metrics counter `lexorion.authentication.failures` | Credential stuffing is not mitigated | — | P1 |
| AUTH-008 | Password reset | Self-service forgot/reset password by email | Missing | Missing | Missing | Missing | n/a | Not implemented | `F:pages/LoginPage.tsx:174` disabled button "Password recovery is not supported"; no backend endpoint | Recovery needs operator intervention | INV-006 | P1 |
| AUTH-009 | Public self-registration | Synopsis lists "User Registration" | Partial | Missing | Missing | Missing | n/a | Not implemented | `F:pages/RegisterPage.tsx` (disabled by design); registration exists only through invitations (INV-003) | Scope decision; invitation-only may be intended | INV-003 | P3 |
| AUTH-010 | "Sign out all sessions" for the user | A user can revoke all of their sessions | Missing | Impl | Missing | Partial | n/a | Partially implemented | `POST /api/core/auth/sessions/revoke-all` exists; no frontend reference | No UI | — | P3 |
| AUTH-011 | Login audit trail | Each login outcome is recorded | n/a | Impl | n/a | Impl | Verified | Implemented | `P:core/audit/AuditRecorder.java`; RT: `audit_events` rows `AUTH_LOGIN SUCCESS` | — | — | — |
| AUTH-012 | AXON login-event export (uncommitted) | Login outcomes are sent to an external security monitor when enabled; failures never block login | n/a | Impl | Partial | Partial | Gap | Partially implemented | `P:core/integration/AxonEventPublisher.java`, `AuthenticationService.java` (diff); `AxonEventPublisherTest` (5); RT: `AXON_ENABLED=true`, target `host.docker.internal:8100` unreachable, logs "AXON event not delivered … ResourceAccessException" for every login | Events silently dropped in the running env; payload carries the login email (PII) to an external system; uncommitted | — | P2 |
| AUTH-013 | Initial platform-admin bootstrap | First operator account created from env when enabled | n/a | Impl | n/a | Impl | Verified | Implemented | `InitialPlatformAdminBootstrapTest` (3); `docker-compose.yml` `LEXORION_BOOTSTRAP_*` | — | — | — |

## Organization and workspace context (CTX)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTX-001 | Organization selection and request fencing | Org/workspace headers are captured per request; stale responses are discarded on switch | Impl | Impl | Impl | Impl | Verified | Implemented | `F:api/httpClient.ts` `assertContext`, `F:workspace/WorkspaceProvider.tsx`; `httpClient.test.ts`, `WorkspaceProvider.test.tsx`; RT: switching org/workspace in browser | — | — | — |
| CTX-002 | Last-used org/workspace restoration (uncommitted) | After login the last accessible org and that org's workspace reopen; invalid values fall back | Impl | Impl | Impl | Impl | Verified | Implemented | `P:…/V10__last_used_context.sql`, `P:horizon/currentuser/service/CurrentUserService.java`, `PUT /api/platform/me/context`, `F:auth/AuthProvider.tsx:127-137`; `LastUsedContextIntegrationTest` (4), `AuthProvider.test.tsx`; RT: switch → fresh login restores; stale workspace recovers | Uncommitted; concurrent clients use last-write-wins (observed) | — | P3 |
| CTX-003 | Post-login landing for users with platform access | A user with org memberships can work in their org right after login | Partial | n/a | Impl | Partial | n/a | Partially implemented | `F:context/ApplicationContext.tsx:32`: on localhost, platform access defaults to `platform` mode; RT: the dev account lands in the Platform console, with the org restored in the background | Extra step to reach the organization app | CTX-002 | P2 |
| CTX-004 | Auto-select the only accessible workspace | With exactly one accessible workspace, it is selected | Missing | n/a | n/a | Missing | n/a | Not implemented | `F:workspace/WorkspaceProvider.tsx` has no single-workspace selection; RT: new employee with 1 accessible workspace sees "Choose an active workspace…" and only "Overview" in the sidebar | Every new user must pick a workspace manually | — | P2 |

## Organizations, memberships and plans (ORG)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ORG-001 | Platform org create/list/detail | Operators provision organizations | Impl | Impl | Impl | Impl | Verified | Implemented | `P:platform/organization/controller/OrganizationController.java:33-62` (all `PLATFORM_ACCESS` or `canReadOrganization`); `F:pages/platform/PlatformOrganizationsPage.tsx`; `PlatformOrganizationsPage.test.tsx`; RT: platform console renders lists | — | — | — |
| ORG-002 | Organization status lifecycle | Activate/suspend organizations; suspended orgs lose access | Impl | Impl | Impl | Impl | Verified | Implemented | `PATCH /api/platform/organizations/{id}/status`; `CoreFoundationIntegrationTest`, `LastUsedContextIntegrationTest` (suspended org hidden) | Runtime write not exercised (non-destructive audit) | — | — |
| ORG-003 | Platform plan assignment | Operators assign Starter/Business | Impl | Impl | Impl | Impl | Verified | Implemented | `P:horizon/entitlement/service/PlanAssignmentService.java:53-76`; `EntitlementSecurityIntegrationTest` (18) | — | — | — |
| ORG-004 | Tenant self plan assignment | Plans are platform-owned (`docs/development-plans.md`) | Missing | Impl | Missing | Impl | Gap | Implemented | `PUT /api/tenant/plan-assignment` allows org ADMIN (`TenantEntitlementController.java:16`, `PlanAssignmentService.java:35-82`); `EntitlementSecurityIntegrationTest.java:124,127` asserts the owner gets 200 | An org admin can switch its own plan (Starter↔Business) with no billing or approval through the API; no UI uses it | — | P1 (decision) |
| ORG-005 | Tenant organization profile | Org admin views/edits profile | Impl | Impl | Impl | Impl | Verified | Implemented | `GET/PATCH /api/tenant/organization` (ADMIN); `F:pages/admin/AdminPage.tsx`; RT: renders; employee gets 403 | No frontend tests for AdminPage | — | — |
| ORG-006 | Tenant organization settings | Org admin edits regional/branding defaults | Impl | Impl | Impl | Impl | Verified | Implemented | `PATCH /api/tenant/organization/settings`; `AdminPage.tsx:212-229`; RT: renders | No frontend tests | — | — |
| ORG-007 | Tenant member management | List members, change role, remove | Impl | Impl | Impl | Impl | Verified | Implemented | `/api/tenant/organization/members*` (ADMIN); `AdminPage.tsx:73`; RT: list renders, employee gets 403 | Role `<select>` per row has no accessible label | — | P3 |
| ORG-008 | Platform membership/user APIs | Operators manage users and memberships | Partial | Impl | Partial | Partial | Verified | Partially implemented | `MembershipController.java:29-56`, `UserController.java`; frontend never calls `PATCH /api/platform/memberships/*`, `GET/POST /api/platform/organizations/{id}/members`, `PATCH /api/platform/users/{id}` (Core console uses `/api/core/*` equivalents) | Duplicate API surfaces (`/api/platform/*` and `/api/core/*`) | — | P3 |
| ORG-009 | Branch management | Synopsis: Organization → Branch Management | Missing | Missing | Missing | Missing | n/a | Not implemented | No entity, migration or route | Scope decision | — | P3 |
| ORG-010 | Team management | Synopsis: Team Management | Missing | Missing | Missing | Missing | n/a | Not implemented | Only the reporting-manager hierarchy exists (WF-006) | Scope decision | WF-006 | P3 |
| ORG-011 | Role/permission management | Synopsis: Role and Permission Management | Missing | Partial | Missing | Missing | n/a | Not implemented | Fixed roles `ADMIN/MANAGER/EMPLOYEE` (`OrganizationRole`), platform roles; no configurable permissions | Scope decision | — | P3 |

## Workspaces and entitlements (WS)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WS-001 | Workspace administration | Create, activate/deactivate, attach products, delete | Impl | Impl | Impl | Impl | Verified | Implemented | `WorkspaceAdministrationController` (ADMIN); `F:pages/admin/AdminWorkspaces.tsx`; `WorkspaceSecurityIntegrationTest` (13), `AdminWorkspaces.test.tsx`; RT: renders | — | ORG-003 | — |
| WS-002 | Plan quota enforcement | Employee/workspace limits come from the plan | n/a | Impl | Impl | Impl | Verified | Implemented | `EntitlementSecurityIntegrationTest:153-166` (quota rejection and reconfiguration) | — | ORG-003 | — |
| WS-003 | Accessible workspace validation | Only workspaces the user can enter are listed and selectable | Impl | Impl | Impl | Impl | Verified | Implemented | `P:horizon/workspace/service/WorkspaceAccessService.java:37-55`; `WorkspaceProvider.test.tsx`; RT: stale key rejected; other org gets 403 | — | — | — |
| WS-004 | Effective entitlements view | Org admin sees plan capabilities | Impl | Impl | Impl | Impl | Verified | Implemented | `GET /api/tenant/entitlements` (ADMIN); RT: renders, employee gets 403 | — | ORG-003 | — |

## Invitations (INV)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| INV-001 | Create and deliver invitation | Admin invites by email and role; SMTP sends a fragment-token link | Impl | Impl | Impl | Impl | Verified | Implemented | `OrganizationInvitationController`, `P:horizon/invitation/delivery/SmtpInvitationDelivery.java:33`; `InvitationLifecycleIntegrationTest` (5), `SmtpInvitationDeliveryTest` (5); RT: invite 201, message in Mailpit | Invitation email `<input>` and role `<select>` lack labels | — | P3 |
| INV-002 | Delivery failure and retry | Failure is recorded with a safe reason; resend rotates the token and delivers | Impl | Impl | Impl | Impl | Verified | Implemented | RT: SMTP unset → `FAILED` "Email submission failed. Check SMTP configuration and retry delivery."; resend → 200 `SUBMITTED` | Delivery is synchronous, not a durable queue (`docs/horizon-flow-audit.md`) | INF-007 | — |
| INV-003 | Register a new account through an invitation | Recipient creates an account and joins atomically | Impl | Impl | Impl | Impl | Verified | Implemented | `POST /api/invitations/register`; `InvitationPage.test.tsx`; RT: register 200 → `EMPLOYEE` in `flow-26096132`, login OK | — | INV-001 | — |
| INV-004 | Existing account accepts | Signed-in recipient accepts | Impl | Impl | Impl | Impl | Verified | Implemented | `POST /api/invitations/accept`; `InvitationLifecycleIntegrationTest` | Not re-run at runtime in this audit | INV-001 | — |
| INV-005 | Revoke invitation | Admin revokes a pending invitation | Impl | Impl | Impl | Impl | Verified | Implemented | `DELETE /api/tenant/invitations/{id}`; `InvitationLifecycleIntegrationTest` | Not re-run at runtime | — | — |
| INV-006 | Production email relay | Real delivery with SPF/DKIM and a public HTTPS origin | n/a | Partial | Missing | Missing | n/a | Not implemented | Only Mailpit is configured (`compose.mailpit.yml`); SMTP env blank in the base compose | Release prerequisite; also blocks AUTH-008 and NOT-001 | SEC-010 | P1 |

## Workforce (WF)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WF-001 | Departments | CRUD per workspace | Impl | Impl | Impl | Impl | Verified | Implemented | `W:api/DepartmentController` (ADMIN); `WorkforceSecurityIntegrationTest` (46); RT: renders, employee gets 403 | — | WS-001 | — |
| WF-002 | Designations | CRUD per workspace | Impl | Impl | Impl | Impl | Verified | Implemented | `W:api/DesignationController`; same tests; RT renders | — | WS-001 | — |
| WF-003 | Employee records | Create/update/list with paging/filters | Impl | Impl | Impl | Impl | Verified | Implemented | `W:api/EmployeeController`, `F:features/workforce/workforceApi.ts:3`; RT: list shows `FLOW-001`; employee list 403, single record 404 | `WorkforcePage.tsx` (460 lines) has 1 frontend test | WS-001 | P3 |
| WF-004 | Employee lifecycle transitions | Leave/suspend/resign/terminate/activate under state rules | Impl | Impl | Impl | Impl | Verified | Implemented | `WorkforcePage.tsx:240-243`, `transitionEmployee`; `WorkforceSecurityIntegrationTest` | Not exercised at runtime | WF-003 | — |
| WF-005 | Employee history | Lifecycle events visible | Impl | Impl | Impl | Impl | Verified | Implemented | `GET /employees/{code}/history`; tests | — | WF-004 | — |
| WF-006 | Organization structure | Reporting hierarchy view | Impl | Impl | Impl | Impl | Verified | Implemented | `GET /api/workforce/organization-structure`; RT 200 (departments, employees) | — | WF-003 | — |
| WF-007 | Employee ↔ user mapping | Admin links an employee to a login account by email | Impl | Impl | Impl | Impl | Verified | Implemented | `PUT /employees/{code}/user-mapping`, `WorkforcePage.tsx:306`, `/internal/workforce/…/user-resolution` | Manual step | WF-003 | — |
| WF-008 | Employee self-service profile | A signed-in employee sees their own profile | Partial | Impl | Partial | Partial | Verified | Partially implemented | `W:api/SelfServiceController`, `W:service/SelfServiceService.java:6`; RT: unmapped admin/employee gets **403 "Authenticated user has no Workforce employee mapping"** shown verbatim as the page error | Works only after manual WF-007; unmapped users get a raw error; "My profile" and "My team" appear for users without a record | WF-007, WF-010 | P2 |
| WF-009 | Manager team view | Managers see direct reports | Impl | Impl | Impl | Impl | Verified | Implemented | `GET /api/workforce/me/team`; `WorkforceSecurityIntegrationTest` (6 references) | Manager runtime session not available | WF-007 | — |
| WF-010 | Invitation → employee onboarding link | An invited employee lands with a usable profile (Synopsis: "Employee Onboarding") | Missing | Missing | Missing | Missing | n/a | Not implemented | Accepting an invitation creates only a membership (`InvitationRegistrationService`); no employee creation or mapping; RT: new employee has no profile | Admin must create and map separately | WF-007 | P2 |
| WF-011 | Attendance | Synopsis requirement | Missing | Missing | Missing | Missing | n/a | Not implemented | No code; `docs/horizon-current-functionality.md` §11 forbids unrequested modules | Scope decision | — | P2 (decision) |
| WF-012 | Leave | Synopsis requirement | Missing | Missing | Missing | Missing | n/a | Not implemented | Only the `ON_LEAVE` employment status exists, not leave requests | Scope decision | — | P2 (decision) |
| WF-013 | Performance | Synopsis requirement | Missing | Missing | Missing | Missing | n/a | Not implemented | — | Scope decision | — | P3 |
| WF-014 | Asset management | Synopsis requirement | Missing | Missing | Missing | Missing | n/a | Not implemented | — | Scope decision | — | P3 |

## Payroll (PAY)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PAY-001 | Payroll employee enrollment | Enroll Workforce employees, verified against Workforce | Impl | Impl | Impl | Impl | Verified | Implemented | `Y:api/PayrollEmployeeController`, `HttpWorkforceEmployeeClientTest`; `PayrollFoundationIntegrationTest` | — | WF-003 | — |
| PAY-002 | Salary components | Define/deactivate components | Impl | Impl | Impl | Impl | Verified | Implemented | `ComponentDefinitionController`; tests | — | — | — |
| PAY-003 | Salary templates and versions | Versioned templates; assign to employee | Impl | Impl | Impl | Impl | Verified | Implemented | `SalaryTemplateController`, `SalaryTemplateVersionController`; `PayrollCalculationIntegrationTest` | — | PAY-002 | — |
| PAY-004 | Compensation profiles | Per-employee profiles with component snapshots | Impl | Impl | Impl | Impl | Verified | Implemented | `CompensationController`; `F:pages/payroll/PayrollPage.tsx:879-884` | Screen starts with a free-text "Employee code" box (no picker, unlabeled input) | PAY-001 | P2 |
| PAY-005 | Calculation preview | Standalone calculation for a period | Impl | Impl | Impl | Impl | Verified | Implemented | `CalculationController`; `PayrollCalculationIntegrationTest` (10) | Same employee-code entry UX | PAY-004 | P2 |
| PAY-006 | Pay-run creation and preparation | Create a run; inspect eligibility; save selection | Impl | Impl | Impl | Impl | Verified | Implemented | `PayRunController` preparation; `PayrollPreparationPostgresTest` (27), `PayRunPreparation.test.tsx` (5); RT read-only: run list 200 | — | PAY-004 | — |
| PAY-007 | Process, recover, reset | Calculate; recover failures; reset calculated runs | Impl | Impl | Impl | Impl | Verified | Implemented | `Y:service/PayRunProcessingService.java:19,34`; `PayrollPayRunIntegrationTest` (26) | Runtime write not exercised | PAY-006 | — |
| PAY-008 | Finalization and immutability | Finalize once; snapshots frozen | Impl | Impl | Impl | Impl | Verified | Implemented | `Y:service/PayRunService.java:26`; tests; RT: `FLOW-RUN-1` `FINALIZED`, totals gross 1000 / deduction 0 / net 1000 consistent across run, run-employee and payslip | — | PAY-007 | — |
| PAY-009 | Payroll ledger | Docs claim a "balanced double-entry general ledger" | Partial | Partial | Impl | Partial | Verified | Partially implemented | `Y:domain/PayrollLedgerEntry.java` has `type` ∈ {EARNING, DEDUCTION, EMPLOYER_CONTRIBUTION, ADJUSTMENT, NET_PAY} and signed `amount`, with no accounts and no debit/credit; only `GET /api/payroll/employees/{code}/ledger` exists; RT: 2 entries (EARNING, NET_PAY) | It's a per-employee payroll register, not a double-entry GL; no workspace-wide ledger view; the documented `GET /api/payroll/ledger` does not exist | PAY-008, FIN-001 | P2 |
| PAY-010 | Admin payslips | Admin views finalized payslips | Impl | Impl | Impl | Impl | Verified | Implemented | `PayrollHistoryController`; RT: payslip 200 for `FLOW-001/FLOW-RUN-1` | Requires typing the employee code; no per-run payslip list | PAY-008 | P2 |
| PAY-011 | Employee self-service payslips | Employees view their own payslips (claimed implemented in `horizon-current-functionality.md` §2.7 and Phase 8) | Missing | Missing | Missing | Missing | Verified | Not implemented | All payroll controllers are `@PreAuthorize("hasRole('ADMIN')")`; `F:app/Router.tsx:34` blocks Payroll for non-admins; RT: employee gets "Your organization role does not provide Payroll access." and 403 on `/api/payroll/employees/FLOW-001/payslips` | Core employee-facing outcome missing; documentation is wrong | WF-007 | P1 |
| PAY-012 | Readiness projection | Configuration coverage summary | Impl | Impl | Impl | Impl | Verified | Implemented | `PayrollReadinessController`; `HomePage.test.tsx`; RT: overview counts | — | — | — |
| PAY-013 | Tax and statutory deductions | Withholding and localized deductions | Missing | Missing | Missing | Missing | n/a | Not implemented | Documented limitation (`horizon-current-functionality.md` §2.6) | Needs a payroll-scope decision | — | P2 |
| PAY-014 | Payslip and payment exports | PDF payslip, bank/payment file | Missing | Missing | Missing | Missing | n/a | Not implemented | No pdf/csv/export code in frontend or backend | — | PAY-010 | P2 |
| PAY-015 | Preparation pagination | Large workspaces stay usable | Partial | Partial | Impl | Partial | n/a | Partially implemented | Candidate list unpaginated (`horizon-current-functionality.md` §9.7) | — | PAY-006 | P3 |
| PAY-016 | Pay-run review and variance | Per-employee breakdown and comparison with the previous run before finalizing | Missing | Missing | Missing | Missing | n/a | Not implemented | Recommended next slice in `horizon-current-functionality.md` §10 | — | PAY-007 | P2 |

## Other Synopsis domains (FIN, REC, CLI, NOT, REP)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| FIN-001 | Finance service | Synopsis: client billing, invoices, payments, expenses, financial reports | Missing | Missing | Missing | Missing | n/a | Not implemented | `backend/finance-service` has 2 main classes and an empty `V1__baseline.sql`; gateway route `/api/finance/**` exists | Shell only; `horizon-current-functionality.md` §11 says do not add speculative code | — | P2 (decision) |
| REC-001 | Recruitment | Synopsis: requirements, candidates, applications, interviews, offers, placement | Missing | Missing | Missing | Missing | n/a | Not implemented | No service or route; ERD `Recruitment_Service_ERD.png` exists | Central to the Synopsis target market (staffing agencies) | — | P2 (decision) |
| CLI-001 | Client management | Synopsis: clients, contacts, contracts, requirements | Missing | Missing | Missing | Missing | n/a | Not implemented | No service; ERD `Client_Service_ERD.png` | Scope decision | — | P3 |
| NOT-001 | Email notifications beyond invitations | Workflow emails (pay run finalized, account events) | Missing | Partial | Missing | Missing | n/a | Not implemented | The only mail sender is `SmtpInvitationDelivery` | — | INV-006 | P2 |
| NOT-002 | SMS, system and workflow alerts | Synopsis requirement | Missing | Missing | Missing | Missing | n/a | Not implemented | No notification service (ERD only) | Scope decision | — | P3 |
| REP-001 | Operational dashboards | Overview, Workforce and Payroll dashboards from live data | Impl | Impl | Impl | Impl | Verified | Implemented | `F:pages/HomePage.tsx`, Workforce/Payroll dashboards; `HomePage.test.tsx` (6); RT: overview shows plan, counts, recent run | — | — | — |
| REP-002 | Reports and exports | Synopsis: employee, attendance, payroll, financial, operational reports | Missing | Missing | Missing | Missing | n/a | Not implemented | No report endpoints or exports | — | — | P2 |

## Frontend platform (UI)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| UI-001 | Application shell (uncommitted redesign) | Sidebar, context selector, app switcher, account menu | Impl | n/a | Impl | Impl | n/a | Implemented | `F:layout/AppShell.tsx`, `Sidebar.tsx`, `ContextSelector.tsx`, `AppSwitcher.tsx`, `AccountMenu.tsx`; `AppShell.test.tsx` (2); RT: 23 client routes render with no page errors | Uncommitted; `ContextSelector`, `AppSwitcher` and `AccountMenu` have no tests; untracked `styles.css.bak` | — | P3 |
| UI-002 | Responsive layout | Usable at phone width | Partial | n/a | n/a | Partial | n/a | Partially implemented | RT at 390px: no page-level horizontal overflow; header workspace selector clipped; admin tab strip and tables need horizontal scroll | — | — | P3 |
| UI-003 | Accessible form labels | Every control has an accessible name | Partial | n/a | n/a | Partial | n/a | Partially implemented | RT: unlabeled controls on Members (3 role selects), Invitations (email, role), Compensation (employee code) | — | — | P3 |
| UI-004 | Platform console | Operator views of orgs, users, access, products, plans, entitlements, workspaces, settings | Impl | Impl | Impl | Impl | Verified | Implemented | `F:pages/platform/*`; RT: all 8 local routes render (`/app/platform/access` locally, `/platform-access` on the platform host via `F:app/hostRouting.ts:18`) | Products, plans and entitlements are read-only | — | — |
| UI-005 | Core console (`/core`, `core.lexorion.in`) | Core operator administration | Impl | Impl | Impl | Unver | Unver | Unverified | `F:core/CoreConsole.tsx`, `F:core/routing.ts:2`; `CoreConsole.test.tsx` (9), `CoreStandaloneIntegrationTest` | Not exercised at runtime in this audit | — | P3 |
| UI-006 | Placeholder authentication controls | No inert controls | Partial | n/a | n/a | n/a | n/a | Partially implemented | `LoginPage.tsx:41,46,174`: disabled Google, email-link and "Forgot password" buttons | Visible but non-functional | AUTH-008 | P3 |

## Security and isolation (SEC)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | Cross-tenant isolation | Org/workspace headers are verified against membership server-side | n/a | Impl | Impl | Impl | Verified | Implemented | `P:horizon/tenantaccess/filter/TenantAccessContextFilter.java`, `W:tenant/TrustedTenantFilter.java`, `Y:tenant/TrustedPayrollFilter.java`; security integration tests in all three services; RT: employee with `org=test-org` gets 403 "Organization selection is not accessible", Workforce gets 403 | — | — | — |
| SEC-002 | Role enforcement | Non-admins denied admin APIs | n/a | Impl | Impl | Impl | Verified | Implemented | RT: employee gets 403 on tenant org/members/invitations/entitlements, workforce departments/list, all payroll, platform orgs/users, core users | — | — | — |
| SEC-003 | Internal service authentication | `/internal/**` requires a per-service token, compared in constant time; not publicly routed | n/a | Impl | Impl | Impl | Verified | Implemented | `P:platform/security/InternalServiceIdentityFilter.java:30-45` (`MessageDigest.isEqual`, ≥32 chars); RT: gateway `/internal/...` returns 404; service ports not published | — | — | — |
| SEC-004 | Trusted-header stripping | Clients cannot inject trusted identity headers | n/a | Impl | Impl | Impl | Verified | Implemented | `backend/api-gateway/src/main/resources/application.properties` default filters remove `X-Lexorion-Trusted-*` and `X-Lexorion-Service-Token` | — | — | — |
| SEC-005 | Browser security headers | CSP, frame protection, nosniff, referrer policy on the SPA | Missing | n/a | n/a | Missing | Gap | Not implemented | `frontend/nginx.conf` sets only Cache-Control; RT response headers: `Server: nginx/1.29.8` only | Clickjacking/XSS hardening absent; magnifies AUTH-005 | — | P2 |
| SEC-006 | CORS | Foreign origins are not granted access | n/a | Impl | n/a | Impl | Verified | Implemented | RT: preflight from `https://evil.example` returns no `Access-Control-Allow-*` headers | — | — | — |
| SEC-007 | Actuator exposure | Only health/info public | n/a | Impl | n/a | Impl | Verified | Implemented | Platform permits only `/actuator/health`, `/actuator/info` (`SecurityConfig.java:70`); gateway `show-details=when-authorized`; RT: gateway health shows status only | Metrics exposed to authenticated callers (services not published) | — | — |
| SEC-008 | Per-service database roles | Each service uses a restricted role | n/a | Partial | Missing | Missing | Gap | Not implemented | RT: `pg_roles` contains only `postgres` (superuser); the platform session runs as `postgres`; prepared plan in `docs/database-isolation-approval.md`, `scripts/db-isolation/manage.py` not applied | Any service compromise reaches every database | — | P0 |
| SEC-009 | Secret hygiene in the repository | No real credentials in tracked or near-tracked files | n/a | n/a | n/a | Partial | Gap | Partially implemented | Untracked `scratch/test-shell-experience.cjs` and `scratch/browser-test/test.js` contain plaintext passwords for real/dev accounts | Risk of committing credentials; rotate if pushed | — | P2 |
| SEC-010 | Production TLS and ingress | HTTPS, wildcard DNS, cookie domain | n/a | n/a | Missing | Missing | Gap | Not implemented | Only `infrastructure/nginx/core.lexorion.in.conf.example`; local stack is HTTP | Release blocker | — | P0 |

## Infrastructure and delivery (INF)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| INF-001 | Local Docker Compose stack | Reproducible local environment with health checks | n/a | Impl | Impl | Impl | n/a | Implemented | `docker-compose.yml`; RT: 9 containers healthy | — | — | — |
| INF-002 | Discovery and gateway routing | Eureka plus gateway routes for every API family | n/a | Impl | Impl | Impl | Verified | Implemented | Gateway `routes[0..6]`; `ApiGatewayApplicationTests` (4); RT: all API families reachable | — | — | — |
| INF-003 | Correlation IDs | `X-Correlation-ID` propagated | n/a | Impl | Impl | Impl | n/a | Implemented | `CorrelationIdFilterTest` (2); services' `CorrelationIdFilter` | — | — | — |
| INF-004 | Jenkins CI | Compile, test, lint, audit, typecheck, build, image build | n/a | Impl | n/a | Unver | n/a | Unverified | `Jenkinsfile`, `docs/ci-cd.md`; every stage's command was run locally (all pass) except `docker compose build` of all images | The pipeline itself was not executed | — | P2 |
| INF-005 | Database migrations | Flyway per service, tested on real PostgreSQL | n/a | Impl | n/a | Impl | n/a | Implemented | `PostgresMigrationTest` (Testcontainers) in platform, workforce, payroll and finance all pass; V10 applied to the running DB | `LocalPostgresMigrationTest` env-gated (skipped) | — | — |
| INF-006 | Production deployment and monitoring | Deployment manifests, registry, monitoring | n/a | Missing | Missing | Missing | n/a | Not implemented | `infrastructure/{docker,jenkins,kubernetes,monitoring}` are empty; CI never deploys | Release prerequisite | SEC-010 | P1 |
| INF-007 | Local SMTP configuration robustness | Recreating containers keeps the intended configuration | n/a | Partial | Partial | Partial | n/a | Partially implemented | Mailpit SMTP lives only in the `compose.mailpit.yml` override; recreating with the base file silently leaves `SMTP_HOST` empty (observed during this audit) | Easy to lose email locally with no warning | — | P3 |
| INF-008 | Redis/Kafka (Synopsis stack) | Cache and broker | n/a | Missing | n/a | n/a | n/a | Not implemented | No dependency in any `pom.xml`; services call each other synchronously over REST | Scope decision | — | P3 |
| INF-009 | API documentation | OpenAPI for services | n/a | Partial | Partial | Partial | n/a | Partially implemented | `springdoc` only in workforce and payroll `pom.xml`; RT: `/api/workforce/v3/api-docs` via gateway returns 403 | No platform API docs; not reachable via the gateway | — | P3 |

## Documentation (DOC)

| ID | Feature | Expected behavior | FE | BE | Integ | Workflow | Security | Primary | Evidence | Defects / gaps | Deps | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DOC-001 | Accuracy of `docs/horizon-current-functionality.md` | Docs match the code | n/a | n/a | n/a | Broken | n/a | Broken | Contradicted claims: employee payslip self-service (§2.7, §3 Phase 8 → PAY-011); "double-entry ledger" and `GET /api/payroll/ledger` (§2.7, §4 → PAY-009); endpoint paths `/api/payroll/compensation-profiles`, `/api/workforce/structure`, `PATCH /api/tenant/workspaces/:id/products` (§4) do not exist under those names | Readers plan on capabilities that don't exist | — | P2 |

## Totals

Computed from the table rows above (a script tallies the "Primary" and "Priority" columns; see [README.md](README.md#how-to-refresh-this-audit)).

**101 features.** By domain: AUTH 13, CTX 4, ORG 11, WS 4, INV 6, WF 14, PAY 16, FIN 1, REC 1, CLI 1, NOT 2, REP 2, UI 6, SEC 10, INF 9, DOC 1.

| Primary status | Count |
|---|---:|
| Implemented | 55 |
| Partially implemented | 14 |
| Not implemented | 28 |
| Broken | 1 |
| Unverified | 3 |
| Not applicable | 0 |

| Priority | Count |
|---|---:|
| P0 | 2 |
| P1 | 7 |
| P2 | 23 |
| P3 | 23 |
| — (no action) | 46 |

**Notes on the counts:**

- Some **Implemented** rows still carry a priority for a secondary gap: UX (PAY-004/005/010), accessibility (ORG-007, INV-001), a policy decision (ORG-004), or uncommitted state (CTX-002, UI-001).
- **Thirteen Not implemented rows are Synopsis-scope items that need a product decision** rather than a defect fix: AUTH-009, ORG-009/010/011, WF-011/012/013/014, FIN-001, REC-001, CLI-001, NOT-002 and INF-008.
