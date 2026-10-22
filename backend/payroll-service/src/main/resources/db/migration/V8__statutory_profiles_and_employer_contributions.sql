-- Guided payroll setup: employer contributions, enrollment details, statutory profiles and versioned statutory rules.
-- Additive only. Existing employees, components, calculations, pay runs and ledger rows are unchanged:
-- new columns are nullable or default to zero, and no existing row gains a statutory profile.

-- 1. Employer contributions as a third component category (employer cost, never part of gross, deductions or net).
ALTER TABLE payroll_component_definitions ALTER COLUMN category TYPE character varying(32);
ALTER TABLE payroll_component_definitions DROP CONSTRAINT IF EXISTS payroll_component_definitions_category_check;
ALTER TABLE payroll_component_definitions ADD CONSTRAINT payroll_component_definitions_category_check
    CHECK (category IN ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION'));

ALTER TABLE compensation_component_assignments ALTER COLUMN component_category TYPE character varying(32);
ALTER TABLE compensation_component_assignments ADD CONSTRAINT compensation_component_assignments_category_check
    CHECK (component_category IN ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION'));

ALTER TABLE payroll_calculation_lines ALTER COLUMN category TYPE character varying(32);
ALTER TABLE payroll_calculation_lines DROP CONSTRAINT IF EXISTS payroll_calculation_lines_category_check;
ALTER TABLE payroll_calculation_lines ADD CONSTRAINT payroll_calculation_lines_category_check
    CHECK (category IN ('EARNING', 'DEDUCTION', 'EMPLOYER_CONTRIBUTION'));

ALTER TABLE payroll_calculations ADD COLUMN employer_contribution_amount numeric(19,4) NOT NULL DEFAULT 0;
ALTER TABLE payroll_pay_runs ADD COLUMN employer_contribution_total numeric(19,4) NOT NULL DEFAULT 0;
ALTER TABLE payroll_pay_run_employees ADD COLUMN employer_contribution_snapshot numeric(19,4) NOT NULL DEFAULT 0;

-- 2. Enrollment details. Optional for existing employees.
ALTER TABLE payroll_employees ADD COLUMN pay_group character varying(63);
ALTER TABLE payroll_employees ADD COLUMN work_state character varying(6);
ALTER TABLE payroll_employees ADD COLUMN work_location character varying(120);

-- 3. One statutory and payment profile per payroll employee, created on first save.
-- Sensitive identifiers are write-only through the API and returned masked.
CREATE TABLE payroll_statutory_profiles (
    id uuid NOT NULL PRIMARY KEY,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    version bigint NOT NULL DEFAULT 0,
    payroll_employee_id uuid NOT NULL REFERENCES payroll_employees(id),
    workspace_id uuid NOT NULL REFERENCES payroll_workspaces(id),
    payment_method character varying(20),
    bank_account_holder character varying(150),
    bank_account_number character varying(34),
    bank_ifsc character varying(11),
    bank_name character varying(120),
    bank_verified boolean NOT NULL DEFAULT false,
    pan character varying(10),
    pan_verified boolean NOT NULL DEFAULT false,
    tax_regime character varying(20),
    pf_applicability character varying(20),
    uan character varying(12),
    pf_member_since date,
    pf_higher_wages_opt_in boolean NOT NULL DEFAULT false,
    pf_verified boolean NOT NULL DEFAULT false,
    esi_applicability character varying(20),
    esi_ip_number character varying(10),
    esi_verified boolean NOT NULL DEFAULT false,
    pt_applicability character varying(20),
    pt_state character varying(6),
    lwf_applicability character varying(20),
    lwf_state character varying(6),
    CONSTRAINT uk_statutory_profile_employee UNIQUE (payroll_employee_id),
    CONSTRAINT payroll_statutory_profiles_payment_method_check CHECK (payment_method IS NULL OR payment_method IN ('BANK_TRANSFER', 'CHEQUE', 'CASH')),
    CONSTRAINT payroll_statutory_profiles_tax_regime_check CHECK (tax_regime IS NULL OR tax_regime IN ('NEW', 'OLD', 'NOT_DECLARED')),
    CONSTRAINT payroll_statutory_profiles_pf_check CHECK (pf_applicability IS NULL OR pf_applicability IN ('UNDECIDED', 'APPLICABLE', 'NOT_APPLICABLE')),
    CONSTRAINT payroll_statutory_profiles_esi_check CHECK (esi_applicability IS NULL OR esi_applicability IN ('UNDECIDED', 'APPLICABLE', 'NOT_APPLICABLE')),
    CONSTRAINT payroll_statutory_profiles_pt_check CHECK (pt_applicability IS NULL OR pt_applicability IN ('UNDECIDED', 'APPLICABLE', 'NOT_APPLICABLE')),
    CONSTRAINT payroll_statutory_profiles_lwf_check CHECK (lwf_applicability IS NULL OR lwf_applicability IN ('UNDECIDED', 'APPLICABLE', 'NOT_APPLICABLE'))
);
CREATE INDEX idx_statutory_profile_workspace ON payroll_statutory_profiles (workspace_id);

-- 4. Statutory rule versions: reference data shared by all tenants, selected by effective date.
-- Values are recorded with their source and must be reviewed by the employer or a chartered accountant
-- before figures derived from them are relied on.
CREATE TABLE payroll_statutory_rule_versions (
    id uuid NOT NULL PRIMARY KEY,
    scheme character varying(16) NOT NULL,
    jurisdiction character varying(8) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    wage_ceiling numeric(19,4),
    employee_rate numeric(9,4),
    employer_rate numeric(9,4),
    pension_rate numeric(9,4),
    pension_wage_ceiling numeric(19,4),
    source_reference character varying(500) NOT NULL,
    source_url character varying(500),
    review_status character varying(32) NOT NULL,
    CONSTRAINT uk_statutory_rule_version UNIQUE (scheme, jurisdiction, effective_from),
    CONSTRAINT payroll_statutory_rule_versions_scheme_check CHECK (scheme IN ('EPF', 'ESI')),
    CONSTRAINT payroll_statutory_rule_versions_period_check CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

INSERT INTO payroll_statutory_rule_versions
    (id, scheme, jurisdiction, effective_from, effective_to, wage_ceiling, employee_rate, employer_rate, pension_rate, pension_wage_ceiling, source_reference, source_url, review_status)
VALUES
    ('6a4f1d3e-0000-4000-8000-000000000001', 'EPF', 'IN', DATE '2014-09-01', DATE '2026-09-16', 15000, 12, 12, 8.33, 15000,
     'EPF wage ceiling Rs 15,000 per month from 01.09.2014; employee and employer contribution 12% of wages; EPS share 8.33% of wages up to the ceiling (Ministry of Labour & Employment, EPF Scheme 1952 text).',
     'https://www.labour.gov.in/static/uploads/2025/06/93561f36d5094b0cfe52570b4e8d2dc1.pdf', 'REQUIRES_EMPLOYER_REVIEW'),
    ('6a4f1d3e-0000-4000-8000-000000000002', 'EPF', 'IN', DATE '2026-09-17', NULL, 25000, 12, 12, 8.33, 25000,
     'EPF wage ceiling raised to Rs 25,000 per month w.e.f. 17.09.2026 by Gazette notification S.O. 5109(E) dated 17.09.2026 under the Code on Social Security, 2020; maximum EPS contribution Rs 2,083 (PIB releases 2313829, 2314111).',
     'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2313829', 'REQUIRES_EMPLOYER_REVIEW'),
    ('6a4f1d3e-0000-4000-8000-000000000003', 'ESI', 'IN', DATE '2019-07-01', NULL, 21000, 0.75, 3.25, NULL, NULL,
     'ESI contribution: employee 0.75%, employer 3.25% of wages w.e.f. 01.07.2019; coverage wage ceiling Rs 21,000 per month w.e.f. 01.01.2017 (Rs 25,000 for persons with disability) (ESIC).',
     'https://esic.gov.in/contribution', 'REQUIRES_EMPLOYER_REVIEW');
