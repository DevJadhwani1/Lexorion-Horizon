ALTER TABLE compensation_profiles
  ADD COLUMN IF NOT EXISTS source_template_version integer;

ALTER TABLE compensation_profiles
  ADD CONSTRAINT compensation_profiles_source_template_version_check
  CHECK (source_template_version IS NULL OR source_template_version > 0);
