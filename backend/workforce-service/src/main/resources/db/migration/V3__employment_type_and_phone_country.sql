-- Optional employment details captured by guided onboarding. Existing employees keep NULL (not recorded);
-- existing phone values are left exactly as stored.
ALTER TABLE employees ADD COLUMN employment_type character varying(20);
ALTER TABLE employees ADD CONSTRAINT employees_employment_type_check
    CHECK (employment_type IS NULL OR employment_type IN ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'));
ALTER TABLE employees ADD COLUMN phone_country character varying(2);
ALTER TABLE employees ADD CONSTRAINT employees_phone_country_check
    CHECK (phone_country IS NULL OR phone_country ~ '^[A-Z]{2}$');
