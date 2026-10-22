# Horizon UX and flow evaluation — Zoho-style redesign

Evaluation date: 2026-10-22. Scope: current `frontend/` and `backend/` on this branch, rendered locally with Vite against mocked API responses (organization `Acme Industries`, workspace `main`, five employees, one draft and one finalized pay run). Benchmark: the Zoho People / Zoho Payroll admin experience, plus this repository's own target wireframes in `design/wireframes/` (Application Shell, People Workspace), which already describe a Zoho-like product.

This is an evaluation and plan. No application code is changed by this document.

## 1. Verdict

The backend is the stronger half. Tenant isolation, payroll period semantics, recovery, preparation and the immutable ledger are carefully built and well tested (see `horizon-flow-audit.md`). The **frontend exposes that engine as it is built rather than as an HR admin works**. It is organized by microservice (Workforce, then Payroll), identifies people by codes, asks users to type internal keys, and puts the explanation of payroll rules into on-page copy instead of encoding it in the flow.

Zoho's advantage is not features but **flow**: one employee record, one "Run payroll" button driven by a pay schedule, pickers instead of keys, and a review screen of names and amounts. Most of that is reachable without changing the payroll engine. A few small backend additions (pay schedule, employee summary, run-level payslips) unlock the rest.

## 2. What a Horizon admin does today vs. Zoho

| Task | Horizon today | Zoho Payroll / People |
|---|---|---|
| Add a payable employee | 1) Workforce → Employees → expand *Add employee*, type `departmentKey`, `designationKey`, `reportingManagerEmployeeCode` by hand. 2) Payroll → Employees → *Configure employee* again with the same code, currency (defaults to **USD**), frequency, date. 3) Payroll → Compensation → type the code → *Load employee* → expand *Create compensation profile*, type a `profileKey`. Three screens, three saves, one code typed three times. | One *Add Employee* wizard: Basic details → Salary details (annual CTC + template, auto-split into components) → Personal → Payment info. One record. |
| Run monthly payroll | Pay Runs → expand *Create pay run* → type a run key, period start, period end, calculation date, currency (USD default) → Create → Open → tick employees → Save selection → Process → Finalize. | Pay schedule set once in settings. Home shows "Process October payroll" → review table of employees and net pay → Submit & approve → Record payment → payslips go out. |
| See someone's payslip | Payroll → Payslips → type employee code → *Load employee*. No per-run payslip list. No PDF or email. | Pay run → Payslips tab for every employee; employee portal shows their own; PDF and email. |
| Find an employee | Scroll a table capped at 100 rows. No search, even though the API supports `search`, filters, sort and paging. | Global search and a filterable directory with saved views and bulk actions. |

## 3. Frontend findings

Severity: **H** = blocks a smooth core flow; **M** = significant friction; **L** = polish.

| # | Sev | Finding | Evidence |
|---|---|---|---|
| F1 | H | **Code-first, not people-first.** Payroll screens show `EMP-001` and never a name; Compensation, Calculations, Ledger and Payslips start with an empty "Employee code" box and a *Load employee* button. | `PayrollPage.tsx` `EmployeeDetail` (~L809); `PayrollEmployee` type has no name fields |
| F2 | H | **Employee is split by service.** Workforce employee, Payroll enrollment and compensation profile are three separate create flows on three pages. | `WorkforcePage.tsx` `EmployeeCreate`; `PayrollPage.tsx` `EmployeeForm`, `ProfileForm` |
| F3 | H | **Forms expose API field names and internal keys.** Labels render as `EmployeeCode`, `DepartmentKey`, `ReportingManagerEmployeeCode`; users must type keys (`engineering`) instead of picking from a list. Departments/designations ask for a "Stable key". | `WorkforcePage.tsx` ~L180–205, `References`; `PayrollPage.tsx` `input()` helper |
| F4 | H | **Pay run creation is manual.** Key, four dates and currency are typed by hand; currency defaults to `USD` while organization settings hold the real currency. The page description tells the user the period rules instead of the UI enforcing them. | `PayrollPage.tsx` `PayRuns` (~L1265); `input("currency", "USD")` at four call sites |
| F5 | M | **Navigation mirrors the architecture.** An admin sees 23 sidebar items across five groups, including engineering concepts (*Calculations*, *Ledger*, *Entitlements*, *Structure*) and self-service items (*My profile*, *My team*) mixed into admin groups. Two different "Dashboard" and two "Employees" entries. | `AppShell.tsx` nav arrays |
| F6 | M | **Workspace is a visible, always-on concept.** Every page has two native `<select>`s (organization, workspace) labelled e.g. "Main · Workforce, Payroll". Zoho exposes only the organization. For single-workspace customers (Starter plan: 1 workspace) this is pure overhead. | `AppShell.tsx` topbar |
| F7 | M | **Raw data formatting.** Pay run table shows `420000 INR` and `378000`; the overview shows `₹378,000.00`. ISO dates everywhere; department keys instead of names; enum casing (`ACTIVE`, `FINALIZED`). | `PayRuns` table; `WorkforcePage` employee table |
| F8 | M | **Create forms hidden in `<details>` accordions** on list pages instead of a primary button opening a drawer or page. No global *+ Create*. | All list pages |
| F9 | M | **Search and paging unused.** Employee list fetches `size=100` with no search/filter UI although `GET /api/workforce/employees` supports `search`, `status`, `departmentKey`, `designationKey`, `sort`, `direction`, `page`. | `WorkforcePage.tsx` load; `EmployeeController.list` |
| F10 | M | **Overview is a status report, not a launchpad.** Three context tiles (workspace/role/signed-in user) restate the header; long explanatory copy ("Configuration counts are not a pay-period approval…"). The one important card — next payroll action — is the third block. | `HomePage.tsx` |
| F11 | M | **Overview does N requests.** `getActiveWorkforceCodes` pages through *all* employees (100 per request) on every overview load to find one unconfigured code. Ten parallel calls plus that loop. | `HomePage.tsx` `getActiveWorkforceCodes` |
| F12 | L | **Engineering-facing status names.** `CALCULATED` / `FINALIZED` vs the Zoho mental model *Draft → Approved → Paid*. | `PayRunStatus.java` |
| F13 | L | **No design system in code.** `Page.tsx` is a minified one-liner; `Table` is imported from `AdminPage`; one 1,165-line `styles.css`; `PayrollPage.tsx` is 1,451 lines with nine screens. No data-fetching layer: each page hand-rolls `useEffect` + version counters. The `design/wireframes/Lexorion Design System` is not implemented. | `src/components/ui/*`, `src/styles.css` |

What is already good and should be kept: context-safe HTTP client (no cross-workspace replay), route-level role guards, return-to-workflow links, the preparation panel's eligible/blocked breakdown with per-employee reasons, failure recovery actions, collapsible sidebar with keyboard shortcut and focus trap.

## 4. Backend findings (as they affect flow)

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| B1 | H | **Payroll has no employee identity beyond `employeeCode`.** `PayrollEmployee`, `PayRunEmployee`, preparation rows, ledger and payslips carry no name, department or designation, so the UI cannot show people without one Workforce call per row. | Add a denormalized display snapshot (name, department, designation) to `payroll_employees`, refreshed when Payroll verifies the employee through the existing `WorkforceEmployeeClient`. Or add a read-only composition endpoint at the gateway/BFF level. The snapshot is simpler and fits the existing verification call. |
| B2 | H | **No pay schedule.** Each pay run asks the client for key, period, calculation date and currency. | Add `pay_schedule` on the Payroll workspace (frequency, pay day, first period start, currency from org settings). Add `POST /api/payroll/pay-runs/next`, which derives key (`2026-10`), period and dates using the existing `PayrollPeriod` rules. Keep the current create endpoint for off-cycle runs. |
| B3 | H | **Enrollment is a separate manual step.** | Add a single "hire" command that creates the Workforce employee, enrolls in Payroll and creates the first compensation profile. Implement it as a frontend orchestration over the existing three APIs first (no new service coupling), with clear partial-failure handling. Consider a Payroll-side auto-enroll on Workforce create later. |
| B4 | M | **Payslips are per employee only.** No run-level listing, no PDF, no email. | `GET /api/payroll/pay-runs/{key}/payslips`; server-rendered PDF; reuse the Platform SMTP delivery pattern (with Mailpit locally) for "Send payslips". |
| B5 | M | **No in-run adjustments.** One-time earnings and deductions must be configured on the profile before the run; there is no "skip this employee this month" or "add bonus" inside the run. | Pay-run-scoped adjustment lines, applied during processing and snapshotted like other lines. Fits the existing calculation-line model. |
| B6 | M | **Lifecycle stops at FINALIZED.** No approval step and no payment record. | Map UI labels first (Calculated → *Pending approval*, Finalized → *Approved*). Later add `PAID` with a payment date/reference, without touching ledger immutability. |
| B7 | M | **Unpaginated lists** for Payroll employees, components and templates. | Add `page/size/search` matching Workforce's contract before employee counts grow (Business plan allows 100). |
| B8 | L | **Readiness projection is coarse** (counts plus first unconfigured code), which forced F11. | Return `unconfiguredWorkforceCodes` count and paged list from Payroll, or let Overview read a single summary endpoint. |

Explicitly **out of scope** here, matching the boundaries in `horizon-flow-audit.md`: statutory components (PF/ESI/PT/TDS), leave/attendance/LOP, approvals inbox, recruitment, Finance. These are where Zoho's breadth lives, but they are product scope decisions, not flow fixes. The wireframes show them as future workspaces.

## 5. Target experience

### 5.1 Information architecture (admin)

```
Home                      ← launchpad: setup checklist until done, then "Run October payroll"
Employees                 ← one directory (search, filters, saved views); row → Employee 360
Pay runs                  ← list + "Run payroll"; run detail = review → approve → payslips
Reports                   ← payroll summary, ledger (moved out of the main nav)
Settings
  Organization profile · Users & roles · Invitations
  Departments · Designations
  Pay schedule · Salary components · Salary templates
  Workspaces · Plan & usage
```

23 items become 5 top-level entries. *Calculations* becomes a "Preview pay" action inside an employee's Salary tab. Employees (`EMPLOYEE` role) get a separate, minimal portal: *My profile*, *My payslips*, *My team* (managers).

Shell: organization switcher in the account menu (most users have one). Workspace switcher shown **only** when more than one accessible workspace exists. Add global search (⌘K) over employees and pages, plus a *+ New* menu (Employee, Pay run, Invite user). Both already appear in the `Application Shell` wireframe.

### 5.2 Core flows

1. **First-run setup (checklist on Home).** Organization profile → Pay schedule → Salary components (offer seeded defaults: Basic, HRA, Special allowance) → Add employees → Run first payroll. Show a progress bar; each step deep-links and returns to Home on save. Replaces the current setup list and attention list.
2. **Add employee wizard.** Step 1 Basic (name, email, joining date, department/designation/manager as searchable pickers, employee code auto-suggested). Step 2 Salary (frequency, effective date, template or components, live monthly/annual breakdown via the existing calculation preview). Step 3 Review → *Save*. This orchestrates the existing Workforce create, Payroll enroll and compensation create calls.
3. **Employee 360.** Header: avatar, name, designation · department, status, actions (Edit, Change status, Invite to portal). Tabs: Overview · Salary (current profile, history, *Preview pay*) · Payslips · Activity (lifecycle history).
4. **Run payroll.** Home card or *Pay runs → Run payroll* calls `pay-runs/next` with no form. The run page is one screen with a stepper (*Review → Approve → Payslips*): summary tiles (employees, gross, deductions, net), an employee table with **names**, gross, deductions and net, and inline *Skip* / *Adjust*. Blocked employees sit at the top with a one-click fix that opens a drawer, not a page navigation. The existing preparation, process and finalize endpoints back these steps unchanged.
5. **Payslips.** Run-level payslip tab with *Download all* / *Send to employees*; the employee portal lists their own.

### 5.3 Visual system

Adopt the tokens in `design/wireframes/Lexorion Design System` as CSS variables, and build a small component set: `DataTable` (search, filters, paging, empty/loading/error states), `Drawer`, `Wizard`, `EntityPicker`, `Money`, `DateText`, `StatusPill` (human labels), `PageHeader` with primary action. Format money with `Intl.NumberFormat` in the org's locale and currency; dates as `22 Oct 2026`.

## 6. Delivery plan

Each phase ships independently and keeps the existing test suites green.

| Phase | Scope | Backend change | Size |
|---|---|---|---|
| **0 — Quick wins** | Human labels on all forms; `Money`/`DateText`/`StatusPill`; currency defaults from org settings; department/designation/manager pickers; employee search and paging using existing API params; hide workspace selector when only one; employee-code picker (combobox over `getPayrollEmployees`) replacing *Load employee*. | None | ~3–4 days |
| **1 — Shell and IA** | New 5-item nav and Settings hub; employee portal nav; ⌘K search; *+ New* menu; Home as launchpad with setup checklist; split `PayrollPage.tsx` into per-screen modules; introduce a data-fetching hook (e.g. TanStack Query) to replace hand-rolled load/version logic. | None | ~1 week |
| **2 — People-first payroll** | Names everywhere in Payroll; Employee 360 with Salary/Payslips tabs; Add employee wizard. | B1 (display snapshot), B7 (paging) | ~1–1.5 weeks |
| **3 — Run payroll** | Pay schedule settings; one-click *Run payroll*; single-screen review with stepper; in-run skip; human status labels. | B2 (pay schedule + `next`), B6 (label map) | ~1.5 weeks |
| **4 — Payslips and adjustments** | Run-level payslips, PDF, email; in-run adjustments. | B4, B5 | ~1.5–2 weeks |

Sequencing rationale: Phases 0–1 are frontend-only and remove most of the friction visible in screenshots. Phase 2's B1 is the single backend change with the largest UX payoff, because without names a Zoho-like review table is impossible. Phase 3 depends on the pay schedule. Phase 4 is additive.

## 7. Decisions needed from the product owner

1. **Status vocabulary.** Should the UI rename *Calculated/Finalized* to *Pending approval/Approved*, and is a *Paid* state with payment reference wanted (B6)?
2. **Workspace exposure.** Hide the workspace concept for single-workspace organizations, as proposed, or keep it visible for all?
3. **Hire orchestration.** Do it in the frontend first (proposed), or as a backend command from day one?
4. **Statutory/India payroll.** Out of scope for this redesign, or the next product slice after Phase 4?
5. **Wireframes as source of truth.** Should `design/wireframes/` (Application Shell, People Workspace, Design System) be treated as the target for visual design?
