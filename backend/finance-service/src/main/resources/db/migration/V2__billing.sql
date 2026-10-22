-- Finance billing workspace: clients, invoices with line items, and received payments.
-- Workspace keys are tenant-local; the Platform workspace id is the identity.

CREATE TABLE finance_workspaces (
  id uuid PRIMARY KEY,
  workspace_key varchar(63) NOT NULL,
  next_invoice_number bigint NOT NULL DEFAULT 1 CHECK(next_invoice_number >= 1),
  next_receipt_number bigint NOT NULL DEFAULT 1 CHECK(next_receipt_number >= 1),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE finance_clients (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  client_key varchar(63) NOT NULL,
  display_name varchar(160) NOT NULL,
  email varchar(254),
  phone varchar(32),
  billing_address varchar(500),
  tax_id varchar(32),
  currency varchar(3) NOT NULL,
  payment_terms_days integer NOT NULL CHECK(payment_terms_days BETWEEN 0 AND 365),
  status varchar(16) NOT NULL CHECK(status IN ('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_finance_client_workspace_key UNIQUE(workspace_id, client_key)
);

CREATE TABLE finance_invoices (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  invoice_number varchar(32) NOT NULL,
  client_id uuid NOT NULL REFERENCES finance_clients(id),
  status varchar(16) NOT NULL CHECK(status IN ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','VOID')),
  currency varchar(3) NOT NULL,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  notes varchar(2000),
  subtotal numeric(19,2) NOT NULL CHECK(subtotal >= 0),
  tax_total numeric(19,2) NOT NULL CHECK(tax_total >= 0),
  total numeric(19,2) NOT NULL CHECK(total >= 0),
  amount_paid numeric(19,2) NOT NULL CHECK(amount_paid >= 0),
  issued_at timestamptz,
  voided_at timestamptz,
  void_reason varchar(300),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_finance_invoice_workspace_number UNIQUE(workspace_id, invoice_number),
  CONSTRAINT finance_invoices_dates_check CHECK(due_date >= issue_date),
  CONSTRAINT finance_invoices_paid_check CHECK(amount_paid <= total)
);
CREATE INDEX idx_finance_invoice_workspace_status ON finance_invoices(workspace_id, status);
CREATE INDEX idx_finance_invoice_client ON finance_invoices(client_id);

CREATE TABLE finance_invoice_lines (
  id uuid PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES finance_invoices(id),
  line_number integer NOT NULL CHECK(line_number >= 1),
  description varchar(300) NOT NULL,
  quantity numeric(19,4) NOT NULL CHECK(quantity > 0),
  unit_price numeric(19,2) NOT NULL CHECK(unit_price >= 0),
  tax_rate numeric(7,4) NOT NULL CHECK(tax_rate BETWEEN 0 AND 100),
  line_subtotal numeric(19,2) NOT NULL,
  tax_amount numeric(19,2) NOT NULL,
  line_total numeric(19,2) NOT NULL,
  CONSTRAINT uk_finance_invoice_line_number UNIQUE(invoice_id, line_number)
);

CREATE TABLE finance_payments (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  invoice_id uuid NOT NULL REFERENCES finance_invoices(id),
  receipt_number varchar(32) NOT NULL,
  amount numeric(19,2) NOT NULL CHECK(amount > 0),
  currency varchar(3) NOT NULL,
  payment_date date NOT NULL,
  method varchar(16) NOT NULL CHECK(method IN ('BANK_TRANSFER','UPI','CARD','CASH','CHEQUE','OTHER')),
  reference varchar(64),
  notes varchar(500),
  created_at timestamptz NOT NULL,
  CONSTRAINT uk_finance_payment_workspace_receipt UNIQUE(workspace_id, receipt_number)
);
CREATE INDEX idx_finance_payment_invoice ON finance_payments(invoice_id);
CREATE INDEX idx_finance_payment_workspace_date ON finance_payments(workspace_id, payment_date);
