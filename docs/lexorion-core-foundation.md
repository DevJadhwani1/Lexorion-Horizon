# Lexorion Core V1 — FINAL / LOCKED

Core runs inside the existing platform-service deployment. It reuses the existing user, organization, membership and session records. It neither creates another identity system nor understands a product’s business domain.

| Owner | Capabilities |
| --- | --- |
| `com.lexorion.core` | Identity, users, password encoding, authentication, refresh sessions, JWT verification, global security principal, organization identity and lifecycle, associations, product registration and entry, operator administration, global IDs, audit and generic APIs |
| `com.lexorion.horizon` | Horizon membership roles and invitations, workspaces, module catalogs, plans, solutions, entitlements, employee limits, tenant settings and authorization |
| `com.lexorion.platform` | Existing deployment composition, bootstrap product registrations, legacy API adapters and Horizon hostname routing |

`CoreArchitectureTest` rejects dependencies on the Horizon and deployment packages, business authorization classes, Horizon table names and product-specific branches. `CoreStandaloneIntegrationTest` boots only Core components, entities and repositories, then registers and accesses Horizon, AXON, Atlas and a new Travel product through the same HTTP contracts. Its schema contains no Horizon workspace, plan, entitlement, module catalog or role tables.

## Changes to the boundary

Core organization membership is now a writable, role-free association. The previous read-only projection could not create an association without a Horizon role. the Core V1 boundary migration transfers the historical role values into `horizon_membership_roles`, keyed by the original membership ID. The association row itself remains in `organization_memberships`. No users, organizations or associations are copied. Horizon reads and writes its authorization extension through a secondary-table mapping. A Core association alone never becomes a Horizon employee or administrator.

Organization lifecycle and slug validation now belong to Core. The existing Horizon organization API delegates identity/association creation to Core, assigns its administrator role separately, and explicitly enrolls the organization in Horizon. Core onboarding does not enroll any product. Horizon’s historical 14-day trial policy remains in the legacy Horizon onboarding adapter; Core does not choose a commercial trial duration.

Authentication, API errors, auditing configuration and the `/api/core/**` security chain are independently usable from Core. Its principal contains global user and organization IDs, email and global operator status. It contains no product role. Existing token format, issuer configuration, refresh rotation and reuse detection are preserved. Global operator services and DTOs are in Core; legacy URLs remain adapters. The legacy audit workspace column becomes a generic opaque `scope_id` without changing its stored IDs.

## Database ownership

| Core-owned tables | Purpose |
| --- | --- |
| `users` | One global identity store |
| `organizations` | Global organization identity, profile and lifecycle |
| `organization_memberships` | One global user/organization association with status and joined time |
| `platform_access` | Global operator authority, separate from all product roles |
| `refresh_tokens` | Hashed refresh credentials, session and family IDs, rotation/revocation state |
| `core_products` | Stable product key, global UUID, display name and availability |
| `core_product_access` | Organization enrollment, grant status and optional validity bounds |
| `audit_events` | Global security/administrative audit foundation with opaque resource IDs |

Horizon owns `horizon_membership_roles`, `organization_invitations`, `organization_workspaces`, `workspace_products`, `products` (the legacy **module** catalog), `plans`, `plan_entitlements`, `entitlement_definitions`, `organization_plan_assignments`, organization settings and working days. The existing hostname/domain infrastructure remains the current deployment’s Horizon routing adapter.

Historical Flyway migrations remain unchanged. The enrollment migration preserves existing organizations’ implicit Horizon enrollment. the Core V1 boundary migration moves the role extension, adds stable Core product UUIDs and generalizes audit scope. Existing membership IDs, roles, module IDs, workspace IDs, plans and token records survive. Deploy the Core V1 boundary migration together with the updated platform service: old binaries that still read the removed role column cannot run concurrently after this schema change. Use the normal database backup and coordinated service upgrade process; this is not a rolling mixed-version migration.

## Entry contract

Core checks active identity, active association, organization lifecycle, product registration and availability, organization enrollment, grant status and validity. Start times are inclusive; end times are exclusive. Global operators do not bypass organization association or product entry checks.

Successful entry returns:

```json
{
  "userId": "global-user-uuid",
  "organizationId": "global-organization-uuid",
  "productId": "global-product-uuid",
  "productKey": "lexorion-travel",
  "validUntil": null
}
```

No role, plan, workspace, module or permission is included. Horizon checks Core before establishing tenant context and again at workspace entry, then applies its own authorization. AXON can use these IDs to look up its projects, findings and permissions. Atlas can use the same IDs for its finance and AI CFO domain. Neither integration requires Core to learn those concepts.

## Core API contracts

All paths below are relative to `/api/core`. Except authentication operations, requests require a Core-issued bearer token. Operator-only endpoints recheck global operator status from the database. Product administrators do not acquire that status through product roles.

| Method and path | Authority / result |
| --- | --- |
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | Shared authentication and rotating refresh sessions; existing `/api/platform/auth/*` aliases remain |
| `POST /auth/sessions/revoke-all` | Authenticated user revokes their refresh sessions |
| `GET /me` | Role-free global identity |
| `GET /me/organizations` | Active associations and organization lifecycle |
| `GET /products` | Authenticated product registry, including unavailable products |
| `GET /me/organizations/{id}/products` | Effective product access for the requesting member |
| `GET /me/organizations/{id}/products/{key}/context` | Validated generic entry context; denied entry is 403 |
| `PUT /organizations/{id}/products/{key}` | Operator creates/updates grant; 204 success. Body: `status`, nullable `validFrom`, nullable `validUntil` |
| `GET /overview` | Operator: live organization, user, product and grant counts |
| `GET, POST /organizations` | Operator: list/create global organization identity |
| `PATCH /organizations/{id}/status` | Operator: validated lifecycle transition |
| `GET /organizations/{id}/memberships` | Operator: role-free associations |
| `PUT /organizations/{id}/memberships/{userId}` | Operator: create/update association, body `{"status":"ACTIVE"}` |
| `GET, POST /users`; `PATCH /users/{id}` | Operator: global users; response never includes password hashes |
| `POST /products`; `PATCH /products/{key}` | Operator: generic registration and availability |
| `GET /product-access` | Operator: enrollment records, including suspended/revoked grants |
| `GET, POST /operators`; `PATCH /operators/{userId}/status` | Global operator administration |
| `GET /sessions`; `POST /users/{id}/sessions/revoke` | Operator: session metadata and refresh-session revocation |
| `GET /security` | Operator: effective issuer, token lifetimes, algorithm and refresh protections; no secret material |
| `GET /audit?page=0` | Operator: persisted audit events, 100 per page |

Creating an organization requires `name`, `organizationCode`, `primaryEmail`, optional `slug` and optional `initialUserId`. It starts PENDING and has no product enrollment. Product registration requires `key`, `displayName`, `active`; the server generates the global UUID. Product keys are stable data. Invalid grants return 400; missing or conflicting resources use 404/409. Administration JSON responses use 200; grant updates and operator session revocation use 204.

Session revocation stops refresh renewal. Already-issued stateless access tokens retain their configured expiry, while active-user and product-access checks are re-evaluated on each request. Session APIs never return refresh tokens, token hashes or signing secrets.

## Integrating AXON, Atlas or a future product

1. A global operator registers the product using `POST /products` (or uses its existing registration).
2. Create an organization and role-free associations through Core, or use existing global IDs.
3. Activate the organization and enroll it using the generic product grant API.
4. Authenticate with Core; use its access token to request the organization/product entry context.
5. Enforce the product’s own authorization using the returned IDs. Do not trust a browser-provided ID as an authorization decision.

AXON, Atlas and Travel require no Core code changes beyond registry data. Browser sessions currently remain origin-scoped, sharing the same authentication implementation and identity store. Automatic cross-domain browser SSO redirects are not implemented; no bearer tokens are placed in URLs or copied between origins.

## Core Console and domains

The existing React/TypeScript/Vite application renders a dedicated Core Console at `core.lexorion.in`. Its navigation is Overview, Organizations, Users, Products, Product Access, Platform Operators, Sessions, Security and Audit. Every screen uses real Core APIs; there are no hardcoded counters or mock dashboards. It supports organization creation/lifecycle/associations, users, registration/availability, grants, operators, session revocation and audit browsing.

The console uses the shared API transport, token storage, login/logout and refresh implementation. Its separate Core session context never loads Horizon organizations or workspaces. Routes enforce global operator access, restore sessions and handle expired credentials. Horizon’s providers, routes and existing hostnames remain available.

The gateway already routes `/api/core/**` to the same platform-service deployment. Frontend Nginx and Vite now accept the Core hostname. Local Core access is `/core/` on the existing development server. Production requests are same-origin `/api/core/**`; no frontend secrets or localhost API URL are introduced. See [Core Console deployment](core-console-deployment.md) for DNS, TLS and reverse-proxy requirements.

## Verification

Backend tests include independent Core HTTP onboarding, generic entry for four products, operator restrictions, secret-free session/security APIs, token rotation/reuse, grant validity, Horizon onboarding and authorization regressions, architecture checks and PostgreSQL migration preservation. Frontend tests cover host selection, protected routes, session restoration, login/logout, token refresh/rejection, real-count rendering and generic registration requests. `npm test` is included in Jenkins alongside existing lint, typecheck and production build checks.

Validation for this rework: 141 backend tests passed (49 platform/Core, 46 Workforce, 37 Payroll, 2 Finance, 6 gateway, 1 discovery), with no failures or skips. Twelve frontend tests passed; frontend lint, typecheck and production build passed. PostgreSQL migration tests executed against real Testcontainers and temporary local PostgreSQL databases. Public-host DNS/TLS/ingress verification remains external.

## V1 release naming and migration compatibility

The frozen foundation is **Lexorion Core V1**. Release and architecture references use V1. The existing Flyway script `V7__core_membership_ownership.sql` retains its historical sequence identifier: `V1__baseline.sql` already exists, and changing applied migration identities would break database upgrade validation. That sequence number is not the Core release version. No migration is renumbered or reset.

**LEXORION CORE BOUNDARY: LOCKED**

Any subsequent requirement must first be classified as CORE PRIMITIVE or PRODUCT DOMAIN. The V1 ownership and entry contract are frozen. There are no remaining product-domain boundary violations identified by this audit. See [Final boundary lock report](lexorion-core-v1-boundary-lock.md).
