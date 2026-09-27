-- Keep one association row and all IDs; move only Horizon's authorization extension.
CREATE TABLE horizon_membership_roles (
    membership_id uuid PRIMARY KEY REFERENCES organization_memberships(id) ON DELETE CASCADE,
    role varchar(20) CHECK (role IN ('ADMIN', 'MANAGER', 'EMPLOYEE'))
);
INSERT INTO horizon_membership_roles(membership_id, role)
SELECT id, role FROM organization_memberships;
ALTER TABLE organization_memberships DROP COLUMN role;

ALTER TABLE core_products ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE core_products ADD CONSTRAINT uk_core_products_id UNIQUE(id);

-- Audit scope is an opaque global resource scope, not a product workspace concept.
ALTER TABLE audit_events RENAME COLUMN workspace_id TO scope_id;
UPDATE core_products SET display_name = 'AXON' WHERE product_key = 'axon' AND display_name = 'Axon';
