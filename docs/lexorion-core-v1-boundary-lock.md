# Lexorion Core V1 — Final Boundary Lock Report

1. **FINAL Core ownership**

   Global identity, users, authentication, sessions, password/JWT primitives, organization identity and lifecycle, role-free associations, generic product registry and enrollment, grant validity, global operators, global security context, IDs, audit and generic administration/entry APIs. The foundation’s release name is **Lexorion Core V1**.

2. **FINAL Horizon ownership**

   Horizon roles, invitations, workspaces, workspace access, plans, solutions, Workforce, Payroll, Finance, module catalog, entitlements, limits, settings, provisioning and all Horizon business/commercial authorization. Core association or enrollment alone never supplies a Horizon role.

3. **FINAL AXON ownership**

   AXON roles, permissions, plans, projects, applications, security testing, findings, runtime threat intelligence, workflows and entitlements. These are ownership rules, not newly implemented AXON features.

4. **FINAL Atlas ownership**

   Atlas roles, permissions, plans, AI CFO functions, financial intelligence, forecasting, reporting, entitlements and business logic. These remain product responsibilities.

5. **Database ownership**

   Core owns `users`, `organizations`, `organization_memberships`, `platform_access`, `refresh_tokens`, `core_products`, `core_product_access` and `audit_events`. Horizon owns its role extension and domain tables. Existing IDs and records remain intact; no duplicate identity or membership store exists.

   **Core V1 is a coordinated schema/application release. Old binaries must not run against its schema.** The migration preserves membership IDs and role values while transferring the roles to `horizon_membership_roles`.

   Release naming is V1. The historical filename `V7__core_membership_ownership.sql` remains unchanged solely for Flyway compatibility: the existing `V1__baseline.sql` cannot be replaced or assigned a second migration. Migration sequence and foundation release version are separate.

6. **API ownership**

   `/api/core/**` supplies generic authentication, identity, organizations, associations, registry, enrollment, operators, sessions, security, audit and overview. Its entry context is exactly `userId`, `organizationId`, `productId`, `productKey`, `validUntil`. Product roles, permissions, plans and workspaces are excluded. Compatible legacy APIs remain adapters; the console retains its nine generic sections.

7. **Dependency direction**

   Products consume Core. Core references no Horizon, AXON, Atlas or other product package. The architecture guard now rejects all non-Core `com.lexorion` package references, including future product packages. Audit of Core entities, services, configuration, APIs and persistence found no remaining product-domain boundary violation.

   **Remaining boundary violations: none identified.**

   **LEXORION CORE BOUNDARY: LOCKED**

   **LEXORION CORE V1 — FINAL / LOCKED.** Future requirements must first be classified as CORE PRIMITIVE or PRODUCT DOMAIN.

8. **Extensibility proof**

   The standalone test boots only Core and registers/accesses Horizon, AXON, Atlas and Lexorion Travel without Horizon tables, roles, plans, workspaces, entitlements or provisioning. Travel separately denies booking after Core entry, grants its own organization-scoped booking authority, then permits booking. It rejects another organization. Core receives no Travel domain policy. The frozen entry record is tested for its exact five fields.

   A completely new Lexorion product can consume Core for identity, organization, authentication and product access without Core knowing anything about that product’s business domain.

9. **Tests executed/results**

   All six backend services completed `clean verify`, including production JAR packaging. **130 backend tests passed, with no failures, errors or skips:** 44 platform/Core, 40 Workforce, 37 Payroll, 2 Finance, 6 gateway and 1 discovery. Tests include architecture, standalone/product isolation, generic entry, organization isolation, grants and validity, operator isolation, session rotation/reuse/revocation, Horizon regressions and real PostgreSQL migration preservation.

   **9 frontend tests passed.** Frontend lint and production build passed. Existing Core session restoration, login/logout, refresh rejection, operator protection, API-backed counts, product registration and local/production host selection remain tested. `git diff --check` passed.

10. **Remaining external deployment requirements**

    Configure public DNS, TLS and ingress for `core.lexorion.in`; deploy the coordinated Core V1 schema/application release and frontend; run public-host smoke tests. Local Core remains at `/core/`. Browser sessions remain origin-scoped; cross-domain SSO is intentionally outside this lock. See [deployment instructions](core-console-deployment.md).
