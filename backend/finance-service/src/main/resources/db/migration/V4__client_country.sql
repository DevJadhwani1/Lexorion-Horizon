-- Clients record their country (ISO 3166-1 alpha-2). Supplies outside the seller's country are shown as exports.
ALTER TABLE finance_clients ADD COLUMN country varchar(2);
