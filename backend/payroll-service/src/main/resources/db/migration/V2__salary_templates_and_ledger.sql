ALTER TABLE compensation_profiles ADD COLUMN IF NOT EXISTS source_template_key varchar(64);

CREATE TABLE payroll_salary_templates (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES payroll_workspaces(id),
  template_key varchar(64) NOT NULL,
  display_name varchar(150) NOT NULL,
  description varchar(500),
  currency varchar(3) NOT NULL,
  pay_frequency varchar(16) NOT NULL,
  template_status varchar(16) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_salary_template_workspace_key UNIQUE(workspace_id, template_key),
  CONSTRAINT payroll_salary_templates_dates_check CHECK(effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX idx_salary_template_workspace_status ON payroll_salary_templates(workspace_id, template_status);
CREATE INDEX idx_salary_template_workspace_dates ON payroll_salary_templates(workspace_id, effective_from, effective_to);

CREATE TABLE payroll_salary_template_components (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES payroll_salary_templates(id),
  component_definition_id uuid NOT NULL REFERENCES payroll_component_definitions(id),
  configured_value numeric(19,4) NOT NULL CHECK(configured_value >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_salary_template_component UNIQUE(template_id, component_definition_id)
);
CREATE INDEX idx_salary_template_component_template ON payroll_salary_template_components(template_id);

CREATE TABLE payroll_ledger_entries (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES payroll_workspaces(id),
  payroll_employee_id uuid NOT NULL REFERENCES payroll_employees(id),
  pay_run_id uuid NOT NULL REFERENCES payroll_pay_runs(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  entry_date date NOT NULL,
  entry_type varchar(24) NOT NULL,
  component_key varchar(64),
  component_name varchar(150),
  amount numeric(19,4) NOT NULL CHECK(amount <> 0),
  currency varchar(3) NOT NULL,
  source_reference varchar(220) NOT NULL,
  status varchar(16) NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT uk_payroll_ledger_workspace_source UNIQUE(workspace_id, source_reference)
);
CREATE INDEX idx_payroll_ledger_employee_period ON payroll_ledger_entries(workspace_id, payroll_employee_id, period_end);
CREATE INDEX idx_payroll_ledger_pay_run ON payroll_ledger_entries(workspace_id, pay_run_id);
