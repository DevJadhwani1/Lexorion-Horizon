CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  occurred_at timestamp with time zone NOT NULL,
  actor_user_id uuid,
  organization_id uuid,
  workspace_id uuid,
  service varchar(63) NOT NULL,
  operation varchar(100) NOT NULL,
  resource_type varchar(100) NOT NULL,
  resource_id varchar(150),
  result varchar(32) NOT NULL,
  correlation_id varchar(64),
  metadata text
);
CREATE INDEX idx_audit_events_occurred_at ON audit_events(occurred_at);
CREATE INDEX idx_audit_events_actor ON audit_events(actor_user_id);
