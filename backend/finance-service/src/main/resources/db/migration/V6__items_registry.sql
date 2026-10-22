-- Items and services registry: the reference codes invoices bill against (REC-001 Recruitment fee, CON-002 Advisory
-- retainer…), with HSN/SAC, unit, default rate and GST rate. Invoice lines copy the values, so later edits to an item
-- never change an existing bill.
CREATE TABLE finance_items (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES finance_workspaces(id),
  item_code varchar(32) NOT NULL,
  name varchar(160) NOT NULL,
  description varchar(300),
  kind varchar(16) NOT NULL CHECK(kind IN ('SERVICE','GOODS')),
  category varchar(60),
  hsn_sac varchar(8),
  unit varchar(16),
  unit_price numeric(19,2) CHECK(unit_price IS NULL OR unit_price >= 0),
  tax_rate numeric(7,4) CHECK(tax_rate IS NULL OR tax_rate BETWEEN 0 AND 100),
  status varchar(16) NOT NULL CHECK(status IN ('ACTIVE','ARCHIVED')),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_finance_item_workspace_code UNIQUE(workspace_id, item_code)
);
ALTER TABLE finance_invoice_lines ADD COLUMN hsn_sac varchar(8);
ALTER TABLE finance_invoice_lines ADD COLUMN unit varchar(16);
