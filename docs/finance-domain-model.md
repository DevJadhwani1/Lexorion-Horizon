# Finance domain model

Receivables are debit-positive. An issued invoice increases what the client owes. An allocation decreases that invoice. An unallocated receipt is client credit and does not reduce any invoice balance. A receipt and its allocations are not both counted as collections.

The date basis, returned as `basis` on the year summary and the client statement, is:

> Invoiced amounts use the invoice date. Collections use the receipt date. Receivables are debit-positive: an issued invoice increases what the client owes and an allocation decreases it. An unallocated receipt is listed separately and does not reduce an invoice balance.

## Receipts and allocations

`finance_payments` is the receipt. `client_id` is required. `invoice_id` is optional and remains for the historical one-invoice shortcut. `finance_allocations` applies part of a receipt to one invoice. Reversal sets `reversed_at` on that row. Rows are not deleted.

V7 backfills `client_id` from the invoice and inserts one full allocation for every existing payment that still points at an invoice. A payment with no invoice cannot pass the new `client_id` constraint; the previous schema required `invoice_id`, so existing rows have one.

Rules enforced by `ReceiptService`:

- The receipt date is not in the future, is not before the invoice issue date, and is in an open book period.
- An allocation must use the same client and currency as the receipt.
- The amount cannot exceed the receipt’s remaining unallocated total or the invoice balance.
- Only `ISSUED` and `PARTIALLY_PAID` invoices accept an allocation. A paid invoice is a conflict. An amount past the open balance is a bad request.
- `amount_paid` is the sum of allocations that are not reversed. Status is `ISSUED` when that sum is zero, `PAID` when it equals the total, and `PARTIALLY_PAID` otherwise.
- Void is allowed only when `amount_paid` is zero and no active allocation exists.

`POST /api/finance/invoices/{reference}/payments` still records a receipt and allocates the full amount to that invoice. `POST /api/finance/receipts` records an unallocated receipt and does not post it. `POST /api/finance/receipts/{receiptNumber}/allocations` posts the allocation. `POST .../allocations/{allocationId}/reverse` adds the reversing ledger rows; it does not remove the original rows.

Idempotency keys are stored per workspace and operation (`ISSUE`, `RECEIPT`, `ALLOCATE`, `REVERSE_ALLOCATION`), maximum 80 characters. The same key returns the original resource. The Finance UI sends a new random key on each call, so a later retry is a new request. The buttons stay disabled while a request is in flight. Issuing a draft that is no longer a draft still conflicts.

## Ledger

New full payments post with the allocation id as the source, through `postAllocation`, not through a second receipt posting. `postAllocation` does nothing if that allocation is already posted, or if a historical whole-receipt posting for the payment id is still in force. After that receipt is reversed, a later allocation can post.

`postReversal` finds the receipt lines by allocation id, or by payment id for a historical posting, and writes the swapped sides dated today with voucher type `ALLOCATION_REVERSAL`. A prior financial year therefore stays as it was. The invoice’s current `amount_paid` changes immediately because it is calculated from active allocations, not from the year slice.

Unallocated receipts are not ledger postings. Cash and receivables are unchanged until an allocation exists. The statement lists unallocated receipts in the financial year separately, and those amounts are outside the closing receivable. The month summary counts `ALLOCATION_REVERSAL` as a reduction of collections. The sales register skips receipt and reversal vouchers so they are not extra invoices.

## Reports

Collected this month is the sum of active allocations whose receipt date falls in the month. Unallocated this month is receipt totals in the month minus that collected amount. Invoiced this month uses the invoice date.

Overview aging is the open balance of `ISSUED` and `PARTIALLY_PAID` invoices, bucketed by days past the due date as of today: not yet due, 1–30, 31–60, 61–90, over 90. The year summary’s aging uses the same buckets as of the earlier of today and the year end, and it skips invoices voided on or before that date. Balance there is the invoice total minus allocations whose receipt date is on or before that date and which were not reversed before the following day.

A failed overview, collections, or statement request renders the error. It does not substitute zeros. Zeros appear only when the API returns an empty successful total.

## Workforce

`CONSULTANT` is an employment type on the enum, on `employees_employment_type_check` in workforce V4, and on the employee form as “Consultant”. It does not create a finance client or an invoice by itself.
