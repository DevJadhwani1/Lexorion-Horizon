-- Employment spells sit beside the current employee projection. Existing rows become spell 1.
-- Exits recorded before this migration have no exit date; later resignation and termination must supply one.
ALTER TABLE employees ADD COLUMN original_joining_date date;
UPDATE employees SET original_joining_date = joining_date;
ALTER TABLE employees ALTER COLUMN original_joining_date SET NOT NULL;

CREATE TABLE employment_spells (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    workspace_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    spell_number integer NOT NULL,
    employment_status character varying(20) NOT NULL,
    employment_type character varying(20),
    joining_date date NOT NULL,
    exit_date date,
    exit_reason character varying(500),
    department_id uuid,
    designation_id uuid,
    reporting_manager_id uuid,
    open_employee_id uuid,
    CONSTRAINT employment_spells_pkey PRIMARY KEY (id),
    CONSTRAINT uk_employment_spell_number UNIQUE (employee_id, spell_number),
    CONSTRAINT uk_employment_spell_open UNIQUE (open_employee_id),
    CONSTRAINT employment_spells_status_check CHECK (employment_status IN ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED')),
    CONSTRAINT employment_spells_type_check CHECK (employment_type IS NULL OR employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT')),
    CONSTRAINT employment_spells_open_check CHECK (
        (employment_status IN ('ACTIVE', 'ON_LEAVE', 'SUSPENDED') AND exit_date IS NULL AND exit_reason IS NULL AND open_employee_id = employee_id)
        OR (employment_status IN ('RESIGNED', 'TERMINATED') AND open_employee_id IS NULL)
    ),
    CONSTRAINT fk_employment_spell_workspace FOREIGN KEY (workspace_id) REFERENCES workforce_workspaces (id),
    CONSTRAINT fk_employment_spell_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
    CONSTRAINT fk_employment_spell_department FOREIGN KEY (department_id) REFERENCES departments (id),
    CONSTRAINT fk_employment_spell_designation FOREIGN KEY (designation_id) REFERENCES designations (id),
    CONSTRAINT fk_employment_spell_manager FOREIGN KEY (reporting_manager_id) REFERENCES employees (id)
);

CREATE INDEX idx_employment_spell_employee ON employment_spells (workspace_id, employee_id, spell_number);

INSERT INTO employment_spells (
    id, created_at, workspace_id, employee_id, spell_number, employment_status, employment_type,
    joining_date, exit_date, exit_reason, department_id, designation_id, reporting_manager_id, open_employee_id
)
SELECT gen_random_uuid(), created_at, workspace_id, id, 1, employment_status, employment_type,
    joining_date, NULL, NULL, department_id, designation_id, reporting_manager_id,
    CASE WHEN employment_status IN ('ACTIVE', 'ON_LEAVE', 'SUSPENDED') THEN id ELSE NULL END
FROM employees;
