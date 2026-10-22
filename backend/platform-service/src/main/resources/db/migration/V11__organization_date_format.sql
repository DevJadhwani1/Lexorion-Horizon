-- Add date_format to organization_settings with default YYYY-MM-DD
ALTER TABLE organization_settings ADD COLUMN date_format VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD';
