# Employee and payroll lifecycle audit

## 1. Executive summary

The signed-in lifecycle was exercised in the running app with a development-only identity. Directory filters, the synthetic employee profile, resignation, rehire, readiness gaps, and the empty own-payslip state were opened and captured. The served page is `index-Ct0pOGGn.js`.

`dev@lexorion.in` still cannot sign in. The account is active, uses the application password encoder, and belongs to the Lexorion workspace. The 401 is a password mismatch. The stored hash was not changed, and no public password reset was added.

Two journeys remain blocked. There is no finalized payslip, so detail and print preview were not opened. The first rehire click returned HTTP 500 and did not change the employee; the same request then succeeded.

## 2. Environment

| Item | Value |
| --- | --- |
| Time | 2026-10-24, about 23:12 Asia/Kolkata (17:42 UTC) |
| Commit | `71fc87001e3fbc1258fcff49d1682b4d7c995b50` on `main` |
| Working tree | Dirty. Lifecycle edits are uncommitted. Unrelated finance changes were not rebuilt. |
| Application URL | `http://127.0.0.1/` |
| Browser | Cursor embedded Chromium, Chrome/148.0.7778.280 |
| Desktop viewport | 838 × 845 |
| Mobile page size | 390 × 844 for the directory and profile captures |
| Signed-in identity | `qa-lifecycle@lexorion.test`, ADMIN, organization Lexorion (`lexorion-client`), workspace Main HR (`main-hr`) |
| Served frontend | `/assets/index-Ct0pOGGn.js` |

The earlier rebuild left workforce Flyway at V5 and payroll at V8. Postgres was not reset. At that time the database had 27 employees, 27 spells, 26 open spells, no double-open spell, and no null original joining date. The synthetic employee LEX-004 was added after that count.

The QA password is stored only in the gitignored local file `.qa-lifecycle-login`. The running platform container has the QA identity switch off and an empty password variable. Credentials are not in this folder.

## 3. Authentication diagnosis

`dev@lexorion.in` returns the same 401, "Email or password is invalid", that login uses for an unknown user, a wrong password, and an inactive account. The live row is ACTIVE. The stored algorithm is the delegating bcrypt encoder used by the application. The user is an active ADMIN member of `lexorion-client`. Login does not check the workspace, so the 401 is not a missing membership.

`ClientUserSeeder` runs only when the client seed is enabled. It creates a missing user through `UserService.create` and does not update a user that already exists. The seed is disabled, and no seed password is configured. `InitialPlatformAdminBootstrap` runs only on an empty identity store, so it cannot repair this account. There is no password-reset API. The existing hash was left as it was.

The local substitute is `LocalQaIdentityProvisioner`. It stays off unless `LEXORION_QA_IDENTITY_ENABLED=true` and `LEXORION_QA_IDENTITY_ACK=local-only`. It refuses a production environment and a production profile. The email must end in `@lexorion.test`. It creates a missing user with the application encoder and adds the ADMIN membership when that membership is missing. An existing user's hash is not replaced. The password is not written to the log.

## 4. Tested flows

| Flow | Result |
| --- | --- |
| Sign in as `dev@lexorion.in` | BLOCKED. 401. Hash unchanged. Screenshot `00` kept. |
| Sign in as the local QA identity | PASS. Dashboard for Lexorion / Main HR, role ADMIN. |
| Directory chips and search | PASS. All seven chips opened. Search survived Exited and Payroll not enrolled. |
| On leave and Contractors | PASS. Both are empty in this workspace. |
| LEX-004 profile and spell 1 | PASS. Original hire date 1 Oct 2026. |
| Resignation review and closed spell | PASS. Date and reason required. Activate was not offered after exit. |
| Rehire review and spell 2 | PASS after one HTTP 500. See defects. |
| Setup incomplete and compensation link | PASS. LEX-002 and LEX-003 are "Salary missing". Compensation was not saved. |
| Payroll not enrolled | PASS. LEX-004 only, with the search kept. |
| Own payslip empty state | PASS. `/workforce/me` is LEX-004 and shows the empty copy. |
| Payslip detail and print | BLOCKED. No finalized slip exists. |
| Signed-out API reads | PASS. Empty 403. |
| Signed-in foreign organization and workspace | PASS. Empty 403. |
| Live V5 backfill | PASS. Counts in the environment section. |
| Served bundle | PASS. `index-Ct0pOGGn.js`. |
| Mobile directory and profile | PASS at 390×844. Mobile payslip was not captured separately. |

LEX-001, LEX-002, and LEX-003 were not resigned, rehired, or given a new salary. No pay run was finalized.

LEX-004, after the successful rehire:

- Spell 1: Resigned, 1 Oct 2026 to 24 Oct 2026, reason "QA lifecycle audit resignation", not open.
- Spell 2: Active, started 24 Oct 2026, open.
- Original hire date remains 1 Oct 2026.
- Payroll enrollment was skipped.

## 5. Screenshot inventory

All files below are PNGs in `screenshots/`. The rejected-login capture was kept.

| File | What it shows |
| --- | --- |
| `00-sign-in-rejected.png` | Sign-in rejected for `dev@lexorion.in`. Password field masked. |
| `01-workforce-directory-all.png` | All employees, before LEX-004 existed. |
| `02-directory-active-filter.png` | Active chip. Terminated row hidden. |
| `03-directory-search-preserved.png` | Exited chip with search `LEX-002` still applied. |
| `04-directory-on-leave-empty.png` | On leave empty state. |
| `04-employee-profile-overview.png` | LEX-004 employment and payroll-not-set-up cards. |
| `05-employment-spell-history.png` | Spell 1 Active on the new profile. |
| `06-exit-review.png` | Resignation date and reason before confirmation. |
| `06b-exit-confirmation.png` | Confirmation that the spell closes and the code is kept. |
| `07-exited-employee-profile.png` | Closed Spell 1. Rehire is offered. Activate is not. |
| `08-rehire-review.png` | New spell form. Previous spells stay unchanged. |
| `08b-rehire-confirmation.png` | Confirmation that salary setup is not copied. |
| `09-rehired-employee-history.png` | Spell 1 closed and Spell 2 Active. |
| `10-payroll-readiness-gaps.png` | Setup incomplete for LEX-002 and LEX-003. |
| `11-missing-enrollment-action.png` | Payroll not enrolled, search still `LEX-004`. |
| `12-missing-salary-action.png` | Compensation for an existing employee. Not saved. |
| `13-directory-contractors-empty.png` | Contractors empty state. |
| `16-empty-payslips-state.png` | Own profile with no finalized payslip. |
| `17-mobile-directory.png` | Directory at a 390-wide page. |
| `18-mobile-employee-profile.png` | Profile cards stacked at a 390-wide page. |

The screenshot tool writes a 1676×1690 image. For the mobile captures the page `innerWidth` was 390 and the layout reflowed; the image canvas is wider than that page.

## 6. Defects and fixes

The first rehire submit from the confirmation dialog returned HTTP 500 with a 145-byte body at 17:34:05Z. The employee remained Resigned. The workforce log contains no exception for that request, and it was the first request after the workforce process had just become ready. Repeating the same joining date and employment type returned 200 at 17:35:22Z. The profile and the database both show one closed spell and one open spell.

That 500 was not reproduced on the warm service, and the response body was not retained, so no code change was made for it. No other in-scope UI defect was found. Automated suites from the earlier implementation pass were not rerun.

`GET /api/payroll/employees/LEX-004` returns 404 because enrollment was skipped. The profile already explains that payroll is not set up.

## 7. Security and identity mapping

Preserved signed-out results: login 401 for the wrong password, and empty 403 for the employee list, readiness, own payslips, a payslip path with a client employee code, and an admin payslip path.

Signed in:

- The QA user was linked to LEX-004. `/workforce/me` shows that employee and hides the admin status actions.
- `GET /api/payroll/me/payslips` and the same path with `employeeCode=LEX-001` both returned an empty list. No other employee's payslip content was rendered.
- `GET /api/payroll/employees/LEX-001/payslips` also returned an empty list, so this audit could not compare a populated foreign slip.
- A workforce employee read and an own-payslip read with a different organization and workspace returned an empty 403.
- A second employee identity, a MANAGER session, and an EMPLOYEE session were not created.

## 8. Automated tests

These results are from the implementation verification earlier in this work, before the QA identity provisioner. They were not repeated after the browser walk because no further product defect was fixed.

| Command | Directory | Result |
| --- | --- | --- |
| `mvn -q test` | `backend/workforce-service` | Exit 0, including the Postgres migration through V5. |
| `mvn -q test` | `backend/payroll-service` | Exit 0, including migrations V6–V8. |
| `./node_modules/.bin/vitest run --environment jsdom` | `frontend` | 33 files, 247 tests passed. |
| `npm run build` | `frontend` | Exit 0. Local `frontend/dist` is not the file nginx serves. |

`LocalQaIdentityProvisionerTest` was run on its own in `backend/platform-service` and exited 0. The full platform suite was not run.

## 9. Remaining blockers

1. `dev@lexorion.in` still has no known password. Its hash was not reset.
2. Payslip detail and print preview need a finalized slip. None exists for the signed-in employee, and one was not created.
3. Cross-employee payslip isolation was only checked against empty lists.
4. The first rehire request after workforce startup returned HTTP 500. The retry succeeded. The failure body was not captured.
5. Mobile layout of the payslip empty state was not captured separately.

## 10. Deployment status

The running site serves `index-Ct0pOGGn.js` from the Compose frontend image. That was confirmed from the signed-in page. A later local `npm run build` produced a different hash under `frontend/dist`; nginx does not mount that directory.

Evidence path: `artifacts/qa/employee-payroll-lifecycle/`.
