CREATE TABLE payroll_salary_template_versions (
  id uuid PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES payroll_salary_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  currency varchar(3) NOT NULL,
  pay_frequency varchar(16) NOT NULL,
  version_status varchar(16) NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_salary_template_version_number UNIQUE(template_id, version_number),
  CONSTRAINT payroll_salary_template_versions_dates_check CHECK(effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX idx_salary_template_version_dates ON payroll_salary_template_versions(template_id, effective_from, effective_to);

CREATE TABLE payroll_salary_template_version_components (
  id uuid PRIMARY KEY,
  version_id uuid NOT NULL REFERENCES payroll_salary_template_versions(id) ON DELETE CASCADE,
  component_definition_id uuid NOT NULL REFERENCES payroll_component_definitions(id),
  component_key varchar(64) NOT NULL,
  configured_value numeric(19,4) NOT NULL CHECK(configured_value >= 0),
  percentage_basis varchar(64),
  display_sequence integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT uk_salary_template_version_component UNIQUE(version_id, component_definition_id)
);
CREATE INDEX idx_salary_template_version_component ON payroll_salary_template_version_components(version_id, display_sequence);

INSERT INTO payroll_salary_template_versions
  (id, template_id, version_number, currency, pay_frequency, version_status, effective_from, effective_to, created_at, updated_at)
SELECT gen_random_uuid(), id, 1, currency, pay_frequency, template_status, effective_from, effective_to, created_at, updated_at
FROM payroll_salary_templates;

INSERT INTO payroll_salary_template_version_components
  (id, version_id, component_definition_id, component_key, configured_value, display_sequence, created_at, updated_at)
SELECT gen_random_uuid(), v.id, c.component_definition_id, d.component_key, c.configured_value,
       row_number() over (partition by c.template_id order by d.component_key), c.created_at, c.updated_at
FROM payroll_salary_template_components c
JOIN payroll_salary_template_versions v ON v.template_id = c.template_id AND v.version_number = 1
JOIN payroll_component_definitions d ON d.id = c.component_definition_id;
