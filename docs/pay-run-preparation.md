# Pay-run preparation

## Workflow and existing models

Create a Draft with its inclusive period, calculation date and currency. The preparation panel lists **Payroll employees in the current workspace**, their period eligibility, blocked reason and current Draft membership. Workforce employees not yet enrolled in Payroll are not counted; the panel links to payroll employee configuration.

Select eligible employees → **Save selection** → **Ready to calculate** → **Process** → review calculated totals → **Finalize** → ledger/payslip.

Preparation reuses `PayRun`, `PayRunEmployee`, `PayrollEmployee`, `CompensationProfile`, `ComponentAssignment`, `PayrollPeriod` and the calculation engine. It adds no database tables, migrations or lifecycle states. Preparation evaluates an unsaved `Calculation` using the same evaluator as processing. It creates no calculation history and consumes no one-time assignment.

## API and enforcement

- `GET /api/payroll/pay-runs/{key}/preparation`: derives employee/eligible/blocked/selected counts, candidate reasons and readiness from current records.
- `PUT /api/payroll/pay-runs/{key}/preparation`: atomically replaces Draft membership with `{"employeeCodes":["EMP-001"]}`. Normalizes codes; duplicate normalized codes, foreign/unknown employees and blocked selections are rejected before membership changes. Repeating the same valid selection is idempotent. An empty list clears the Draft but cannot be processed.
- Both require the existing live workspace authority, administrator role and `payroll.processing` entitlement. Tenant identifiers are taken from trusted context; body context injection is rejected.
- The legacy add-employee route remains a staging operation for compatibility. Staged membership is not a readiness promise. Direct processing uses the same eligibility rules and rolls back all snapshots on failure.

### Existing rules reused

1. Payroll employee is active.
2. One active compensation profile applies at period start, with components configured.
3. Employee and profile frequencies match. The selected period is a full calendar month or an anchored 7/14-day period.
4. Employee/profile validity covers the whole inclusive period; no proration.
5. Recurring components contribute in eligible periods. One-time components contribute only in the profile's first aligned period and cannot be consumed in another committed run. See [period semantics](payroll-period-semantics.md).
6. Other **Calculated or Finalized** runs for the employee cannot overlap. Other Drafts do not reserve pay and therefore do not block preparation.
7. Calculated currency matches run currency. Existing percentage-basis, precision, deduction and total rules apply, including aggregate precision across the selection.
8. Period end and calculation date cannot precede period start. Run dates remain immutable; incorrect dates require a new Draft.
9. Only Draft membership can change; Process, recovery and Finalize keep the existing state machine and immutable historical snapshots.

The report returns the first blocking business reason for each employee. Resolve it and refresh to see any subsequent reason. Counts cover all enrolled payroll employees; selected counts describe the saved Draft on the server and the current checkbox selection in the UI. Unsaved selections cannot enable Process.

Readiness is evaluated at request time, not a durable authorization or reservation. Processing independently revalidates under the existing workspace lock. Its transaction uses READ_COMMITTED so a processor waiting for that lock sees another run's committed result. This changes transaction visibility only; tenant/database isolation architecture is unchanged.

## Limitations

There is no attendance, tax jurisdiction, bank-detail, proration or employment-history eligibility rule added here. Payroll employee status and the existing compensation engine remain authoritative. The candidate list is unpaginated and evaluates each employee's compensation; this is suitable for the current MVP, but larger workspaces will need measured query optimization/pagination without changing rules.

The UI does not require an artificial “visited preparation” marker. API clients can process an already valid Draft, but cannot bypass any preparation business rule. Refresh discards unsaved checkbox edits and reloads saved membership.

## Files changed in this slice

Backend (under `backend/payroll-service/src`):

- `main/java/com/lexorion/payroll/api/PayRunController.java`
- `main/java/com/lexorion/payroll/api/PayRunPreparationDtos.java` (new)
- `main/java/com/lexorion/payroll/service/CalculationService.java`
- `main/java/com/lexorion/payroll/service/PayRunEligibility.java` (new)
- `main/java/com/lexorion/payroll/service/PayRunPreparationService.java` (new)
- `main/java/com/lexorion/payroll/service/PayRunTransactions.java`
- `main/java/com/lexorion/payroll/repository/CompensationProfileRepository.java`
- `test/java/com/lexorion/payroll/PayrollPayRunIntegrationTest.java`
- `test/java/com/lexorion/payroll/PayrollPreparationPostgresTest.java` (new)

Frontend (under `frontend/src`):

- `features/payroll/payrollApi.ts`
- `features/payroll/payrollApi.test.ts` (new)
- `pages/payroll/PayRunPreparation.tsx` (new)
- `pages/payroll/PayRunPreparation.test.tsx` (new)
- `pages/payroll/PayrollPage.tsx`
- `pages/payroll/PayrollPage.test.tsx`

Documentation: this file and `docs/horizon-flow-audit.md`. Other pre-existing working-tree changes are not part of this slice.

## Regression coverage

Eight preparation integration tests cover eligibility/missing compensation/inactive status, atomic replacement and normalized duplicate detection, empty/idempotent selection, preparation followed by calculation/finalization, invalid period/frequency/profile boundaries/currency, changed eligibility and committed overlap, workspace/role/entitlement/context injection, legacy blocked membership recovery and aggregate precision.

The PostgreSQL test class runs all 26 pay-run/preparation tests against a disposable PostgreSQL database using the existing migrations. An additional deterministic concurrent-processor test establishes the second transaction's read before the first commits, then verifies the second processor rejects the overlapping run after obtaining the workspace lock. The existing migration test also runs on disposable PostgreSQL.

Frontend tests cover server reasons/counts, explicit save before Process, removal of blocked saved membership, save failures, empty/unavailable states, stale responses, and the existing process/finalize/recovery/compensation handoff. API tests exercise the real HTTP client's JSON serialization, scope headers, server error propagation and workspace changes.
