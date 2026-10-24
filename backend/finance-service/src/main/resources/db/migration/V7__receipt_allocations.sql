-- A receipt belongs to a client. Applying it to invoices is a separate allocation, so one receipt can
-- cover several invoices or stay partly unallocated. Existing payments were fully applied to one invoice.

ALTER TABLE finance_payments ADD COLUMN client_id uuid;
UPDATE finance_payments AS payment
   SET client_id = invoice.client_id
  FROM finance_invoices AS invoice
 WHERE invoice.id = payment.invoice_id;
ALTER TABLE finance_payments ALTER COLUMN client_id SET NOT NULL;
ALTER TABLE finance_payments ADD CONSTRAINT fk_finance_payment_client FOREIGN KEY (client_id) REFERENCES finance_clients(id);
ALTER TABLE finance_payments ALTER COLUMN invoice_id DROP NOT NULL;
CREATE INDEX idx_finance_payment_client ON finance_payments(client_id);

CREATE TABLE finance_allocations (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  receipt_id uuid NOT NULL REFERENCES finance_payments(id),
  invoice_id uuid NOT NULL REFERENCES finance_invoices(id),
  amount numeric(19,2) NOT NULL CHECK (amount > 0),
  reversed_at timestamptz,
  created_at timestamptz NOT NULL
);
CREATE INDEX idx_finance_allocation_receipt ON finance_allocations(receipt_id);
CREATE INDEX idx_finance_allocation_invoice ON finance_allocations(invoice_id);

INSERT INTO finance_allocations (id, workspace_id, receipt_id, invoice_id, amount, created_at)
SELECT gen_random_uuid(), workspace_id, id, invoice_id, amount, created_at
  FROM finance_payments
 WHERE invoice_id IS NOT NULL;

CREATE TABLE finance_idempotency_keys (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  operation varchar(40) NOT NULL,
  idempotency_key varchar(80) NOT NULL,
  resource_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT uk_finance_idempotency UNIQUE (workspace_id, operation, idempotency_key)
);

ALTER TABLE finance_ledger_entries DROP CONSTRAINT IF EXISTS finance_ledger_entries_voucher_type_check;
ALTER TABLE finance_ledger_entries ADD CONSTRAINT finance_ledger_entries_voucher_type_check
  CHECK (voucher_type IN ('INVOICE', 'RECEIPT', 'INVOICE_VOID', 'ALLOCATION_REVERSAL'));
