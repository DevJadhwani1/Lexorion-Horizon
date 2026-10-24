# Horizon business flow audit

Audit date: 2026-10-04. Scope: current working tree, including existing uncommitted changes. This supersedes the earlier generic HRM completion estimates. Attendance, leave, recruitment and performance are not requirements for this pass. Core ownership remains as defined in `lexorion-core-v1-boundary-lock.md`.

## Pay-run preparation slice — 2026-10-04

**Current state:** Implemented and verified end-to-end in the local application. The verified journey now includes selecting a period, inspecting period-specific payroll eligibility, resolving missing compensation, saving explicit Draft membership, processing, finalizing and reviewing ledger/payslip. No new payroll models, migrations or lifecycle states were introduced. This section supersedes the prior journey's manual employee-code inclusion step.

**Problem / root cause:** Drafts previously accepted individual employee codes without showing period-specific eligibility or preparation readiness; most business errors surfaced only after processing began. Calculation validation was coupled to snapshot persistence, so it could not safely power preparation. Two related PostgreSQL defects were found during regression work: a processor's repeatable-read snapshot could predate its wait for the workspace lock and miss another run's commit; the compensation overlap query left a nullable date parameter untyped for PostgreSQL.

**Changes / existing logic reused:** Extracted an unsaved evaluator from the existing calculation service and shared pay-run eligibility between preparation and processing. Added scoped GET/PUT preparation endpoints and atomic Draft selection replacement. The UI displays actual employee/eligible/blocked/selected counts, reasons, compensation/setup links, save status and readiness. Existing `PayrollPeriod`, payroll employee/profile/assignment models, one-time provenance, overlap queries, precision rules, processing entitlement, trusted workspace context, recovery and finalization remain authoritative. Processing now reads current commits after acquiring the existing workspace lock; the nullable-date query uses an explicit date cast. Tenant/database isolation architecture and production ownership/grants/migrations were not changed.

**Files changed:** The exact 17-file manifest is in [pay-run preparation](pay-run-preparation.md#files-changed-in-this-slice). Changes are confined to Payroll backend/frontend, their tests and these documentation files. Unrelated pre-existing working-tree changes are excluded.

**Tests / backend verification:** 76 targeted Payroll tests passed, zero failures/errors/skips: 26 H2 pay-run/preparation, 27 migrated PostgreSQL pay-run/preparation (including deterministic concurrent overlap), 10 calculation, 12 security and 1 PostgreSQL migration test. Eight preparation integration cases and the concurrency regression were added. Frontend: 58 tests across 17 files passed, including five preparation component tests and three tests through the real HTTP client. Frontend production build/lint, Payroll package and both container image builds passed. The first browser pass exposed double JSON encoding in the new selection API wrapper; it was corrected and covered by the HTTP-client test before final verification.

Commands used:

- Payroll: `DOCKER_HOST=unix:///Users/dev/.docker/run/docker.sock ./mvnw -B -Dtest=PayrollPayRunIntegrationTest,PayrollPreparationPostgresTest,PayrollCalculationIntegrationTest,PayrollSecurityIntegrationTest,PostgresMigrationTest package` from `backend/payroll-service`.
- Frontend: `npm --prefix frontend run test`, `npm --prefix frontend run build`, `npm --prefix frontend run lint`; the final Docker frontend build also ran TypeScript/Vite after the API correction.

**Browser verification:** Chrome on `http://localhost`, isolated QA organization `prep-34309142`, workspace `main`, run `FLOW-RUN-1`. Login → organization/workspace → Payroll → invalid period rejected → valid October 2026 Draft → 3 payroll employees / 1 eligible / 2 blocked → resolve missing compensation through its return link → 2 eligible / 1 blocked → select two employees → Save selection → Ready to calculate. Preparation wrote no calculation snapshots. A direct API status change after preparation made processing fail safely; restoring eligibility and Recover to draft enabled successful processing. The run calculated USD 1,250 (USD 1,000 + USD 250), finalized and produced both payslips and balanced signed ledger entries. Browser navigation, reload and workspace handoff remained functional.

Direct backend checks rejected invalid-period selection and processing (409), duplicate normalized selection (409), missing-compensation selection (409), foreign workspace (403), changed eligibility after preparation (409), committed overlapping selection/processing (409), repeat finalization (409), and preparation changes to a finalized run (409). Wrong organization/workspace access checks also returned 403. Final browser console output contained only expected missing-enrollment 404s and deliberately exercised 403/409 responses; no render errors. Local evidence: `/private/tmp/preparation-browser.log`, `/private/tmp/horizon-preparation-ready.png`, `/private/tmp/preparation-payroll-full.log`, `/private/tmp/preparation-frontend-tests.log`.

The local stack was initially stopped. Existing dependencies were started and only Payroll/frontend images were updated; an initial login attempt encountered Eureka registration delay, then succeeded after convergence. No authentication workaround or authorization relaxation was applied.

**Remaining limitations:** Preparation is a current eligibility report, not a reservation; processing always revalidates. Other Drafts do not reserve a period. Only enrolled Payroll employees are counted; unenrolled Workforce employees use the existing configuration link. The report exposes the first blocking reason per employee and uses an unpaginated candidate list, suitable for the current MVP. No new proration, banking, attendance, tax or employment-history rules were invented. Earlier production isolation approval and operator configuration limitations remain unchanged.

**Recommended next slice (not started):** Pay-run review before finalization, showing employee-level calculation explanations and reconciliation of totals.

## Focused customer journey slice — 2026-10-04

Implemented the first customer-facing slice over the existing services: operational Horizon overview, actual compensation configuration coverage, guided optional/required setup, next payroll action, recent finalized result, and employee/run links with safe return navigation. The current organization, workspace and user remain visible. Existing sidebar structure, Core identity, workspace/entitlement authority and payroll state machine are reused.

A small protected read-only Payroll readiness projection derives counts from existing employee/profile records. It does not assert period eligibility; existing calculation remains authoritative. No database migrations, isolation architecture or ownership/grants changed.

Fixed directly related context defects: authentication retry could replace original tenant headers with a newly selected workspace; late refresh could restore a signed-out session; editing an employee selector could retain another employee's loaded calculation context. Added regressions for all three, plus late overview responses and safe workflow returns.

Verification for this slice:

- Frontend **50 tests passed**; TypeScript/Vite, lint and Docker build passed.
- Payroll **41 targeted tests passed**, including new readiness/tenant/role/entitlement/revocation cases and real PostgreSQL migration; package and Docker build passed.
- Existing Platform entitlement suite **18 passed**; Workforce security/behavior suite **46 passed**.
- Final browser journey (`flow-26096132` / `main`): login → organization create/activate/plan → workspace → Horizon setup dashboard → departments/designations/employee → Payroll enrollment handoff → compensation → calculation → pay-run process → dashboard resume → finalize → ledger → return to run → payslip. Expected missing-enrollment 404 and cross-context 403 responses were asserted.
- Workspace switching (`flow-25778930`, second workspace `journey-154391`): empty-state counts, creation without optional organization details, delayed old response, employee form reset, actual API context, organization switch with reused `main`, and revoked-workspace readiness 403 all passed with no page exceptions. The temporary workspace was deactivated and Starter restored.
- Visual review confirmed the existing Horizon layout with the primary payroll action above setup details; repeated “by Lexorion” branding was removed.

Scope/limitations: self-service organization provisioning remains the existing operator/invitation path; recent action selection uses the latest five runs; configuration counts do not replace period-specific validation. Eureka registration may briefly lag a restarted service, as observed before a successful retry. Production database isolation remains **prepared and verified on disposable PostgreSQL; production migration pending explicit approval**. No production ownership mutation was executed.

See [customer journey implementation and verification](horizon-customer-journey.md) for changed files and the recommended next small slice: pay-run preparation using existing employee selection and period-validation logic.

## Current P0/P1 closure pass — 2026-10-04

Scope remains deployment security, invitations, payroll periods/recovery, and the requested Workforce/access/session verification. No Finance, Attendance, Leave, Recruitment or Performance feature work was done. Existing unrelated working-tree changes were preserved. No completion percentage is assigned.

| Blocker | Current status |
| --- | --- |
| P0 secure deployment | **P0 — prepared and verified on disposable PostgreSQL; production migration pending explicit approval.** Existing services still use the shared `postgres` role; exact plan and tested rollback are documented. |
| P1 invitations | Implemented; real SMTP failure/retry, new-account acceptance and membership/access verified locally. Existing-account, resent-link, revoked-link and second-organization acceptance passed in the deployed browser. |
| P1 payroll periods | Supported full-period rules implemented and tested; recurring/one-time processing and invalid periods verified in the browser. Recalculation preserves old snapshots; finalized duplicate-action rejection and unchanged ledger/payslip passed in the deployed browser. |
| P1 failed-run recovery | Failed → Draft → Process → Finalize verified locally. Backend rollback, abandoned-attempt fencing and duplicate-history guards verified. |

### P0 — Secure deployment configuration

**Status: P0 — prepared and verified on disposable PostgreSQL; production migration pending explicit approval.** The existing installation has not been migrated and this blocker is not closed.

**Problem / root cause:** All four running applications and Flyway use the shared `postgres` superuser. Secret rotation did not transfer ownership of the existing databases/tables; the empty-volume initializer cannot migrate populated storage.

**Actual topology:** Platform → `platform_db`; Workforce → `lexorion_workforce`; Payroll → `lexorion_payroll`; Finance → `lexorion_finance`. All are owned by `postgres`, have default PUBLIC CONNECT/TEMP, and contain `public` owned by `pg_database_owner`. Tables/indexes are owned by `postgres`. Finance contains its Flyway history table only. Exact roles, ACLs, object counts and startup dependencies are recorded in [the production approval package](database-isolation-approval.md).

**Files changed:** New `compose.db-isolation.yml`; `scripts/db-isolation/manage.py`, `configure-runtime.py`, `test-disposable.py`, `start-disposable-apps.py`, `test-fresh-startup.py`; `scripts/deployment-config.py`; Finance datasource configuration removes its superuser/empty-password fallback only; `docs/database-isolation-approval.md`, `docs/docker.md` and this P0 section. Earlier deployment/bootstrap hardening remains in place. No Finance functionality or unrelated application code changed in this pass.

**Migration design:** A restricted runtime login and a separate Flyway/database/schema owner for each service. Runtime receives own-database CONNECT, schema USAGE, table CRUD and sequence usage; no DDL, TRUNCATE, Flyway-history access or migration-role membership. No service role can connect to another service database or the maintenance databases. Role creation and ownership changes are explicit, reviewable operator SQL; no production DROP/CREATE database, schema deletion or data rewrite. Unknown topology/ownership/grants/objects stop for review. Private generated plan: `/private/tmp/horizon-production-role-review` (not applied; no secrets in this audit).

**Tests / backend verification:** A disposable copy of all four existing databases passed migration, repeated apply, rollback and reapply with unchanged table-content hashes, sequence positions, index definitions and Flyway history. Each verification passed 48 TCP/password checks: 8 own-database connections and 40 cross-service/maintenance denials. Runtime CRUD/sequence access passed; DDL/TRUNCATE/Flyway access was denied. All four applications started under split credentials; live PostgreSQL pools were confirmed to use the four restricted runtime roles. A separate empty disposable cluster executed Platform 9, Workforce 2, Payroll 7 and Finance 1 migrations under their migration roles. Targeted regressions: Platform 22, Workforce 47, Payroll 39, Finance migration 1; all passed, no skips. All eight missing migration configuration inputs rejected Compose; the proposed private configuration passed `check --isolated`.

**Browser verification:** The disposable deployment completed administrator login → organization creation/activation/plan → workspace → department/designation/employee → payroll employee/compensation → calculation → process/finalize → ledger/payslip. Reload/handoff and wrong-organization/workspace 403 checks passed. Fixture `flow-18743217` was created only in the disposable copy. Initial Eureka registration delay required retry after convergence; permissions were not weakened. This is evidence for the proposed cutover, not a claim that production was migrated.

**Remaining limitation / approval:** Existing services still use `postgres`. The previous automatic review rejection has not been bypassed; no existing-installation ownership/grant mutation or restart was performed. The [approval package](database-isolation-approval.md) provides exact backup, maintenance, SQL generation/application, credential update, restart, smoke/isolation and rollback steps, including Finance preservation. Production approval, execution and live verification remain required. Flyway's owner credential is still present in each service container because migrations run at startup; it is confined to that service's database. Earlier production TLS/DNS and external SMTP operator requirements remain unchanged.

### P1 — Invitation lifecycle

**Problem:** Invitations were persisted but messages disappeared; recipients had no complete registration/acceptance route.

**Root cause:** `DiscardingInvitationDelivery` did nothing, the gateway omitted `/api/invitations/**`, and acceptance only supported already-authenticated identities. Resent links also needed to update the page when only the URL fragment changed.

**Files changed:** Platform invitation delivery/service/controllers/entity/DTOs; new `InvitationRegistrationService` and `SmtpInvitationDelivery`; `V9__invitation_delivery_tracking.sql`; Platform security/configuration; gateway `application.properties`; frontend `InvitationPage.tsx`, Router, `adminApi.ts`, `AdminPage.tsx`; `compose.mailpit.yml`; `docs/invitation-lifecycle.md`.

**Tests added/updated:** `InvitationLifecycleIntegrationTest` covers new/existing accounts, duplicate membership/invitation, SMTP failure persistence/resend, token rotation, expired/revoked/accepted invitations, wrong recipient/organization and access after acceptance. `InvitationPage.test.tsx` covers public preview scope, invalid links, wrong account and same-tab rotated links. Platform PostgreSQL migration tests include V9.

**Backend verification:** SMTP uses the existing delivery abstraction. Every attempted delivery persists `SUBMITTED` or `FAILED` with a safe, visible reason and attempt time. Missing configuration fails visibly. Resend rotates the token without extending expiry. Registration derives email from the invitation and commits the Core account and membership atomically; existing accounts require authentication. Organization and invitation locks serialize acceptance, revoke and resend. Acceptance cannot change another organization's membership.

**Browser verification:** A deliberately stopped local Mailpit relay produced FAILED in the admin UI. Restarting the sink and selecting Retry delivery delivered a real message. Its link created/activated the recipient account, accepted membership and exposed the correct organization's accessible workspace. An accepted link was rejected on reuse. Role promotion/demotion and membership revocation were enforced against existing browser sessions. The final existing-account run (`existing-7967236@qa.test`) also passed duplicate rejection with controls retained, resend invalidation, same-tab replacement link, login/acceptance without duplicate account creation, revoked-link rejection, wrong-organization rejection, and signed-in acceptance into the second organization.

**Remaining limitation:** SMTP acceptance is not proof of delivery to a real inbox. Production requires an operator-configured relay, sender authorization and HTTPS recipient origin; these remain external. Delivery is synchronous with bounded timeouts, not a durable queue: a crash or ambiguous SMTP result can require resend, which invalidates earlier links. Workspace access follows existing organization-role/product/workspace policy; there is no new per-invitation workspace-grant model. Inactive existing accounts require existing administrative reactivation.

### P1 — Payroll period semantics

**Problem:** Correct arithmetic could include compensation in the wrong period or repeat a one-time assignment.

**Root cause:** The calculator selected profiles by calculation date, ignored frequency/occurrence, and stored no period/assignment provenance. Different run keys could overlap an employee's paid period.

**Files changed:** Payroll `PayrollPeriod`, `CalculationService`, `CompensationService`, `PayRunService`, `PayRunTransactions`; calculation/profile/line/run entities and DTOs; `PayRunEmployeeRepository`; `V7__payroll_period_snapshots_and_recovery.sql`; frontend payroll API/page; `docs/payroll-period-semantics.md`.

**Tests added/updated:** Payroll calculation/pay-run tests cover recurring periods; eligible/ineligible one-time compensation; monthly/weekly/biweekly compatibility; outside/partial eligibility; inclusive and leap-year boundaries; duplicate/overlapping processing; preview and run recalculation; immutable finalized payroll; legacy one-time payout protection. PostgreSQL migration tests confirm workspace preservation and existing profile-frequency backfill.

**Backend verification:** Periods are inclusive full calendar months or 7/14-day intervals anchored to employee eligibility. The profile and employee must cover the whole period. A profile snapshots frequency at assignment; mismatches fail. The run selects by period start; calculation date may follow the period. One-time assignments apply in the profile's first aligned period and are checked against committed calculation lines, including conservative matching of legacy lines without assignment IDs. Overlapping CALCULATED/FINALIZED runs are rejected under the workspace lock. Snapshots preserve amounts, period, source profile/frequency and assignment identity. Legacy calculated snapshots without period provenance cannot finalize until reset/recalculated.

**Browser verification:** Recurring USD 1000 processed/finalized with matching ledger/payslip. A new USD 250 one-time assignment contributed in October and was excluded from November. A partial monthly period failed visibly. The final browser run `RECALC-7928304` processed November recurring compensation with a December calculation date, reset and recalculated while preserving the earlier snapshot, finalized the replacement, and rejected all repeated mutation attempts with an unchanged two-entry ledger and correct payslip. Legacy handling is covered by backend tests; historical production data is not certified by this fixture.

**Remaining limitation:** No proration, off-cycle bonus periods or frequency conversion is supported. Existing finalized records are preserved, not retrospectively certified or corrected. Historical profiles did not record assignment frequency; migration uses their current employee frequency. Operators must review historical frequency changes because absent historical facts cannot be reconstructed. Full semantics and legacy handling are documented in `docs/payroll-period-semantics.md`.

### P1 — Failed pay-run recovery

**Problem:** FAILED runs were a dead end, and crashes could leave PROCESSING indefinitely.

**Root cause:** Processing required DRAFT, but no operation returned a failed/abandoned run to that state. There was no attempt identity to fence late completion after recovery.

**Files changed:** Payroll `PayRunTransactions`, `PayRunProcessingService`, `PayRunService`, `PayRunController`, run entity/DTO and V7; frontend payroll API/page and tests; payroll semantics documentation.

**Tests added/updated:** Pay-run integration tests cover a later employee failing after an earlier calculation, zero partial snapshots/ledger, recovery after fixing compensation, authorization/tenant boundaries, finalization failure after ledger insertion followed by successful retry, active/stale processing, superseded-attempt fencing, recalculation with preserved old snapshots and rejection of finalized mutations.

**Backend verification:** Begin commits an attempt ID; completion is one transaction for all included employees. Failure rolls it back and records FAILED/reason separately. Recovery resets FAILED or abandoned PROCESSING after five minutes; attempt IDs prevent an older worker changing the replacement attempt. CALCULATED runs may explicitly reset for recalculation, retaining historical calculation objects while clearing run references/totals. Recovery rejects finalized timestamps or existing ledger entries. Finalization commits status and ledger together; failure leaves CALCULATED and no partial ledger. A retry cannot duplicate finalized history.

**Browser verification:** A run without compensation became FAILED with a persistent reason and Recover to draft action. After creating compensation, the same run recovered, processed and finalized; its payslip matched the amount. Finalized runs expose history rather than mutation actions. `RECALC-7928304` also passed the explicit Reset for recalculation UI flow, retained old snapshots, and rejected recovery, processing and finalization after finalization without changing its ledger.

**Remaining limitation:** Run dates/currency remain immutable. For incorrect immutable run metadata, create a new run; no arbitrary cancellation state was added. An abandoned transaction holding a database lock must finish/rollback before recovery obtains the lock. There are no external bank/payment/Finance writes in this state machine, so this recovery contract does not claim to reverse external disbursements.

### Additional issues found during the required access checks

- Product selection read a cleared React event inside a deferred state updater. `AdminWorkspaces.tsx` now captures the selected values immediately; its new regression test runs under StrictMode.
- Workspace refresh remounted organization administration forms and discarded pending edits. `AppShell.tsx` now scopes those forms to organization identity while retaining workspace isolation for workspace screens; regression test added.
- Payroll authority accepted a commercially entitled product after it had been removed from the workspace. `WorkspaceAccessService` now requires the product to be attached/active; `EntitlementSecurityIntegrationTest` covers removal and restoration with the same bearer token.
- Browser verification passed Business quota increase → second workspace creation → Payroll product removal → API denial → restoration → Starter quota restriction. These are fixes to the requested access verification flow, not additional module work.

### Verification evidence and limits

- Full Platform host suite: 58 reported, **56 passed, 2 optional local-database tests skipped**; its Testcontainers PostgreSQL migration test ran successfully.
- Full Payroll host suite: **48 passed, no skips**, including real PostgreSQL migration.
- Frontend: **37 passed across 13 files**; production image build and lint successful. Final repeated browser checks use the deployed images, not mocked responses.
- Workforce image build: 48 reported, 47 passed and its Docker-only migration test skipped inside the image build. Gateway image build: 6 passed. No Finance feature/test changes were made in this pass.
- Compose: each of 14 missing required inputs rejected; full explicit configuration accepted; weak-secret preflight rejected; disposable database role isolation and full bootstrap runtime checks passed.
- Local Chrome: full baseline business journey, manager/cycle, role change/revocation, workspace deactivation/reactivation, plan quota change, product access removal/restoration, session refresh/expiry, and payroll failure/recovery passed. Expected authorization/validation failures were asserted. No page exceptions occurred in successful runs.
- HTTPS host checks used a temporary loopback TLS proxy with a test certificate and Chrome-only DNS mapping. Secure HttpOnly shared refresh cookie, platform → organization handoff, a correctly signed expired access token, revoked refresh family, and exclusion of the public parent host all passed. This does not certify external production DNS or certificates.
- Controlled QA data remains under `Flow QA`, particularly `flow-15468086`, plus the earlier QA organizations. It includes inactive access-test workspaces, invited QA users and payroll fixtures. Finalized fixtures are retained rather than deleted or rewritten. Mailpit only receives local QA messages. The final repeated matrix used recipient `invite-7995232@qa.test`, employee `MANAGER-7995232` and recovered run `RECOVER-7995232`; all assertions passed with no page exceptions. A retry immediately after restarting the relay initially remained FAILED; retry after service/DNS recovery submitted successfully, with the invitation and recovery action preserved throughout.

## Previous flow audit — historical evidence before this closure pass

The following tables retain the earlier audit and its then-pending results. The current blocker status is above.

### Evidence and reconnaissance

- `frontend/src/app/Router.tsx`: local Horizon entry `/overview`; separate client and platform hosts; protected routes and organization-role guards.
- `frontend/src/layout/AppShell.tsx`: organization/workspace selectors; role/product-aware Workforce and Payroll navigation; no Finance route.
- `frontend/src/auth/AuthProvider.tsx` and `authApi.ts`: sign-in, server membership selection, refresh restoration and logout. `/register` is informational, not self-registration.
- `frontend/src/workspace/WorkspaceProvider.tsx`: Core Horizon access check followed by accessible Horizon workspaces. Only server-returned workspaces can be selected.
- `frontend/src/core/CoreConsole.tsx`: Core user/organization/association/product enrollment administration. Core association does not grant a Horizon role.
- Initially, Platform organization directory/detail were read-only. Members can change/remove existing roles but cannot provision the first administrator. The existing Platform create-organization API sets the selected owner’s Horizon ADMIN role and enrolls the organization; Core-only creation does not supply that role. This pass connects that existing Horizon API to organization setup UI. Organization plan/entitlement and workspace administration are separate Horizon prerequisites.
- `frontend/src/pages/HomePage.tsx`: active context, capability counts, setup links and recent pay runs. Counts do not prove usable compensation or payroll configuration.
- Workforce: department/designation references, employee creation/profile/edit/status/user mapping, team and reporting structure. UI reference names are entered as keys; no connected setup guide initially.
- Payroll: employees, components, salary templates and versions, compensation, standalone calculations, pay runs, ledger and payslip data. APIs are in `features/payroll/payrollApi.ts`.
- Services: Core and Horizon Platform share one deployable; Workforce and Payroll own separate persistence and use HTTP authority/employee checks; Finance is a shell. No cross-service database reads are required for these journeys.
- Gateway routes `/api/core`, `/api/platform`, `/api/tenant`, `/api/workforce`, `/api/payroll`, `/api/finance`; preserves Host and removes supplied internal authority headers.
- Database migrations: Platform V1–V8, Workforce V1–V2, Payroll V1–V6, Finance empty baseline. Core owns global identity and organization; Horizon owns role extensions/workspaces/plans/domain data.
- Unit/component and backend integration/security tests exist. No repository browser E2E suite or configured browser automation was found.

### Journey map before fixes

| Journey | Screen/API transitions and required state | Current outcome / failure |
|---|---|---|
| A: First entry | `/login` → POST `/api/core/auth/login` → GET `/api/platform/me` and `/organizations` → active membership selection → Core `/api/core/me/organizations/{id}/products` → tenant `/workspaces/accessible` → shell/dashboard | Operator provisioning is supported; customer self-registration is absent. No memberships is a dead end requiring an operator. A Core association alone supplies no Horizon role. No grant prevents entry; no workspace guides admins to setup. |
| B: Setup | Core operator creates the user; Horizon operator creates the organization with an existing Core user as owner and assigns its plan → organization admin `/organization/workspaces` → POST `/api/tenant/workspaces` | Initially the necessary APIs existed but the first-company creation/activation/plan UI was missing; controls added in this pass. Core user provisioning remains separate. Disabled create button for no permitted products initially lacks actionable guidance. |
| C: Workforce | `/workforce/departments` → designations → employees → employee profile edit → structure | Supported CRUD sequence exists, with backend role/context checks. Reference keys require knowledge of previous steps. Workforce reload initially ignores workspace changes. |
| D: Payroll | Workforce employee → Payroll employee → component/template/profile → calculation → pay run create/add employee/process → CALCULATED review → finalize → employee ledger/payslips | Endpoints/screens connect. Snapshot, finalization and history exist. Occurrence/frequency are stored but calculation does not apply period semantics. Failed processing leaves FAILED with no retry/reset operation. Actual deployed browser completion remains unverified. |
| E: Return | login/refresh → server memberships → persisted org/workspace → overview → recent workflow | Context is tab session storage; logout clears it. Handoff workspace initially cleared when organization differs. Dashboard lists recent runs but initially has no direct continuation link. |
| F: Boundaries | wrong organization/workspace, role, suspended access, disabled entitlement and expired session | Backend checks exist and security tests exercise them. Frontend product navigation is not security. Initial workspace reload can be overwritten by a response from an old organization; scoped page state can persist between tenants. |

### Prioritized blockers

| ID | Journey | Screen/API | Problem | Severity | Root cause | Fix |
|---|---|---|---|---|---|---|
| FLOW-01 | F | Compose | Predictable signing/service/database secrets, enabled default bootstrap, publicly bound DB/registry ports | P0 on untrusted exposure | Development defaults usable as deployment defaults | Require supplied secrets, opt-in bootstrap, bind DB/registry to loopback; production registry must remain private |
| FLOW-02 | A/B | Invitations | Recipient gets no invitation; new account activation unavailable | P1 | DiscardingInvitationDelivery; accept requires existing authenticated identity | Complete supported delivery/acceptance or explicitly use operator-provisioned accounts |
| FLOW-03 | A/E | AuthProvider | Requested handoff workspace lost after organization validation | P1 | Query workspace stored before organization selection then cleared | Apply requested workspace only after requested organization membership is verified |
| FLOW-04 | C/E/F | WorkspaceProvider / scoped pages | Old organization responses or scoped screen state may appear after context change | P1 | Uncancelled loads and component reuse across contexts | Reject obsolete loads; hide old scope immediately; remount domain outlet on context change |
| FLOW-05 | D | CalculationService / PayRunTransactions | ONE_TIME and frequency metadata do not affect period calculation | P1 before money use | Calculates all effective profile assignments using calculation date only | Specify supported semantics from repository/product owner; implement and test period rules without guessing |
| FLOW-06 | D/E | FAILED pay run | Cannot recover/retry run from current UI/API | P1 | State requires DRAFT to process; no supported reset/retry operation | Implement explicit authorized recovery with consistent snapshots, or give documented replacement-run procedure |
| FLOW-12 | C/D/F | Workforce/Payroll workspace persistence | A second company using `main` fails to create records; Workforce may misreport it as 403 | P1 | Service schemas globally constrain workspace_key while Platform scopes keys per organization | Remove global display-key constraints via Workforce V2 / Payroll V6; keep trusted UUID identity and scoped repositories |
| FLOW-10 | A/B | Platform organizations | First administrator cannot create/activate company and assign plan through read-only organization pages | P1 | Existing APIs not connected to UI | Connect organization creation with owner, activation and plan assignment to existing Platform APIs |
| FLOW-11 | E | ApplicationContext | Local platform deep link redirects to overview on reload | P1 | Mode initially client before stored mode is restored | Initialize local mode from tab session storage before protected route evaluation |
| FLOW-07 | B/C/E | Workspace setup / Workforce / overview | Missing prerequisite explanations and next actions | P2 | Screens expose individual operations, limited connected guidance | Explain plan requirement; link departments → designations → employees → structure; allow continuing recent runs |
| FLOW-13 | C/D/E | AppShell / PayrollPage | Reference-to-employee navigation renders the old data shape; processing reload discards the selected review run | P1 | Reused routed screen state and unconditional loading unmount | Remount screens per pathname/context; preserve pay-run review during data refresh |
| FLOW-08 | F | Router | Unexpected render errors expose developer error page | P2 | No custom error element | Add safe recovery with reload/home actions |
| FLOW-09 | Finance | Routes/service | No executable Finance journey | Not implemented | Service shell only | Keep unavailable; define supported scope separately, do not add speculative features |

### Manual QA checklist

A sandbox HTTP request could not reach localhost; elevated read-only checks confirmed the stack is healthy. Browser automation was installed in a temporary directory and uses installed Chrome against a temporary Vite preview and localhost nginx, backed by the running gateway. Workforce and Payroll images were rebuilt/restarted with the additive migrations. The final frontend image was rebuilt and applied to localhost; the history/return/isolation browser scenario passed against that published local image. Results are recorded below. These checks do not validate production host/TLS behavior. Use browser Network with Preserve log and Console during the following checks. Never put passwords/tokens in the checklist or screenshots.

| Step | Exact local action | Expected UI / API | Actual browser result |
|---|---|---|---|
| 1 | Open `/core/`; sign in as existing operator. Users → create test company administrator if needed | User persisted through Core API; validation failures visible | Pending |
| 2 | Horizon Platform → Organizations → Create organization; choose existing Core administrator, enter name/code/email and optional slug | POST /api/platform/organizations delegates creation to Core, assigns Horizon ADMIN to the chosen owner and enrolls Horizon; new organization starts PENDING | Passed against live backend in browser (QA companies only) |
| 3 | On the new organization detail, click Activate organization; choose Starter or Business and click Assign plan | PATCH organization status and PATCH organization with planKey succeed; Enter organization appears for the owner once ACTIVE | Passed against live backend in browser (QA companies only) |
| 4 | Sign in as company admin. Choose company in header. Overview → Set up a workspace | Membership verified; accessible workspace request scoped to company; workspace setup reachable without selected workspace | Passed against live backend in browser (QA companies only) |
| 5 | Create workspace `flow-a`, select entitled Workforce and Payroll products | POST tenant workspace succeeds; selector reloads; no-workspace error replaced by available workspace | Passed against live backend in browser (QA companies only) |
| 6 | Select `flow-a` in header → Workforce → Departments; create `engineering` | Department appears; workforce requests carry organization/workspace headers | Passed against live backend in browser (QA companies only) |
| 7 | Follow Designations; create `developer`; follow Employees; create `FLOW-001` with engineering/developer and valid email/date | Creation succeeds; invalid reference rejected visibly; employee profile opens | Passed against live backend in browser (QA companies only) |
| 8 | Create manager and edit FLOW-001 reporting manager; open Structure | Reporting line shown; self/cycle assignment rejected | Pending |
| 9 | Payroll → Employees; configure FLOW-001 with valid currency/frequency/effective date | Workforce employee checked through service API; unrelated employee rejected | Passed against live backend in browser (QA companies only) |
| 10 | Payroll → Components; create recurring fixed earning `base`; Compensation → FLOW-001 → effective profile with value 1000 and matching currency/date | Profile persisted and listed; no effective profile produces an explicit error | Passed against live backend in browser (QA companies only) |
| 11 | Calculations → FLOW-001 → date inside effective profile | Gross 1000, deductions 0, net 1000; stored calculation snapshot | Passed against live backend in browser (QA companies only) |
| 12 | Pay Runs → create `FLOW-RUN-1` with ordered period and matching currency/date; Open; add FLOW-001; Process | DRAFT → PROCESSING → CALCULATED; totals equal snapshots; failure displays error/FAILED | Passed against live backend in browser (QA companies only) |
| 13 | Review totals and included employee; Finalize; then Ledger/Payslips → FLOW-001 | FINALIZED once; signed ledger and payslip totals match; second finalize does not duplicate history | Passed against live backend in browser (QA companies only) |
| 14 | Go Overview → Continue pay run; navigate Workforce and back; reload tab | Correct organization/workspace retained; current supported data appears | Passed against live backend in browser (QA companies only) |
| 15 | Open `/?organization=<authorized-slug>&workspace=flow-a` on the client host, or `/overview?organization=...&workspace=flow-a` locally, including before login | Query is removed from URL; authenticated membership validated; requested workspace selected only if accessible | Passed against live backend in browser (QA companies only) |
| 16 | Create second workspace; create distinct records; switch workspaces. Switch company while first company's response is delayed in Network throttling | Old response must not restore old company's workspaces; old forms/data reset; requests use current selectors | Pending |
| 17 | Tamper organization/workspace headers; test EMPLOYEE account on admin/payroll URLs; suspend membership or revoke Horizon enrollment | Server denies unauthorized operations regardless of navigation visibility; no data/mutation crosses scope | Wrong organization/workspace denied 403 in browser; role/suspension covered by backend tests, additional browser checks pending |
| 18 | Remove payroll.processing entitlement and process/finalize; expire/revoke session and retry | Backend denies missing entitlement; invalid session clears auth and returns to sign in, not infinite retry | Pending |
| 19 | Send invitation to controlled address | Existing discard implementation delivers nothing: FLOW-02 remains open | Pending reproduction; source-confirmed blocker |
| 20 | In isolated test workspace configure ONE_TIME assignment; process two distinct periods; vary pay frequency/effective date | Correct one-time/period rules required; current implementation includes effective assignments again: FLOW-05 remains open | Pending reproduction; source-confirmed blocker |
| 21 | Process run without effective compensation; fix profile then retry same run | Current status FAILED lacks reset/retry: FLOW-06 remains open | Pending reproduction; source-confirmed blocker |
| 22 | Validate configuration with secret values unset and bootstrap disabled; inspect published ports using Docker | Compose rejects absent required secrets; no fallback admin provisioned; DB/registry published only to loopback | Config passes with supplied values and rejects missing required secrets; runtime DB/registry exposure rollout pending |

### Operational acceptance

Horizon is usable for its supported Workforce/Payroll scope only when an operator can provision the company through existing Core/Horizon concepts, its administrator can enter and complete workspace/employee/payroll setup with visible next actions, a supported pay run can be reviewed/finalized and its frozen ledger/payslip read, returning users resume in verified context, and unauthorized or stale context cannot expose/mutate another tenant. Supported payroll semantics must be specified and verified before money use. Invitation-based entry is not usable until delivery/acceptance works. Finance is not implemented and is not included in this acceptance claim.

Passing compilation is insufficient. Deployment/browser checks above and PostgreSQL migration execution must be completed before calling any full journey complete.

### Results after this pass

| Journey | Status | Remaining blocker / verification |
|---|---|---|
| A: First entry | 🟡 Partial | Operator sign-in and Horizon company provisioning tested; invitation delivery/activation unavailable; new Core user creation not exercised in this browser run |
| B: Organization/workspace setup | 🟢 Complete for existing-operator path locally | Create company with owner → activate → assign Starter → enter → create/select workspace tested; public hosts pending |
| C: Workforce setup | 🟡 Partial | Department → designation → employee/profile tested. Reporting-manager edit/structure and reference editing/deactivation need the remaining browser checklist |
| D: Payroll | 🟡 Partial | Recurring fixed amount profile → calculation → processed/finalized run → ledger/payslip tested. ONE_TIME/frequency/period semantics and FAILED recovery remain open |
| E: Returning user | 🟡 Partial | Local mode/deep links, verified handoff and reload exercised; shared-cookie public-host flow pending |
| F: Security boundaries | 🔵 Needs additional manual verification | Wrong organization/workspace rejected live; roles/access/entitlements covered by integration tests; deployment host checks pending |
| Finance | ⚪ Not implemented | No operational route/domain; excluded from operational acceptance |

Verified changes: FLOW-03/04 handoff/context protection; FLOW-10 company setup controls; FLOW-11 saved mode initialization; FLOW-12 tenant-local workspace keys with data-preserving migrations; FLOW-13 route state and persistent pay-run review; connected Workforce setup navigation; recent-run deep links; safe route recovery. FLOW-01 configuration now requires explicit secrets, opt-in bootstrap and loopback DB/registry binding; existing DB/registry rollout and credential rotation are still required. No Core boundary or database ownership change was needed.

Validation: 30 frontend tests passed across 11 files; production TypeScript/Vite build and lint passed. Relevant Platform 36, Workforce 46 and Payroll 28 tests passed. Two actual PostgreSQL migration regressions passed with no skips, exercising old-schema failure, upgrade, preservation and successful same-key insertion. Docker Workforce/Payroll builds also passed their suites; their inner builds skipped Docker-based tests, which were separately executed against real PostgreSQL. Compose accepts supplied secrets and rejects their absence; diff whitespace validation passed.

Live QA data remains under `Flow QA` companies, including `flow-12897975` and `flow-12149776`; two earlier interrupted setup attempts also exist. Finalized runs contain test records, not real company payments. Main verification used fixed recurring USD 1000, deductions 0, net 1000. Reused `main` across companies worked after migration. Ledger/payslip amounts match. Expected wrong-context requests produced 403 and associated browser network messages; no unexpected console/page errors occurred in the successful history/return/isolation run. Before correcting the workspace-key input regex, Chrome reported an invalid HTML pattern under its Unicode `v` rules; the hyphen is now escaped.

Remaining P0/P1: deploy secure configuration and rotate previously predictable secrets; finish invitation delivery/acceptance; specify and enforce supported period/occurrence/frequency semantics; provide explicit FAILED pay-run recovery. Do not call the entire product operational until those supported-flow blockers and the pending boundary checks are resolved.

Final localhost verification: sign-in, finalized-run review, ledger, payslip, overview continuation, reload, verified handoff and wrong-context 403 checks all passed against the updated nginx frontend. Production DNS/TLS and shared-host cookie checks remain pending.
