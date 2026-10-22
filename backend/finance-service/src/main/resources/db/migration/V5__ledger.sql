-- Books: an append-only double-entry ledger posted by issued invoices, receipts and voids, plus per-workspace
-- financial-year and books-lock settings. Entries are never updated or deleted; a void posts reversals.

ALTER TABLE finance_workspaces ADD COLUMN fiscal_year_start_month integer NOT NULL DEFAULT 4 CHECK(fiscal_year_start_month BETWEEN 1 AND 12);
ALTER TABLE finance_workspaces ADD COLUMN books_locked_until date;

CREATE TABLE finance_ledger_entries (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  entry_date date NOT NULL,
  voucher_type varchar(16) NOT NULL CHECK(voucher_type IN ('INVOICE','RECEIPT','INVOICE_VOID')),
  voucher_number varchar(32) NOT NULL,
  source_id uuid NOT NULL,
  invoice_id uuid NOT NULL REFERENCES finance_invoices(id),
  client_id uuid NOT NULL REFERENCES finance_clients(id),
  account varchar(24) NOT NULL CHECK(account IN ('RECEIVABLES','SALES','OUTPUT_CGST','OUTPUT_SGST','OUTPUT_IGST','OUTPUT_TAX','BANK','CASH')),
  debit numeric(19,2) NOT NULL CHECK(debit >= 0),
  credit numeric(19,2) NOT NULL CHECK(credit >= 0),
  currency varchar(3) NOT NULL,
  narration varchar(300) NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT finance_ledger_one_side CHECK((debit = 0) <> (credit = 0)),
  CONSTRAINT uk_finance_ledger_posting UNIQUE(workspace_id, voucher_type, source_id, account)
);
CREATE INDEX idx_finance_ledger_workspace_date ON finance_ledger_entries(workspace_id, entry_date);
CREATE INDEX idx_finance_ledger_client_date ON finance_ledger_entries(client_id, entry_date);
