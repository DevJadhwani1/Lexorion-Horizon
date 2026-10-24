import { session } from "../api/session";

export const CLIENT_HOST = "horizon.lexorion.in";
export const PLATFORM_HOST = "admin.horizon.lexorion.in";

export type ConsoleHost = "platform" | "client" | "local";

export function consoleHost(hostname = window.location.hostname): ConsoleHost {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === PLATFORM_HOST) return "platform";
  if (normalized === CLIENT_HOST) return "client";
  return "local";
}

/**
 * User-facing paths. `/app` is not part of the route tree.
 * Keys are paths the product used to publish; values are the paths the router renders.
 */
const EXACT_PATHS: Record<string, string> = {
  "/": "/overview",
  "/app": "/overview",
  "/overview": "/overview",
  "/onboarding": "/onboarding",
  "/app/onboarding": "/onboarding",

  "/organization": "/organization",
  "/app/organization": "/organization",
  "/admin": "/organization",
  "/admin/organization": "/organization",
  "/app/admin": "/organization",
  "/app/admin/organization": "/organization",

  "/organization/workspaces": "/organization/workspaces",
  "/app/organization/workspaces": "/organization/workspaces",
  "/workspaces": "/organization/workspaces",
  "/app/workspaces": "/organization/workspaces",
  "/admin/workspaces": "/organization/workspaces",
  "/app/admin/workspaces": "/organization/workspaces",

  "/people": "/people",
  "/organization/members": "/people",
  "/app/organization/members": "/people",
  "/members": "/people",
  "/app/members": "/people",
  "/admin/members": "/people",
  "/app/admin/members": "/people",

  "/organization/invitations": "/organization/invitations",
  "/app/organization/invitations": "/organization/invitations",
  "/invitations": "/organization/invitations",
  "/app/invitations": "/organization/invitations",
  "/admin/invitations": "/organization/invitations",
  "/app/admin/invitations": "/organization/invitations",

  "/organization/settings": "/organization/settings",
  "/app/organization/settings": "/organization/settings",
  "/settings/organization": "/organization/settings",
  "/app/settings/organization": "/organization/settings",
  "/settings": "/organization/settings",
  "/app/settings": "/organization/settings",
  "/admin/settings": "/organization/settings",
  "/app/admin/settings": "/organization/settings",

  "/organization/settings/product-access": "/organization/settings/product-access",
  "/app/organization/settings/product-access": "/organization/settings/product-access",
  "/settings/organization/product-access": "/organization/settings/product-access",
  "/app/settings/organization/product-access": "/organization/settings/product-access",
  "/organization/entitlements": "/organization/settings/product-access",
  "/app/organization/entitlements": "/organization/settings/product-access",
  "/entitlements": "/organization/settings/product-access",
  "/app/entitlements": "/organization/settings/product-access",
  "/admin/entitlements": "/organization/settings/product-access",
  "/app/admin/entitlements": "/organization/settings/product-access",


  "/organization/departments": "/workforce/departments",
  "/app/organization/departments": "/workforce/departments",

  "/workforce/dashboard": "/workforce/employees",
  "/app/workforce/dashboard": "/workforce/employees",

  "/payroll": "/payroll/runs",
  "/app/payroll": "/payroll/runs",
  "/payroll/dashboard": "/payroll/runs",
  "/app/payroll/dashboard": "/payroll/runs",
  "/payroll/pay-runs": "/payroll/runs",
  "/app/payroll/pay-runs": "/payroll/runs",
  "/payroll/runs": "/payroll/runs",
  "/app/payroll/runs": "/payroll/runs",

  "/finance": "/finance/overview",
  "/app/finance": "/finance/overview",

  "/platform": "/platform",
  "/app/platform": "/platform",
};

export function normalizePath(pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function splitLocation(input: string): { pathname: string; suffix: string } {
  const hashAt = input.indexOf("#");
  const hash = hashAt >= 0 ? input.slice(hashAt) : "";
  const beforeHash = hashAt >= 0 ? input.slice(0, hashAt) : input;
  const queryAt = beforeHash.indexOf("?");
  const search = queryAt >= 0 ? beforeHash.slice(queryAt) : "";
  const pathname = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
  return { pathname: normalizePath(pathname || "/"), suffix: search + hash };
}

/** Map a pathname to the route the application renders. Query and hash are not included. */
export function canonicalize(pathname: string): string {
  const path = normalizePath(pathname);
  const exact = EXACT_PATHS[path];
  if (exact) return exact;
  if (path.startsWith("/app/platform/")) return canonicalize(`/platform/${path.slice("/app/platform/".length)}`);
  if (path.startsWith("/app/")) return canonicalize(path.slice(4));
  if (path.startsWith("/admin/") || path.startsWith("/app/admin/")) return "/organization";
  if (path.startsWith("/payroll/pay-runs")) return `/payroll/runs${path.slice("/payroll/pay-runs".length)}`;
  return path.startsWith("/app") ? "/overview" : path;
}

export function legacyRedirects(): Array<{ from: string; to: string }> {
  return Object.keys(EXACT_PATHS)
    .filter((from) => from !== "/" && canonicalize(from) !== from)
    .map((from) => ({ from, to: canonicalize(from) }));
}

function platformHostPath(pathname: string): string {
  let path = normalizePath(pathname);
  if (path.startsWith("/app/platform")) path = `/platform${path.slice("/app/platform".length)}`;
  if (path === "/" || path === "/app" || path === "/overview" || path === "/platform") return "/";
  if (path === "/platform/access") return "/platform-access";
  if (path.startsWith("/platform/")) return path.slice("/platform".length) || "/";
  return "/";
}

/** Path used by links and programmatic navigation on the current host. */
export function appPath(input: string): string {
  const { pathname, suffix } = splitLocation(input);
  if (consoleHost() === "platform") return platformHostPath(pathname) + suffix;
  return canonicalize(pathname) + suffix;
}

/** Where a signed-in session continues. Local platform mode stays in the platform console. */
export function homePath(): string {
  if (consoleHost() === "platform") return "/";
  if (consoleHost() === "local" && session.mode() === "platform") return "/platform";
  return "/overview";
}

export function consoleUrl(target: "platform" | "client", context?: { organization?: string; workspace?: string }): string {
  const url = new URL(`https://${target === "platform" ? PLATFORM_HOST : CLIENT_HOST}/`);
  if (target === "client" && context?.organization) url.searchParams.set("organization", context.organization);
  if (target === "client" && context?.workspace) url.searchParams.set("workspace", context.workspace);
  return url.toString();
}
