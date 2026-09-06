export const PLATFORM_HOST = "admin.horizon.lexorion.in";
export const CLIENT_HOST = "horizon.lexorion.in";

export type ConsoleHost = "platform" | "client" | "local";

export function consoleHost(hostname = window.location.hostname): ConsoleHost {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === PLATFORM_HOST) return "platform";
  if (normalized === CLIENT_HOST) return "client";
  return "local";
}

export function appPath(canonicalPath: string): string {
  const host = consoleHost();
  if (host === "local") return canonicalPath;
  if (host === "platform") {
    if (canonicalPath === "/app/platform") return "/";
    if (canonicalPath === "/app/platform/access") return "/platform-access";
    if (canonicalPath.startsWith("/app/platform/")) return canonicalPath.slice("/app/platform".length);
    return "/";
  }
  if (canonicalPath === "/app") return "/";
  const administration: Record<string, string> = {
    "/app/admin/organization": "/organization",
    "/app/admin/members": "/members",
    "/app/admin/invitations": "/invitations",
    "/app/admin/settings": "/settings",
    "/app/admin/workspaces": "/workspaces",
    "/app/admin/entitlements": "/entitlements",
  };
  return administration[canonicalPath] ?? (canonicalPath.startsWith("/app/") ? canonicalPath.slice(4) : canonicalPath);
}

export function consoleUrl(target: "platform" | "client", context?: { organization?: string; workspace?: string }): string {
  const url = new URL(`https://${target === "platform" ? PLATFORM_HOST : CLIENT_HOST}/`);
  if (target === "client" && context?.organization) url.searchParams.set("organization", context.organization);
  if (target === "client" && context?.workspace) url.searchParams.set("workspace", context.workspace);
  return url.toString();
}
