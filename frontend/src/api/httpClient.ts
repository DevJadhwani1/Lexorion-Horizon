import { ApiError } from "./types";
import { session, usesSharedSessionCookie } from "./session";

export interface RequestOptions extends Omit<RequestInit, "body"> { body?: unknown; authenticated?: boolean; organizationScoped?: boolean; workspaceScoped?: boolean; retryOnUnauthorized?: boolean;
  /** Statuses the caller handles itself (for example 404 when checking whether a record exists). They still throw, but are not shown as global errors. */
  expectedStatuses?: number[]; }
interface TokenResponse { accessToken: string; refreshToken: string | null; }
let refreshPromise: Promise<boolean> | null = null;
const authRequest = (path: string) => /^\/api\/(core|platform)\/auth\/(login|refresh|logout)$/.test(path);
const reportError=(error:ApiError)=>window.dispatchEvent(new CustomEvent("lexorion:api-error",{detail:error.message}));
const FALLBACK: Record<number, string> = {
  0: "Horizon could not reach the service. Try again.",
  400: "The request was invalid.",
  401: "Your session is no longer valid. Sign in again.",
  403: "You do not have access to this operation.",
  404: "The requested record was not found.",
  409: "This conflicts with the current record. Refresh and try again.",
  500: "Horizon could not complete that request. Try again.",
  502: "Horizon could not complete that request. Try again.",
  503: "Horizon is temporarily unavailable. Try again.",
};
const INFRASTRUCTURE = /gateway|eureka|sql|exception|stack trace|x-lexorion|127\.0\.0\.1:\d+|localhost:\d{4}/i;
function customerMessage(status: number, details?: unknown): string {
  const fallback = FALLBACK[status] ?? "Horizon could not complete that request. Try again.";
  const raw = typeof details === "object" && details && "message" in details ? String((details as { message: unknown }).message).trim() : "";
  return raw && !INFRASTRUCTURE.test(raw) ? raw : fallback;
}

async function refreshAccess(): Promise<boolean> {
  const accessToken = session.access(), refreshToken = session.refresh(); if (!refreshToken && !usesSharedSessionCookie()) return false;
  try {
    const response = await fetch("/api/core/auth/refresh", { method: "POST", credentials: usesSharedSessionCookie() ? "include" : "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(usesSharedSessionCookie() ? {} : { refreshToken }) });
    if (!response.ok) {
      if (response.status >= 500) throw new ApiError(response.status, "The authentication service is temporarily unavailable.");
      return false;
    }
    const tokens = await response.json() as TokenResponse;
    if (session.access() !== accessToken || session.refresh() !== refreshToken) throw new DOMException("Session changed during refresh.", "AbortError");
    session.setTokens(tokens.accessToken, tokens.refreshToken ?? ""); return true;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "The authentication service is unavailable. Try again.");
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, authenticated = true, organizationScoped = true, workspaceScoped = /^\/api\/(workforce|payroll|finance)\//.test(path), retryOnUnauthorized = true, expectedStatuses = [], ...init } = options;
  // Capture the request's tenant context once. Never replay a mutation in a newly selected workspace.
  const version = session.contextVersion(), organization = session.organization(), workspace = session.workspace();
  const assertContext = () => {
    if (authenticated && (organizationScoped || workspaceScoped) &&
        (version !== session.contextVersion() || (organizationScoped && organization !== session.organization()) || (workspaceScoped && workspace !== session.workspace())))
      throw new DOMException("Workspace changed. Continue in the selected workspace.", "AbortError");
  };
  const headers = new Headers(init.headers);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (authenticated && session.access()) headers.set("Authorization", `Bearer ${session.access()}`);
  if (authRequest(path) && usesSharedSessionCookie()) headers.delete("Authorization");
  if (organizationScoped && session.organization()) headers.set("X-Lexorion-Organization", session.organization()!);
  if (workspaceScoped && session.workspace()) headers.set("X-Lexorion-Workspace", session.workspace()!);
  let response: Response;
  const requestBody = body === undefined ? undefined : JSON.stringify(body);
  const request = () => fetch(path, { ...init, credentials: usesSharedSessionCookie() ? "include" : init.credentials, headers, body: requestBody });
  try { response = await request(); }
  catch (error) { if ((error as Error).name === "AbortError") throw error; assertContext(); const apiError=new ApiError(0,customerMessage(0));reportError(apiError);throw apiError; }
  assertContext();
  if (response.status === 401 && authenticated && retryOnUnauthorized) {
    refreshPromise ??= refreshAccess().finally(() => { refreshPromise = null; });
    if (await refreshPromise) {
      assertContext();
      const refreshedHeaders = new Headers(headers);
      if (session.access()) refreshedHeaders.set("Authorization", `Bearer ${session.access()}`);
      if (authRequest(path) && usesSharedSessionCookie()) refreshedHeaders.delete("Authorization");
      response = await fetch(path, { ...init, credentials: usesSharedSessionCookie() ? "include" : init.credentials, headers: refreshedHeaders, body: requestBody });
    } else {
    assertContext(); session.clearTokens(); window.dispatchEvent(new Event("lexorion:session-expired"));
    }
  }
  assertContext();
  if (!response.ok) {
    let details: unknown; try { details = await response.json(); } catch { details = undefined; }
    assertContext();
    const message = customerMessage(response.status, details);
    const apiError=new ApiError(response.status,message,details);if(!expectedStatuses.includes(response.status))reportError(apiError);throw apiError;
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  const result = await response.json() as T;
  assertContext();
  return result;
}
