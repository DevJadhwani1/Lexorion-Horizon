# Lexorion Horizon UI/UX audit

Audit date: 24 October 2026. Scope is the customer web app and the separate Core Console. Fixes below are in the source tree. A full visual rebuild of every operational screen was not required once the existing design system and journeys were inspected; the defects that were actually unsafe or misleading were fixed.

## Routes audited

Customer routes, after the `/app` prefix was removed from the router:

| Path | Screen |
|---|---|
| `/login`, `/register` | Sign-in and invitation-only access |
| `/invitations/accept` | Invitation acceptance |
| `/overview` | Dashboard |
| `/onboarding` | Organization setup |
| `/organization`, `/organization/workspaces`, `/people`, `/organization/invitations` | Organization administration |
| `/settings/organization`, `/settings/organization/product-access` | Organization settings and product access |
| `/workforce/employees`, `/workforce/employees/new`, `/workforce/employees/:employeeCode` | Employees |
| `/workforce/departments`, `/workforce/designations`, `/workforce/structure`, `/workforce/team`, `/workforce/me` | Workforce structure and self-service |
| `/payroll/runs`, `/payroll/employees`, `/payroll/compensation`, `/payroll/components`, `/payroll/salary-templates`, `/payroll/calculations`, `/payroll/ledger`, `/payroll/payslips` | Payroll |
| `/finance/overview`, `/finance/invoices`, `/finance/invoices/new`, `/finance/invoices/:reference`, `/finance/clients`, `/finance/payments`, `/finance/templates`, `/finance/books` | Client billing, collections, and books |
| `/platform/*` on the local host, and `/` on the platform host | Platform console |

Legacy `/app/...` URLs redirect to these paths and keep the query string. `/api/*` stays on the gateway.

Core Console, only on `/core`: overview, organizations, users, products, product access, operators, sessions, security, audit.

## Findings and fixes

### P0

- Service failures told customers to “check the Gateway” and named internal hosts. `frontend/src/api/httpClient.ts` now uses plain Horizon wording and drops messages that mention the gateway, Eureka, SQL, exceptions, trusted headers, or local service ports. A specific business message from the API is still shown.
- Sign-in offered disabled Google and “Continue with email” buttons beside the real email form, plus Terms, Privacy, and Help links that only jumped to `#`. Those controls were removed from `LoginPage.tsx` and `AuthLayout.tsx`.
- Password recovery remains unavailable. The disabled button was replaced with a sentence that an administrator handles recovery. Open registration was not added.

### P1

- `/register` was titled as if someone could create an account. It now says access is by invitation, which matches the existing backend.
- Customer navigation already hides Workforce, Payroll, and Finance unless the active workspace has that product, and the route guards still enforce the role and product. That behavior was left in place.
- Finalized payroll copy already states that finalizing locks the ledger and payslips and does not send a payment. EPF and ESI stay estimates. Professional tax, labour welfare fund, and income tax are not calculated. No payroll or finance business rule was changed.
- Recovering a failed or processing pay run now asks before returning it to Draft. Finalizing a calculated run already required confirmation and still says no bank, cheque, or cash payment is sent.
- Recording an invoice payment now says Horizon records that the client paid and does not collect the money or send it to a bank. Issuing a draft already required confirmation.
- Collections (`/finance/payments`) records a client receipt. Applying it to an invoice is separate. The table shows allocated and unallocated amounts from the payments API. Unallocated money is described as not reducing what the client owes. A failed load shows the error.
- The overview shows collected and unallocated figures from the billing summary. If that request fails, the screen shows the error and does not draw zero receivables.
- The client statement shows the ledger date basis, lists unallocated receipts outside the closing balance, and downloads a CSV that includes that basis. A failed year or statement request shows the error.
- Core Console no longer applies lock, suspend, cancel, product deactivation, or session revocation on the first click. Session revocation is one control per person and says it revokes every session, not the row alone.
- The organization profile form keeps typed changes when a later load of the same screen arrives. A successful save still accepts the reloaded profile.

### P2

- Screens that use `Page` now set the browser title to the screen name. Sign-in and the invitation page set their own titles.
- Core Console keeps its separate operator shell. Visible keyboard focus was added in `frontend/src/core/core.css`. It was not added to customer navigation.

## Checks

| Check | Result |
|---|---|
| Frontend `vitest` | 233 passed, 33 files, after the confirmation and profile-form fixes. This later finance pass re-ran `FinancePage.test.tsx` and `EmployeeSetupWizard.test.tsx`: 27 passed. The full suite was not re-run. |
| `tsc -b` and `vite build` | Passed on 24 October 2026 after the collections and statement changes. The production bundle is about 937 kB before gzip. |
| oxlint on the edited screens | Passed in the earlier audit. Not re-run for the collections pass. |
| `oxlint src` | Passed, with existing warnings in onboarding only. Not re-run for the collections pass. |
| Signed-in browser, earlier in this session | `/overview` showed Dashboard. Sidebar links were `/overview`, `/people`, `/organization`, `/workforce/employees`, `/settings/organization`. `/people` rendered Members. `/payroll` moved to `/payroll/runs`. `/payroll/employees` loaded. |
| Signed-out browser | The IDE browser session had no token, so payroll, finance, and onboarding could not be clicked through as an administrator after that. Direct `/login` rendered the sign-in form. |
| Nginx | `/app` returns 302 to `/overview`. `/app/organization/members?role=admin` returns 302 to `/people?role=admin`. `/app/payroll/pay-runs?run=RUN-1` returns 302 to `/payroll/runs?run=RUN-1`. `/overview`, `/people`, `/payroll`, `/login`, and `/onboarding` return the application HTML. `POST /api/core/auth/login` reaches the API. |

## Not claimed

- The IDE browser is signed out. Payroll enrollment, calculation, finalization, ledger, and payslips were not clicked through against a live organization. No pay run was created or finalized.
- The collections, statement, and overview changes were exercised in component tests. They were not clicked through in a signed-in browser. The frontend container that is currently serving port 9000 was started before this source change.
- Core Console was not opened with an operator session. Organizations, users, product access, and audit were reviewed from the existing `/core` routes and tests.
- Password reset, open registration, leave, attendance, bank payment, and statutory calculation of professional tax, labour welfare fund, and income tax are absent from the backend and were not added. Finance GST display is the existing seller-region rule. It is not a statutory GST filing claim.
- These source fixes are not in the published frontend image until that image is rebuilt.

## Next work

1. Sign in with an authorized administrator and walk payroll from enrollment through a real calculation, including a validation failure, before any finalization.
2. Sign in to a workspace with Finance and walk a draft invoice through issue and a recorded payment.
3. Sign in as a Core operator and walk organizations, product access, sessions, and audit.
4. Rebuild the frontend image after those walks so the confirmation copy is what the browser serves.
