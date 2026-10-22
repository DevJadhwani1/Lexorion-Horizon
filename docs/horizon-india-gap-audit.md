# Horizon India gap audit — flows, compliance and UI/UX

Date: 22 October 2026. Method: the full stack (Platform, Workforce, Payroll, Finance, Gateway, Eureka,
PostgreSQL 16) was run locally from this branch and every admin flow was walked in Chromium at 1440 px and
390 px: login → organization setup → workspace → add employee wizard → payroll setup → salary → pay runs,
plus every sidebar page. Benchmarks: Keka, greytHR, Zoho Payroll (India) and RazorpayX Payroll, from their
public product and help pages.

Priority: **P0** blocks India-compliant payroll · **P1** significant friction in an existing flow ·
**P2** polish. "Fixed" marks items addressed on branch `claude/brave-cori-gk3lz4`.

## 1. What the Indian competitors all do

Every benchmark product runs the same monthly cycle:

1. **Payroll inputs:** attendance/LOP days, new joiners and exits, arrears, bonuses, reimbursements.
2. **Statutory calculation:** EPF (employee and employer, EPS/EDLI split), ESI, Professional Tax by work
   state, LWF, and TDS from the employee's regime and declarations.
3. **Review and approve** → **pay** (bank transfer file or direct deposit) → **payslips** (email/portal).
4. **Filings:** PF ECR, ESI return, PT challans, Form 24Q, Form 16 and 12BA.
5. **Employee self-service:** payslips, investment declarations with proofs, Form 16 download.

Salaries are entered as **annual CTC** and split into Basic, HRA, Special allowance and employer PF, with
standard Indian components available from day one.

## 2. India compliance gaps (backend + flow)

| # | Pri | Problem | Evidence |
|---|---|---|---|
| C1 | P0 | **Statutory deductions are not calculated in pay runs.** EPF and ESI are *estimates* shown on the employee; PT, LWF and TDS are recorded only. Net pay is therefore wrong for almost every Indian employee. | `docs/indian-payroll-compliance.md`; payroll setup step text "does not calculate…" |
| C2 | P0 | **No employer statutory registration.** The organization has no PAN, TAN, GSTIN, CIN, PF establishment code, ESIC employer code or PT registration per state. Every filing needs these. | Organization profile form; `organizations` table |
| C3 | P0 | **No attendance, leave or LOP input,** and partial periods are not pro-rated. Mid-month joiners, exits and unpaid leave cannot be paid correctly. | Salary step: "partial periods are not pro-rated"; no attendance tables |
| C4 | P0 | **Employee record lacks statutory identity fields:** date of birth, gender, father's/spouse's name, date of exit. EPF ECR and ESI registration require them. | `Employee.java`; add-employee step 1 |
| C5 | P1 | No TDS engine (new/old regime slabs, standard deduction, 87A rebate, cess) and no investment declarations or proofs. | `TaxRegime` is recorded only |
| C6 | P1 | No statutory outputs: PF ECR text file, ESI contribution file, PT challan summary, Form 24Q, Form 16/12BA. | — |
| C7 | P1 | No bank transfer advice file (or payment status) after finalization. | Pay-run lifecycle ends at FINALIZED |
| C8 | P1 | No full-and-final settlement (leave encashment, gratuity, notice recovery) or arrears on salary revision. | — |
| C9 | P1 | Payslips are not PDFs, not emailed, have no YTD totals and no employer statutory identifiers. | Payslips page |
| C10 | P1 | No employee self-service portal for payslips and declarations (the routes `/workforce/me` and `/workforce/team` exist but there are no payroll documents). | Router |
| C11 | P2 | Finance invoices use one tax rate per line: no CGST/SGST/IGST split by place of supply, no HSN/SAC, no GSTIN validation. | `finance_invoice_lines.tax_rate` |

## 3. UI/UX gaps inside the existing flows

### Organization setup

| # | Pri | Problem | Status |
|---|---|---|---|
| U1 | P1 | A new organization defaults to **United States · USD · UTC · YYYY-MM-DD · en-US**, even with a +91 phone, and onboarding marks "Organization details" complete without touching them. Indian customers then get USD defaults in payroll. | Fixed: choosing a country fills its currency, time zone, date format and locale while they are still untouched; onboarding asks for regional confirmation |
| U2 | P1 | Language/Locale is a free-text BCP 47 box (`en-US`). Indian number grouping (₹12,34,567) depends on `en-IN`. | Fixed: locale picker |
| U3 | P2 | Labels for *Website*, *Language / Locale* and *Branding Display Name* render centred, not left-aligned (a flex label inheriting `flex-direction: column`). | Fixed (CSS) |
| U4 | P1 | Registered address *State* is free text even when the country is India; payroll uses ISO state codes. | Fixed: Indian state picker when country is India |
| U5 | P2 | Phone placeholder is a US number (`555 123 4567`) beside +91. | Fixed: country-specific placeholder |
| U6 | P2 | Setup progress is shown three times on one screen (top bar, progress card, step tiles). | Open |
| U7 | P1 | After creating the workspace, onboarding disappears and the remaining steps (*Access & members*, *Review and finish*) are never shown. The user lands on a different, seven-step checklist. Two checklists describe the same setup. | Open |
| U8 | P2 | Workspace modal: icons sit on their own line above their labels (its CSS classes were never defined), and the "workspace key" hint is jargon. The key is already derived from the name. | Fixed: styles added, plain-language hint. Not re-checked in a browser, because the test organization already had its workspace |

### People and payroll setup

| # | Pri | Problem | Status |
|---|---|---|---|
| U9 | P1 | Payroll currency is a free-text box (it showed `USD` for an Indian organization). | Fixed: currency picker |
| U10 | P1 | A new workspace has **no salary components**. The salary step and the Salary components page are empty, and the create form is hidden in a collapsed accordion. | Fixed: one-click "Add standard Indian components" (Basic, HRA, Special allowance, Conveyance, Employer PF) in both places |
| U11 | P1 | Salary must be built component by component; there is no annual CTC entry with an automatic split. | Fixed: "Build from annual CTC" in the salary builder |
| U12 | P2 | Salary components table shows an internal *KEY* column first and has no empty state. | Fixed: name first with the key beneath it; empty state |
| U13 | P2 | Required fields in the add-employee wizard are not marked. | Open |

### Overview and navigation

| # | Pri | Problem | Status |
|---|---|---|---|
| U14 | P1 | Overview restates the context three times (welcome chips, three context tiles, top-bar switchers) before any action; it mixes 7 tiles, an action list, a next-action card, a 7-step checklist and shortcuts. It contains engineering copy ("Configuration counts are not a pay-period approval…"). | Partly fixed: duplicate context tiles and engineering copy removed |
| U15 | P1 | On a phone the workspace switcher runs off the right edge of the top bar. | Fixed |
| U16 | P2 | Nine payroll sidebar items include engineering views (*Payroll ledger*, *Pay preview*) beside daily tasks. *Compensation* and *Payslips* are "choose an employee" pages that duplicate the employee profile. | Open |
| U17 | P2 | No statutory settings page, so there is nowhere to put C2. | Open (needs C2) |

## 4. Recommended order

1. **This branch:** U1–U5, U8–U12, U14 (partly), U15. These are frontend-only fixes; no schema change.
2. **Next (backend, P0):** C2 employer registrations → C4 employee statutory fields → C1 EPF/ESI/PT
   deductions as calculation lines with effective-dated, source-cited rules (the pattern already used for
   EPF/ESI estimates) → C3 LOP days and pro-ration per pay-run employee.
3. **Then:** C5 TDS and declarations → C6 ECR/ESI/PT outputs → C7 bank advice → C9 payslip PDF/email →
   C10 employee portal → C8 F&F and arrears.
4. **Later, outside India:** make statutory rules and identifiers country-pluggable (country on each rule
   version and profile) and add GST/VAT per country to Finance.

## Sources

- Keka payroll features: https://www.keka.com/payroll-software-features
- greytHR admin help (LOP, revisions, final settlement): https://www.greythr.com/greythr-help/admin/
- Zoho Payroll India: https://www.zoho.com/in/payroll/payroll-software-for-enterprises/
- RazorpayX Payroll: https://razorpay.com/payroll/payroll-processing/
