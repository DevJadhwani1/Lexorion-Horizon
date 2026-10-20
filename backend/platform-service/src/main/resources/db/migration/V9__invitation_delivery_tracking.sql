ALTER TABLE organization_invitations ADD COLUMN delivery_status VARCHAR(20) NOT NULL DEFAULT 'NOT_SENT';
ALTER TABLE organization_invitations ADD COLUMN delivery_error VARCHAR(255);
ALTER TABLE organization_invitations ADD COLUMN delivery_attempted_at TIMESTAMP WITH TIME ZONE;
