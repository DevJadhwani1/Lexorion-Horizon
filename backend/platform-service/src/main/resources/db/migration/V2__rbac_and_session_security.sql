UPDATE organization_memberships SET role = 'ADMIN' WHERE role = 'OWNER';
UPDATE organization_memberships SET role = 'EMPLOYEE' WHERE role = 'MEMBER';
UPDATE organization_invitations SET intended_role = 'ADMIN' WHERE intended_role = 'OWNER';
UPDATE organization_invitations SET intended_role = 'EMPLOYEE' WHERE intended_role = 'MEMBER';

ALTER TABLE organization_memberships DROP CONSTRAINT IF EXISTS organization_memberships_role_check;
ALTER TABLE organization_memberships ADD CONSTRAINT organization_memberships_role_check
  CHECK (role IN ('ADMIN', 'MANAGER', 'EMPLOYEE'));
ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_intended_role_check;
ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_intended_role_check
  CHECK (intended_role IN ('ADMIN', 'MANAGER', 'EMPLOYEE'));

ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS session_id uuid;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS family_id uuid;
ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by_hash varchar(64);
UPDATE refresh_tokens SET session_id = id WHERE session_id IS NULL;
UPDATE refresh_tokens SET family_id = id WHERE family_id IS NULL;
ALTER TABLE refresh_tokens ALTER COLUMN session_id SET NOT NULL;
ALTER TABLE refresh_tokens ALTER COLUMN family_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_token_user_active ON refresh_tokens(user_id, revoked);
CREATE INDEX IF NOT EXISTS idx_refresh_token_family ON refresh_tokens(family_id);
