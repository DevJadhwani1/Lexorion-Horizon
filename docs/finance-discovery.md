# Finance discovery

Checked against the finance service, its Flyway migrations through V7, and the customer Finance screens. This describes the code that is in the working tree. It is not a statutory GST opinion.

## What Horizon already had

Finance is a workspace product. Every row is stored under the platform workspace UUID. The browser sends `Authorization`, `X-Lexorion-Workspace`, and `X-Lexorion-Organization`. Finance asks Platform to resolve that workspace and role. A client-supplied organization or workspace id in a JSON body is not the tenant key.

The billing model already supported clients, draft invoices, issue, void, line items, invoice templates, and a payment recorded against one invoice. Issue assigns the number from the template pattern. The default financial year starts in April, so `OH/{FY}/{SEQ}` produces numbers such as `OH/26-27/0001`. Issued invoices keep their number, lines, totals, and template snapshot. Void is refused once any active allocation exists.

GST display is decided in `InvoiceService.taxBreakdown` and was left unchanged. When the template tax mode is GST and the seller region equals the invoice place of supply, the tax total is split into CGST and SGST by half-up division. Otherwise the same tax total is one IGST line. Line tax is `quantity * unit price`, half-up to cents, then that taxable amount times the rate, half-up to cents.

A double-entry ledger already posts `INVOICE`, `RECEIPT`, and `INVOICE_VOID` to receivables, sales, output tax, bank, and cash. Ledger rows are immutable. Books already expose a year summary, sales register, journal, settings, and a client statement. Aging buckets on the overview were already current, 1–30, 31–60, 61–90, and over 90.

## What OmegaHires is, as a source of bills

The source used here is the seventeen issued PDFs in Documents (`OH/26-27/0001` through `OH/26-27/0017`), not the OmegaHires Django application and not `database_backup.json`. That backup contains a draft `OH/26-27/0001` for a different buyer and total, and it disagrees with the issued PDF. The PDFs are unpaid: each balance due equals the grand total. There is no receipt to import.

The seller on every PDF is Omega Hires India Private Limited, GSTIN state code 27, Maharashtra. Buyers are MASTEK LIMITED (GSTIN state 27), Refex Shared Services Private Limited (GSTIN state 33, Tamil Nadu), and VEENA CORP (export, no GSTIN). Recruitment lines use item code `REC-001` at 18 percent. The two VEENA bills use `SER-001` at 0 percent. Named candidates are consultant employees. Horizon workforce and finance do not share a foreign key, so those people are stored as workforce employees whose department is the client name. Their payroll basic is a placeholder, not the invoice fee.

## Gaps this change closes

A payment used to require one invoice, so one receipt could not be split, left partly unallocated, or reversed without deleting the row. The ledger posted that payment as a single receipt. Collections on the overview were that payment total. The statement had no separate unallocated credit and no stated date basis.

The Finance navigation still said “Payments received” for the receipt list. A failed summary request could be confused with an empty workspace if the screen rendered zeros. Employment type did not include consultant.

## Explicitly not built

Credit notes, debit notes, refunds, write-offs, recurring invoices, retainers, discounts, e-invoicing, e-way bills, bank payment execution, and a second general ledger. Void remains the only cancellation, and only before any active allocation. The existing books ledger is the ledger.
