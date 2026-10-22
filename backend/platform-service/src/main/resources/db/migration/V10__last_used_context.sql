-- Server-side last-used context so a user's organization and workspace follow them across browsers and devices.
ALTER TABLE users ADD COLUMN last_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE organization_memberships ADD COLUMN last_workspace_key VARCHAR(63);
