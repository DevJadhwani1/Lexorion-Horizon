export const CORE_HOST = "core.lexorion.in";
export function isCoreConsole(hostname = window.location.hostname, pathname = window.location.pathname) {
  return hostname.toLowerCase() === CORE_HOST || (["localhost", "127.0.0.1"].includes(hostname) && /^\/core(?:\/|$)/.test(pathname));
}
export function coreBase(hostname = window.location.hostname) { return hostname.toLowerCase() === CORE_HOST ? "/" : "/core"; }
