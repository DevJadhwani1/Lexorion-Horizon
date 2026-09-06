-- Preserve all legacy plan identities and assignments. New commercial plans
-- use entitlement keys to describe products rather than a single product FK.
ALTER TABLE plans ALTER COLUMN product_id DROP NOT NULL;
