-- Authoritative onboarding decisions. Country and currency defaults, invitation history,
-- and the browser's selected workspace are not stored here and do not mean setup is finished.
ALTER TABLE organization_settings ADD COLUMN onboarding_access_decision varchar(16);
ALTER TABLE organization_settings ADD COLUMN onboarding_access_decided_at timestamp with time zone;
ALTER TABLE organization_settings ADD COLUMN onboarding_finished_at timestamp with time zone;
ALTER TABLE organization_settings ADD CONSTRAINT organization_settings_onboarding_access_check
  CHECK (onboarding_access_decision IS NULL OR onboarding_access_decision = 'SOLO');
