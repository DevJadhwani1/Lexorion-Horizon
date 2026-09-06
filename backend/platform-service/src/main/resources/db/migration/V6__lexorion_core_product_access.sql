CREATE TABLE core_products (
    product_key varchar(63) PRIMARY KEY,
    display_name varchar(150) NOT NULL,
    active boolean NOT NULL
);
INSERT INTO core_products(product_key, display_name, active) VALUES
    ('horizon', 'Horizon', true), ('axon', 'Axon', false), ('atlas', 'Atlas', false);

CREATE TABLE core_product_access (
    id uuid PRIMARY KEY,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    organization_id uuid NOT NULL REFERENCES organizations(id),
    product_key varchar(63) NOT NULL REFERENCES core_products(product_key),
    status varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    UNIQUE (organization_id, product_key),
    CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until > valid_from)
);
-- Existing organizations were created in Horizon. Preserve enrollment, while
-- runtime organization lifecycle and Horizon module plans still gate access.
INSERT INTO core_product_access(id, created_at, updated_at, organization_id, product_key, status)
SELECT gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, id, 'horizon', 'ACTIVE'
FROM organizations;
