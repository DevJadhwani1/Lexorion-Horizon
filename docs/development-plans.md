# Development plan model

Locked specification as of 2026-09-06. This supersedes earlier development plan counts and limits. Everything outside this plan model remains unchanged.

| Plan | Employees | Workspaces | Workforce | Payroll |
| --- | ---: | ---: | :---: | :---: |
| Starter | 25 | 1 | ✓ | ✓ |
| Business | 100 | 3 | ✓ | ✓ |

- Exactly two plans: Starter and Business.
- Plans are owned by the platform.
- Access follows Plan → entitlements → organization.
- No custom plans.
- No billing or payment integration yet.

## Implementation status

The runtime catalog now seeds only the platform-owned Starter and Business plans, and organizations hold one commercial plan assignment. Workforce and Payroll availability plus employee and workspace limits derive from that assignment. Existing product-specific assignment rows are retained in the legacy archive table by migration `V8__organization_plan_assignment.sql`. PostgreSQL V1–V8 clean and V7 upgrade paths passed both the Testcontainers migration test and `LocalPostgresMigrationTest` against temporary PostgreSQL databases.
