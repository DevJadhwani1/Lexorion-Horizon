ALTER TABLE compensation_component_assignments
  ADD COLUMN IF NOT EXISTS component_key varchar(64),
  ADD COLUMN IF NOT EXISTS display_name varchar(150),
  ADD COLUMN IF NOT EXISTS component_category varchar(16),
  ADD COLUMN IF NOT EXISTS amount_type varchar(20),
  ADD COLUMN IF NOT EXISTS occurrence_type varchar(16),
  ADD COLUMN IF NOT EXISTS taxability varchar(16),
  ADD COLUMN IF NOT EXISTS percentage_basis varchar(64);

UPDATE compensation_component_assignments a
SET component_key = d.component_key,
    display_name = d.display_name,
    component_category = d.category,
    amount_type = d.amount_type,
    occurrence_type = d.occurrence_type,
    taxability = d.taxability
FROM payroll_component_definitions d
WHERE a.component_definition_id = d.id;

ALTER TABLE compensation_component_assignments
  ALTER COLUMN component_key SET NOT NULL,
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN component_category SET NOT NULL,
  ALTER COLUMN amount_type SET NOT NULL,
  ALTER COLUMN occurrence_type SET NOT NULL,
  ALTER COLUMN taxability SET NOT NULL;

ALTER TABLE payroll_calculation_lines
  ADD COLUMN IF NOT EXISTS percentage_basis varchar(64);
