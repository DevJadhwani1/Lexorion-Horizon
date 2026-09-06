CREATE TABLE workspace_products (
    workspace_id uuid NOT NULL REFERENCES organization_workspaces(id),
    product_id uuid NOT NULL REFERENCES products(id),
    PRIMARY KEY (workspace_id, product_id)
);
-- Preserve legacy associations and all existing workspace identifiers.
INSERT INTO workspace_products(workspace_id, product_id)
SELECT id, product_id FROM organization_workspaces;
