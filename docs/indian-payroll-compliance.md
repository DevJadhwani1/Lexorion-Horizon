# Indian payroll compliance in Horizon: what is supported and what is not

Status as of 22 October 2026. Read this before relying on any statutory figure Horizon shows.

Horizon **records** statutory details and **estimates** EPF and ESI. It does **not** calculate statutory
deductions into pay runs, file returns, or produce statutory registers. Every rate in Horizon carries a
source and the review status `REQUIRES_EMPLOYER_REVIEW`. An employer or their payroll adviser must confirm it
before relying on it.

## Data model

| Concern | Where | Notes |
|---|---|---|
| Statutory rules (rates, ceilings) | `payroll_statutory_rule_versions` (migration V8) | Effective-dated rows shared by all tenants and changed by migration only. Each row stores `source_reference`, `source_url` and `review_status`. A new rate is a new row with its own `effective_from`; existing rows are never edited in place. |
| Employee elections and identifiers | `payroll_statutory_profiles` (V8) | One row per payroll employee, created on first save. Holds payment method and bank details, PAN and tax regime, and EPF/ESI/PT/LWF applicability with UAN, ESI IP number and states. Each identifier has its own verified flag. |
| Employer policy | Pay components and salary profiles (existing) | Allowances, deductions and employer contributions are the employer's own components. A component can now be an **employer contribution**, which never affects gross, deductions or net pay. |
| Enrollment | `payroll_employees.pay_group`, `work_state`, `work_location` (V8) | All optional. |

Statutory rules, employee elections and employer policy live in separate places, so a rate change never
rewrites an employee's elections or salary.

## Implemented

### EPF (estimate only)
- Applies only when the employer marks EPF as *Applies* for the employee. Horizon never assumes coverage.
- PF wages are basic pay plus DA, plus any amount by which other allowances exceed 50% of total pay
  (the "wages" definition in the Code on Social Security, 2020). The estimate states when this rule added
  allowances.
- Employee share: 12% of PF wages, capped at the wage ceiling unless the joint higher-wages option is
  recorded. Rounded to the nearest rupee.
- Employer share: 12%, split into EPS (8.33% of wages up to the pension ceiling) and the EPF remainder.
- Rule versions:
  - 1 Sep 2014 to 16 Sep 2026: ceiling ₹15,000, so EPS is at most ₹1,250.
  - From 17 Sep 2026: ceiling ₹25,000, so EPS is at most ₹2,083. Source: Gazette notification
    S.O. 5109(E) dated 17 Sep 2026, reported in PIB releases 2313829 and 2314111.
- The estimate warns about the EPS eligibility of members who joined after 1 Sep 2014 with wages above the
  ceiling, and that EDLI and administration charges are not estimated.

### ESI (estimate only)
- Applies only when marked *Applies*.
- Employee share 0.75% and employer share 3.25% of gross wages (rates in force from 1 Jul 2019), each
  rounded **up** to the next rupee.
- Above the ₹21,000 coverage ceiling the result is *Above ceiling* with no amount. The estimate notes that
  an employee already covered stays covered until the end of the contribution period.
- The employee-share exemption for low daily wages is flagged but not computed.

### PAN and tax regime
- PAN format is validated (`AAAAA9999A`) and duplicates within a workspace are rejected.
- The regime is recorded as New, Old or Not declared.

### Employer contributions in pay runs
- New component category `EMPLOYER_CONTRIBUTION`, either a fixed amount or a percentage of gross.
- Calculated alongside the other lines, stored on the calculation (`employer_contribution_amount`), the
  pay-run employee snapshot and the pay-run total.
- Shown on payslips as a separate section.
- Excluded from gross, deductions and net pay, so it can never be deducted twice.
- **Not posted to the payroll ledger.** The ledger records the employee's earnings, deductions and net pay,
  which must net to zero per employee, and an employer cost would break that balance. Employer
  contributions are available from calculations, pay runs and payslips. Ledger posting needs a separate
  employer-liability account design.

## Not implemented (remaining gaps)

| Area | Gap |
|---|---|
| **TDS / income-tax** | Not calculated. The Income-tax Act, 2025 applies from 1 April 2026. TDS needs annual projection, regime-specific slabs, the standard deduction, declarations and proofs, perquisites and Form 16/24Q, none of which is modelled. Only PAN and regime are recorded. |
| **Professional tax** | Not calculated. Slabs, exemptions and due months differ by state, and some states levy none. Only applicability and state are recorded. |
| **Labour welfare fund** | Not calculated. Rates and periodicity differ by state. Only applicability and state are recorded. |
| **EPF in pay runs** | The estimate is advisory and not added to salaries. To pay it, add a deduction (employee share) and an employer-contribution component. EDLI (0.5%), administration charges and arrears handling are not covered. ECR files are not produced. |
| **ESI in pay runs** | Same as EPF. Contribution-period continuation, the daily-wage exemption and return files are not covered. |
| **Bonus, gratuity, leave encashment** | Not covered. |
| **Statutory registers, challans, returns, year-end** | Not covered. This includes Form 16, 24Q, ECR, ESI returns and PT returns. |
| **Pro-rating / LOP** | Partial periods are not pro-rated, so statutory amounts for partial months are not adjusted. |
| **Encryption at rest** | Bank account numbers, PAN, UAN and ESI IP numbers are write-only in the API, returned masked (last four characters) and restricted to workspace admins. They are not encrypted at the column level; protection relies on database access controls and disk encryption. Field-level encryption or tokenisation is recommended before production use with real employee data. |
| **Identity verification** | "Verified" flags are admin attestations. Horizon does not call the PAN, EPFO, ESIC or bank verification services. |

## Sources

Official sites could not be fetched from the build environment, so these values were taken from official
publications as cited in search results and must be re-checked against the originals:

- EPF Scheme, 1952 and wage ceiling ₹15,000 from 1 Sep 2014: Ministry of Labour & Employment,
  https://www.labour.gov.in/
- EPF wage ceiling ₹25,000 from 17 Sep 2026: S.O. 5109(E), Gazette of India, 17 Sep 2026, reported in
  PIB releases https://www.pib.gov.in/PressReleasePage.aspx?PRID=2313829 and PRID=2314111
- ESI contribution rates (0.75% / 3.25% from 1 Jul 2019) and coverage ceiling ₹21,000:
  ESIC, https://esic.gov.in/contribution
- Income-tax Act, 2025 (effective 1 Apr 2026): Income Tax Department, https://www.incometax.gov.in/

## Changing a rate

Add a Flyway migration that:
1. ends the current row (`effective_to`); and
2. inserts a new row with the new values, a source reference, the official URL and
   `review_status = 'REQUIRES_EMPLOYER_REVIEW'`.

Never edit historical rows. Estimates for earlier dates must keep using the rates that applied then.
