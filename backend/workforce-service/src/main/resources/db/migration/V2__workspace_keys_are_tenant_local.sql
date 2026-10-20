-- Platform workspace UUIDs are global. Display keys are unique only within an organization.
ALTER TABLE workforce_workspaces DROP CONSTRAINT uk_workforce_workspace_key;
