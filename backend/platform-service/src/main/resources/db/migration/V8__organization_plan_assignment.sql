-- Preserve every historical per-product assignment for audit/recovery, then
-- promote one canonical platform plan to the organization-level runtime model.
ALTER TABLE organization_plan_assignments RENAME TO organization_product_plan_assignments_legacy;
ALTER INDEX idx_plan_assignment_org RENAME TO idx_legacy_plan_assignment_org;
ALTER INDEX idx_plan_assignment_status RENAME TO idx_legacy_plan_assignment_status;

-- Free the globally unique commercial keys before creating organization plans.
UPDATE plans SET plan_key = 'legacy-' || plan_key || '-' || substr(id::text, 1, 8)
WHERE product_id IS NOT NULL AND plan_key IN ('starter', 'business');

CREATE TABLE organization_plan_assignments (
    id uuid PRIMARY KEY,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    organization_id uuid NOT NULL REFERENCES organizations(id),
    plan_id uuid NOT NULL REFERENCES plans(id),
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT uk_org_plan_assignment UNIQUE (organization_id)
);
CREATE INDEX idx_plan_assignment_status ON organization_plan_assignments(status);

INSERT INTO plans(id, created_at, updated_at, display_name, plan_key, status, product_id)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, catalog.display_name, catalog.plan_key, 'ACTIVE', NULL
FROM (VALUES ('Starter', 'starter'), ('Business', 'business')) AS catalog(display_name, plan_key)
WHERE NOT EXISTS (SELECT 1 FROM plans existing WHERE existing.plan_key = catalog.plan_key AND existing.product_id IS NULL);

-- Prefer an existing Starter/Business assignment. For old product-specific
-- plans, infer the nearest locked tier from the persisted employee limit.
WITH active_rows AS (
    SELECT a.*, p.plan_key, p.product_id AS plan_product_id,
           row_number() OVER (
             PARTITION BY a.organization_id
             ORDER BY CASE WHEN p.plan_key IN ('starter', 'business') AND p.product_id IS NULL THEN 0 ELSE 1 END,
                      a.updated_at DESC, a.created_at DESC, a.id
           ) AS choice
    FROM organization_product_plan_assignments_legacy a
    JOIN plans p ON p.id = a.plan_id
    WHERE a.status = 'ACTIVE'
), chosen AS (
    SELECT organization_id, plan_id, id, created_at, updated_at
    FROM active_rows WHERE choice = 1 AND plan_key IN ('starter', 'business') AND plan_product_id IS NULL
), inferred AS (
    SELECT a.organization_id,
           CASE WHEN max(CASE WHEN d.entitlement_key IS NOT NULL THEN COALESCE(pe.integer_value, 0) END) > 25 THEN 'business' ELSE 'starter' END AS plan_key,
           min(a.id::text)::uuid AS id,
           min(a.created_at) AS created_at,
           max(a.updated_at) AS updated_at
    FROM organization_product_plan_assignments_legacy a
    JOIN plans p ON p.id = a.plan_id
    LEFT JOIN plan_entitlements pe ON pe.plan_id = p.id
    LEFT JOIN entitlement_definitions d ON d.id = pe.entitlement_definition_id
      AND d.entitlement_key IN ('platform.employee_limit', 'workforce.employee_limit')
    WHERE a.status = 'ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM chosen c WHERE c.organization_id = a.organization_id)
    GROUP BY a.organization_id
), candidates AS (
    SELECT c.organization_id, c.plan_id, c.id, c.created_at, c.updated_at FROM chosen c
    UNION ALL
    SELECT i.organization_id, p.id, i.id, i.created_at, i.updated_at
    FROM inferred i JOIN plans p ON p.plan_key = i.plan_key AND p.product_id IS NULL
)
INSERT INTO organization_plan_assignments(id, created_at, updated_at, organization_id, plan_id, status)
SELECT id, created_at, updated_at, organization_id, plan_id, 'ACTIVE' FROM candidates;

-- Product-specific assignment history remains intact in the archive table.
UPDATE plans SET status = 'INACTIVE'
WHERE product_id IS NOT NULL OR plan_key NOT IN ('starter', 'business');
UPDATE entitlement_definitions SET status = 'INACTIVE'
WHERE entitlement_key IN ('workforce.employee_limit', 'workforce.attendance', 'workforce.leave', 'workforce.payroll_integration', 'finance.invoicing');
