# Finance implementation status

Status of the Horizon Finance work grounded in the seventeen issued OmegaHires PDFs in Documents. Those bills are loaded in organization `OMEGAHIRES`, workspace `omegahires`.

## Completed

- Receipts, allocations, reversal rows, idempotency, and ledger postings. Existing payments migrate to one full allocation. The invoice payment shortcut remains.
- One receivables calculation: debit-positive, invoice date for invoices, receipt date for collections, unallocated receipts kept out of invoice balances and out of the ledger until allocated.
- Monthly and financial-year reports use that basis. Aging buckets are unchanged: not yet due, 1–30, 31–60, 61–90, over 90.
- Overview, collections, client statement, CSV, and the existing invoice and template flows. Displayed totals come from the API. A failed request shows the error.
- `CONSULTANT` on the workforce enum, the employee-form label, and workforce migration V4.
- `scripts/import_omegahires.py` and `scripts/fixtures/omegahires.json`. The script uses Horizon APIs, reads credentials from the environment, and sends the organization slug. If `OMEGAHIRES` already exists it continues only while `OH/26-27/0001` is absent. Once that invoice exists, a later run stops before creating more clients, invoices, or employees.
- Discovery, domain, and this status note.

## Loaded

- Organization `OMEGAHIRES` / slug `omegahires`, owner `admin@omegahires.com`, membership role `ADMIN`. Temporary platform access used to create the organization was removed afterward. A later call to list every platform organization returns 403 for this user.
- Workspace `omegahires` with finance, workforce, and payroll.
- 3 clients (Mastek, Refex, VEENA CORP), 2 items (`REC-001`, `SER-001`), 17 issued unpaid invoices. API totals match the fixture. Grand total ₹61,49,896.94. Receipts: 0.
- 8 workforce employees: `OH-ADMIN` plus seven consultants. Each has a payroll profile with a placeholder monthly basic of ₹10,000.00. That amount is not the invoice fee.
- Finance is at Flyway v7 on the live database. Workforce is at v5, including `4 - consultant employment type`.

## Not completed

- The signed-in browser was already in the Lexorion workspace, on the add-employee form. That session was left in place, so the OmegaHires screens were checked through the API rather than by signing that browser in as `admin@omegahires.com`.
- Credit notes, recurring billing, discounts, e-invoicing, and a new general ledger were left out on purpose.

## Verification that actually ran

| Command | Result |
|---|---|
| `mvn -Dtest=LedgerIntegrationTest,BillingIntegrationTest,InvoiceTemplateIntegrationTest,ItemRegistryIntegrationTest test` in finance-service | Passed. Exit 0. An earlier run failed one assertion (`400` vs `409` on a paid invoice, then the pre-reversal year balance). Those expectations were corrected to the service rules and the same four classes passed. |
| `mvn -Dtest=WorkforceSecurityIntegrationTest test` in workforce-service | Passed. Exit 0. The unknown-type message lists `CONSULTANT`. |
| `mvn -Dtest=PostgresMigrationTest test` in finance-service | Passed. Fresh PostgreSQL 16 applied V1 through V7, including `7 - receipt allocations`. |
| `mvn -Dtest=PostgresMigrationTest test` in workforce-service | Passed. After V1, the next migrate applied V2 through V5, including `4 - consultant employment type`. |
| `vitest` on `FinancePage.test.tsx` and `EmployeeSetupWizard.test.tsx` | 27 passed, 2 files. |
| `npm run build` (`tsc -b && vite build`) | Passed. Bundle about 937 kB before gzip. |
| `python3 scripts/import_omegahires.py` against `http://127.0.0.1:9001` | Exit 0. Printed 17 unpaid invoices, 3 clients, 8 employees, 0 receipts. A first attempt returned 400 because the organization header was a UUID. The script now sends the slug and completed the existing organization. |
| Read-back of `OH/26-27/0001`, `0002`, and `0011` | `0001` total 200839.07, CGST 15318.24 and SGST 15318.23, place of supply Maharashtra, status ISSUED, amount paid 0. `0002` total 60966.82, IGST 9300.02, place of supply Tamil Nadu. `0011` total 1856000.00, tax breakdown empty. |

## Invoice totals read back from Horizon

All seventeen are unpaid. Quantity is 1. Grand totals sum to ₹61,49,896.94.

| Invoice | Client | Taxable | Tax | Total | Horizon tax |
|---|---|---:|---:|---:|---|
| OH/26-27/0001 | Mastek | 1,70,202.60 | 30,636.47 | 2,00,839.07 | CGST 15,318.24 and SGST 15,318.23 |
| OH/26-27/0002 | Refex | 51,666.80 | 9,300.02 | 60,966.82 | IGST 9,300.02 |
| OH/26-27/0003 | Refex | 41,360.00 | 7,444.80 | 48,804.80 | IGST 7,444.80 |
| OH/26-27/0004 | Refex | 1,03,400.00 | 18,612.00 | 1,22,012.00 | IGST 18,612.00 |
| OH/26-27/0005 | Refex | 1,29,167.00 | 23,250.06 | 1,52,417.06 | IGST 23,250.06 |
| OH/26-27/0006 | Mastek | 1,18,407.84 | 21,313.41 | 1,39,721.25 | CGST 10,656.71 and SGST 10,656.70 |
| OH/26-27/0007 | Mastek | 2,68,890.06 | 48,400.21 | 3,17,290.27 | CGST 24,200.11 and SGST 24,200.10 |
| OH/26-27/0008 | Mastek | 1,21,774.50 | 21,919.41 | 1,43,693.91 | CGST 10,959.71 and SGST 10,959.70 |
| OH/26-27/0009 | Refex | 1,29,167.00 | 23,250.06 | 1,52,417.06 | IGST 23,250.06 |
| OH/26-27/0010 | Refex | 1,03,400.00 | 18,612.00 | 1,22,012.00 | IGST 18,612.00 |
| OH/26-27/0011 | VEENA | 18,56,000.00 | 0.00 | 18,56,000.00 | none |
| OH/26-27/0012 | VEENA | 21,81,000.00 | 0.00 | 21,81,000.00 | none |
| OH/26-27/0013 | Refex | 1,29,167.00 | 23,250.06 | 1,52,417.06 | IGST 23,250.06 |
| OH/26-27/0014 | Refex | 1,03,400.00 | 18,612.00 | 1,22,012.00 | IGST 18,612.00 |
| OH/26-27/0015 | Refex | 1,03,400.00 | 18,612.00 | 1,22,012.00 | IGST 18,612.00 |
| OH/26-27/0016 | Refex | 88,020.83 | 15,843.75 | 1,03,864.58 | IGST 15,843.75 |
| OH/26-27/0017 | Refex | 1,29,167.00 | 23,250.06 | 1,52,417.06 | IGST 23,250.06 |

## Source conflicts

- `0001`, `0006`, `0007`, and `0008` print CGST and SGST one paisa apart from Horizon’s half-up split. Grand totals match. The tax rule was not changed.
- `0011` and `0012` print IGST 0.00. Horizon returns no tax line when the tax is zero. Grand totals match.
- `0002` through `0005` print place of supply Maharashtra and an IGST line. The buyer GSTIN is Tamil Nadu. The fixture sends Tamil Nadu as the place of supply so the existing rule reproduces the IGST line.
- Seller GSTIN on `0001` through `0005` is `27AAECO6772G1ZF`. From `0006` onward the PDFs print `27AAECO6722G1ZF`. The importer sets the template identifier before each issue so the snapshot matches that PDF. Neither value was “corrected.”
- Every PDF note, including July through October, says the work was rendered in May 2026. The importer copies that note.
- `0003` is marked for Gautam S. The one Refex client uses Mugesh M, so the frozen bill-to contact is Mugesh M.
- Sakthivel’s later designation is IT Infra team lead. Mohamed’s later designation is T&M Offrole Employee. `0016` prints the joining date as the word “Date”; the employee joining date used is 2 October 2026.
- `0001` and `0006` signatory is stored as Shubham Arun Rai. The other bills use Narendra Kataria.
- `database_backup.json` was not imported. Payroll is not a statutory payroll run.

## Migration and manual steps

- Finance V7 adds `client_id`, allows a receipt without an invoice, backfills one allocation per existing payment, adds idempotency keys, and allows voucher type `ALLOCATION_REVERSAL`. Apply it by starting the updated finance service against PostgreSQL. H2 tests do not run Flyway.
- Workforce V4 rebuilds `employees_employment_type_check` to include `CONSULTANT`. Existing employment types stay valid.
- Finance, workforce, and the frontend containers were recreated from the current images. Finance applied V7 on the live database. Workforce validated five migrations, including the consultant type.
- `scripts/import_omegahires.py` was run with `HORIZON_API_BASE=http://127.0.0.1:9001` and `HORIZON_EMAIL=admin@omegahires.com`. The password is not in the fixture or in the script output.
- A later run stops once `OH/26-27/0001` exists. If the organization exists and that invoice does not, the script continues from settings, the workspace, and the invoices.
- Unallocated cash is not on the ledger until it is allocated. That is deliberate, so an unallocated receipt cannot reduce receivables. It also means bank and cash stay understated until allocation.
- The UI idempotency key is a new UUID per call. The server replay tests cover the same key. A timed-out browser retry can therefore create a second receipt if the first one committed.
