-- Invoice templates: every workspace (subscriber company) designs its own bill format.
-- Issued invoices keep a frozen copy of their template so later edits never change a sent bill.

CREATE TABLE finance_invoice_templates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  template_key varchar(63) NOT NULL,
  name varchar(120) NOT NULL,
  layout varchar(16) NOT NULL CHECK(layout IN ('MODERN','CLASSIC','MINIMAL')),
  is_default boolean NOT NULL DEFAULT false,
  status varchar(16) NOT NULL CHECK(status IN ('ACTIVE','ARCHIVED')),
  config text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_finance_template_workspace_key UNIQUE(workspace_id, template_key)
);
CREATE UNIQUE INDEX uk_finance_template_default ON finance_invoice_templates(workspace_id) WHERE is_default;

-- One counter per rendered number prefix, e.g. 'OH/26-27/#'. A new financial year is a new scope.
CREATE TABLE finance_number_sequences (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  scope varchar(64) NOT NULL,
  next_value bigint NOT NULL CHECK(next_value >= 1),
  CONSTRAINT uk_finance_sequence_scope UNIQUE(workspace_id, scope)
);
-- Invoices numbered before templates existed continue the INV- sequence.
INSERT INTO finance_number_sequences(id, workspace_id, scope, next_value)
SELECT md5(random()::text || id::text)::uuid, id, 'INV-#', next_invoice_number FROM finance_workspaces;

ALTER TABLE finance_workspaces ADD COLUMN next_draft_number bigint NOT NULL DEFAULT 1 CHECK(next_draft_number >= 1);

ALTER TABLE finance_invoices ADD COLUMN template_id uuid REFERENCES finance_invoice_templates(id);
ALTER TABLE finance_invoices ADD COLUMN template_snapshot text;
ALTER TABLE finance_invoices ADD COLUMN custom_fields text;
ALTER TABLE finance_invoices ADD COLUMN place_of_supply varchar(64);

ALTER TABLE finance_invoice_lines ADD COLUMN item_code varchar(32);

ALTER TABLE finance_clients ADD COLUMN contact_name varchar(120);
ALTER TABLE finance_clients ADD COLUMN region varchar(64);

-- A stable, URL-safe reference identifies every invoice. Template numbers such as OH/26-27/0001 contain slashes and
-- are only assigned at issue, so they are display values. Existing invoices keep their INV- number as reference.
ALTER TABLE finance_invoices ADD COLUMN reference varchar(32);
UPDATE finance_invoices SET reference = invoice_number;
ALTER TABLE finance_invoices ALTER COLUMN reference SET NOT NULL;
ALTER TABLE finance_invoices ADD CONSTRAINT uk_finance_invoice_workspace_reference UNIQUE(workspace_id, reference);
ALTER TABLE finance_invoices ALTER COLUMN invoice_number DROP NOT NULL;
