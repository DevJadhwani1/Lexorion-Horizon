-- Use the trusted Platform workspace UUID for identity; companies can reuse display keys.
ALTER TABLE payroll_workspaces DROP CONSTRAINT uk_payroll_workspace_key;
