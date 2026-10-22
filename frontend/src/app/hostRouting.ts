export const CLIENT_HOST = "horizon.lexorion.in";
export const PLATFORM_HOST = "admin.horizon.lexorion.in";

export type ConsoleHost = "platform" | "client" | "local";

export function consoleHost(hostname = window.location.hostname): ConsoleHost {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === PLATFORM_HOST) return "platform";
  if (normalized === CLIENT_HOST) return "client";
  return "local";
}

const ORG_CANONICAL_MAP: Record<string, string> = {
  "/organization": "/organization",
  "/organization/workspaces": "/organization/workspaces",
  "/organization/members": "/organization/members",
  "/organization/invitations": "/organization/invitations",
  "/organization/settings": "/organization/settings",
  "/organization/settings/product-access": "/organization/settings/product-access",
  "/organization/entitlements": "/organization/settings/product-access",
  "/app/admin/organization": "/organization",
  "/app/admin/workspaces": "/organization/workspaces",
  "/app/admin/members": "/organization/members",
  "/app/admin/invitations": "/organization/invitations",
  "/app/admin/settings": "/organization/settings",
  "/app/admin/entitlements": "/organization/settings/product-access",
  "/app/admin": "/organization",
  "/admin/organization": "/organization",
  "/admin/workspaces": "/organization/workspaces",
  "/admin/members": "/organization/members",
  "/admin/invitations": "/organization/invitations",
  "/admin/settings": "/organization/settings",
  "/admin/entitlements": "/organization/settings/product-access",
  "/admin": "/organization",
  "/app/organization": "/organization",
  "/app/organization/workspaces": "/organization/workspaces",
  "/app/organization/members": "/organization/members",
  "/app/organization/invitations": "/organization/invitations",
  "/app/organization/settings": "/organization/settings",
  "/app/organization/entitlements": "/organization/settings/product-access",
  "/workspaces": "/organization/workspaces",
  "/members": "/organization/members",
  "/invitations": "/organization/invitations",
  "/settings": "/organization/settings",
  "/entitlements": "/organization/settings/product-access",
};

export function appPath(canonicalPath: string): string {
  const host = consoleHost();
  if (host === "platform") {
    if (canonicalPath === "/app/platform") return "/";
    if (canonicalPath === "/app/platform/access") return "/platform-access";
    if (canonicalPath.startsWith("/app/platform/")) return canonicalPath.slice("/app/platform".length);
    return "/";
  }

  const mappedOrg = ORG_CANONICAL_MAP[canonicalPath];
  if (mappedOrg) {
    return host === "local" ? `/app${mappedOrg}` : mappedOrg;
  }

  if (host === "local") return canonicalPath;
  if (canonicalPath === "/app") return "/";
  return canonicalPath.startsWith("/app/") ? canonicalPath.slice(4) : canonicalPath;
}

export function consoleUrl(target: "platform" | "client", context?: { organization?: string; workspace?: string }): string {
  const url = new URL(`https://${target === "platform" ? PLATFORM_HOST : CLIENT_HOST}/`);
  if (target === "client" && context?.organization) url.searchParams.set("organization", context.organization);
  if (target === "client" && context?.workspace) url.searchParams.set("workspace", context.workspace);
  return url.toString();
}
