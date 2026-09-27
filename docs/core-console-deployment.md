# Publishing the Core Console

Repository configuration is ready for `https://core.lexorion.in`. DNS, a public TLS certificate and the external ingress are not provisioned by this change.

## Local development

Run the existing backend services and `npm run dev` in `frontend`. Open `http://localhost:9000/core/`. Existing Horizon development routes remain at `/app`. Core uses the same-origin `/api/core/**` proxy, shared token store and real platform-service APIs.

For host-based testing, map `core.lexorion.in` to your development server in your local hosts file, then open `http://core.lexorion.in:9000/`. This is a local override, not public DNS. Vite explicitly allows that hostname.

## Production DNS and ingress

1. Add an A record `core.lexorion.in` pointing to the existing public Lexorion ingress IPv4 address. Add an AAAA record only if the same ingress is reachable over IPv6. An alias to an existing ingress hostname is also valid if your DNS provider supports it.
2. Issue/install a TLS certificate whose subject alternative names include `core.lexorion.in` using the ingress’s existing certificate management process.
3. Add a virtual host for `core.lexorion.in`, redirect HTTP to HTTPS, terminate TLS, and forward **all paths**, including `/api/`, to the existing frontend service on port 9000. Preserve the original `Host`, forwarded protocol and client address.
4. The repository’s frontend Nginx serves the application and sends `/api/` to `gateway:9001`; the gateway sends `/api/core/**` to `PLATFORM-SERVICE`. Do not rewrite the `/api/core` prefix or send Core routes to workforce/payroll services.
5. Deploy the frontend, gateway configuration and platform-service together. Apply the Core V1 boundary migration during a coordinated platform-service upgrade; previous binaries use the old membership role column. Back up the database through the existing operational process before upgrading.

The example at `infrastructure/nginx/core.lexorion.in.conf.example` shows the ingress shape. Replace `FRONTEND_PRIVATE_ADDRESS` with the frontend address reachable by that ingress and use the actual certificate paths. It is deliberately an example, not an installed or active server configuration.

## Identity and operator access

Use an existing active global operator account. The current bootstrap mechanism can establish the initial operator where needed; its credentials must be supplied to the backend through the existing secret/environment mechanism, never frontend variables. Horizon organization ADMIN membership alone does not grant Core Console access.

JWT issuer and signing configuration remain compatible with the current deployment. Do not independently change the issuer or signing secret as part of this migration. Browser token storage is origin-scoped: this change provides one authentication authority, not automatic cross-domain browser SSO.

## Verification after ingress setup

- Open `https://core.lexorion.in/login` and sign in as a global operator.
- Confirm Overview, Organizations, Users, Products, Product Access, Platform Operators, Sessions, Security and Audit load real responses.
- Inspect requests: they must use same-origin `/api/core/**`, with no Horizon workspace or organization selection header.
- Sign in as an ordinary product member and verify operator pages are denied.
- Verify `horizon.lexorion.in` and `admin.horizon.lexorion.in` retain their existing routes and authorization.
- Verify an unauthenticated `GET /api/core/me` returns 401, not frontend HTML.

No claim is made that public DNS, TLS, ingress deployment or public-host smoke tests have been completed from this workspace.
