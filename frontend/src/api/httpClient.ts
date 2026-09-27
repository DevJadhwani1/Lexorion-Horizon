import { ApiError } from "./types";
import { session, usesSharedSessionCookie } from "./session";

export interface RequestOptions extends Omit<RequestInit, "body"> { body?: unknown; authenticated?: boolean; organizationScoped?: boolean; workspaceScoped?: boolean; retryOnUnauthorized?: boolean; }
interface TokenResponse { accessToken: string; refreshToken: string | null; }
let refreshPromise: Promise<boolean> | null = null;
const authRequest = (path: string) => /^\/api\/(core|platform)\/auth\/(login|refresh|logout)$/.test(path);
const reportError=(error:ApiError)=>window.dispatchEvent(new CustomEvent("lexorion:api-error",{detail:error.message}));

async function refreshAccess(): Promise<boolean> {
  const refreshToken = session.refresh(); if (!refreshToken && !usesSharedSessionCookie()) return false;
  try {
    const response = await fetch("/api/core/auth/refresh", { method: "POST", credentials: usesSharedSessionCookie() ? "include" : "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(usesSharedSessionCookie() ? {} : { refreshToken }) });
    if (!response.ok) {
      if (response.status >= 500) throw new ApiError(response.status, "The authentication service is temporarily unavailable.");
      return false;
    }
    const tokens = await response.json() as TokenResponse; session.setTokens(tokens.accessToken, tokens.refreshToken ?? ""); return true;
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "The authentication service is unavailable. Try again.");
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, authenticated = true, organizationScoped = true, workspaceScoped = /^\/api\/(workforce|payroll)\//.test(path), retryOnUnauthorized = true, ...init } = options;
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
  catch (error) { if ((error as Error).name === "AbortError") throw error; const apiError=new ApiError(0,"The Lexorion API is unavailable. Check the Gateway and try again.");reportError(apiError);throw apiError; }
  if (response.status === 401 && authenticated && retryOnUnauthorized) {
    refreshPromise ??= refreshAccess().finally(() => { refreshPromise = null; });
    if (await refreshPromise) {
      const refreshedHeaders = new Headers(init.headers);
      if (body !== undefined) refreshedHeaders.set("Content-Type", "application/json");
      if (session.access()) refreshedHeaders.set("Authorization", `Bearer ${session.access()}`);
      if (authRequest(path) && usesSharedSessionCookie()) refreshedHeaders.delete("Authorization");
      if (organizationScoped && session.organization()) refreshedHeaders.set("X-Lexorion-Organization", session.organization()!);
      if (workspaceScoped && session.workspace()) refreshedHeaders.set("X-Lexorion-Workspace", session.workspace()!);
      response = await fetch(path, { ...init, credentials: usesSharedSessionCookie() ? "include" : init.credentials, headers: refreshedHeaders, body: requestBody });
    } else {
    session.clearTokens(); window.dispatchEvent(new Event("lexorion:session-expired"));
    }
  }
  if (!response.ok) {
    let details: unknown; try { details = await response.json(); } catch { details = undefined; }
    const fallback:Record<number,string>={400:"The request was invalid.",401:"Your session is no longer valid.",403:"You do not have access to this operation.",404:"The requested resource was not found.",409:"The request conflicts with the current resource state.",500:"The service encountered an unexpected error.",502:"The Gateway received an invalid response from a service.",503:"The requested service is temporarily unavailable."};
    const message = typeof details === "object" && details && "message" in details ? String((details as {message: unknown}).message) : fallback[response.status]??`Request failed (${response.status}).`;
    const apiError=new ApiError(response.status,message,details);reportError(apiError);throw apiError;
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  return response.json() as Promise<T>;
}
