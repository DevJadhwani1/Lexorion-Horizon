# Horizon customer journey — first build slice

Date: 2026-10-04. This builds on the existing organization/workspace, Workforce and Payroll flow. It does not change database isolation, run the pending ownership migration, add a business module, or change Core identity.

## Implemented

- Horizon entry identifies the organization, workspace, membership role and signed-in user. The existing sidebar and organization/workspace selectors remain the navigation foundation; repeated “by Lexorion” branding was removed.
- Overview uses actual workspace records: active Workforce employees, configured Payroll employees, compensation coverage, plan/workspace limits and the latest five pay runs. Its primary payroll action resumes a recent draft, failed, processing or calculated run, or explains the next configuration step. Recent finalized results link back to the immutable run.
- Guided setup links explain why each step matters. Departments, designations, reporting relationships, salary templates and standalone previews are optional under the existing backend rules. Workforce enrollment, Payroll enrollment and compensation are real calculation prerequisites. No artificial prerequisite was added.
- Pay-run employee rows link directly to compensation or finalized ledger/payslip history. Configuration links carry a validated local return destination, allowing users to return to the original run. Every Workforce/Payroll screen has a Horizon overview return link.
- Missing Payroll enrollment offers a route to configure the employee and return to compensation. Empty employee/history states explain the next action. Overview errors provide a retry action.

## Files changed

- Payroll: new `api/PayrollReadinessController.java` and `service/PayrollReadinessService.java`; scoped query additions in `PayrollEmployeeRepository.java` and `CompensationProfileRepository.java`; `PayrollCalculationIntegrationTest.java` regression coverage.
- Frontend entry/overview: `pages/HomePage.tsx`, new `pages/HomePage.test.tsx`, `layout/AppShell.tsx`, `layout/Sidebar.tsx`, `components/auth/AuthLayout.tsx`, `index.html`, `styles.css`.
- Frontend context: `api/session.ts`, `api/httpClient.ts`, new `api/httpClient.test.ts`.
- Frontend workflow: new `components/HorizonWorkflowNav.tsx` and test; `features/payroll/payrollApi.ts`; `pages/payroll/PayrollPage.tsx` and test; `pages/workforce/WorkforcePage.tsx`.
- Documentation: this file and the focused follow-up section in `docs/horizon-flow-audit.md`.

## Derived configuration summary

`GET /api/payroll/readiness` is a small read-only projection over existing Payroll employees and compensation profiles. It uses the existing trusted workspace filter, ADMIN method authorization and processing entitlement gate.

It returns:

- `activeEmployees`: active Payroll employee count in the authorized workspace.
- `employeesWithCompensation`: those employees with at least one ACTIVE profile containing components; multiple profiles count once.
- `nextEmployeeCode`: the first active employee without such a profile, for a setup link.

This is **configuration coverage, not period eligibility or approval**. A future or historical active profile still exists as configuration. Only the existing calculator validates full-period coverage, profile/frequency compatibility, boundaries and one-time eligibility. The UI states this distinction and does not label these employees “ready to pay.” No schema/migration or duplicated configuration store was introduced. Two scoped queries avoid fetching each employee's profile history separately.

Recent actions are derived from the five most recently created runs returned by the existing pay-run API. Older runs remain available through the existing paginated Pay Runs screen; this is not an exhaustive unresolved-run queue.

## Context and security defects fixed

1. The HTTP client previously rebuilt tenant headers from the latest selection when retrying a request after refresh. A request initiated in one workspace could therefore be replayed in another authorized workspace. Requests now retain their original headers, verify a context revision before retry and discard late responses. Switching away and back also invalidates the old request.
2. A refresh completing after logout could restore old credentials. Refresh now verifies the original session before saving returned tokens.
3. Editing an employee code could retain the previous employee's loaded Payroll context. Changing the code now invalidates pending loads, clears the old record and disables calculation until the new employee is loaded.
4. Overview loading now ignores responses from previous selections. Existing AppShell remounting and WorkspaceProvider organization fencing are reused. Context-specific global error messages clear on selection changes.

A request already accepted by the server before a switch may still finish in its **original** workspace. The client does not promise to undo that operation; it prevents replay into another context and display of its response as current data. Server authorization remains authoritative on every request, including readiness.

## Reused implementation

Core authentication/session refresh, organization membership, WorkspaceProvider, product/entitlement authority, existing Workforce and Payroll APIs, employee/profile repositories, calculation/pay-run state machine, ledger/payslip snapshots, Page/Notice/Badge/Button components, Horizon styling and host-aware routing.

## Verification

- Frontend: **50 tests passed**, including dashboard empty/setup/action/error states, delayed workspace responses, request replay prevention, logout/refresh race, employee context reset and validated workflow returns. TypeScript/Vite build and lint passed.
- Payroll: **41 targeted tests passed**, including the new summary/count/authorization/revocation tests, calculation, pay-run, security and real PostgreSQL migration regressions. Service package and Docker build passed.
- Platform: **18 entitlement security tests passed**.
- Workforce: **46 security/behavior tests passed**.
- Real browser: login → organization create/activate/plan → workspace → Horizon overview → department/designation/employee → missing Payroll enrollment handoff → compensation → standalone calculation → pay run/process → dashboard resume → finalize → ledger → return to run → payslip.
- Workspace browser checks: separate workspace data, optional organization details, late old-workspace response, clearing employee forms, API context, reused workspace key across organizations, and restoring the QA plan afterward.

Final deployed-build browser fixture: `flow-26096132` / `main` / `FLOW-001` / `FLOW-RUN-1`. Switching checks used `flow-25778930` and `journey-154391`; the workspace was deactivated and the Starter plan restored afterward. The readiness endpoint rejected that revoked workspace with HTTP 403 using the existing session. No page exceptions occurred in the switching run; the full journey had only the asserted 404/403 responses. Expected missing-enrollment 404 and wrong-context 403 responses are deliberate assertions. Test data is confined to clearly named local Flow QA organizations.

## Deliberately outside this slice

- Production database ownership migration is still pending explicit approval; its architecture and prepared package were not modified.
- Public self-service organization provisioning is still the existing platform-admin/invitation onboarding path. This slice begins with authentication and authorized organization/workspace selection.
- Eureka may briefly route to an unavailable instance after a service restart. Existing retries/overview error recovery remain available; registry architecture was not changed.
- Compensation inventory does not provide a period-specific bulk validation screen. Historical semantics and server-side calculation rules are unchanged.

## Recommended next small slice

A focused pay-run preparation screen: select existing employees, review the intended period/currency/frequency and surface the existing calculator's employee-specific validation results before finalization. Reuse the current pay-run and snapshot model; do not add an alternative payroll engine or new HR modules.
