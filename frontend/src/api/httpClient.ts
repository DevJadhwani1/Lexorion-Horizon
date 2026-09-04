import { ApiError } from "./types";
import { session } from "./session";

export interface RequestOptions extends Omit<RequestInit, "body"> { body?: unknown; authenticated?: boolean; organizationScoped?: boolean; workspaceScoped?: boolean; retryOnUnauthorized?: boolean; }
interface TokenResponse { accessToken: string; refreshToken: string; }
let refreshPromise: Promise<boolean> | null = null;
const reportError=(error:ApiError)=>window.dispatchEvent(new CustomEvent("lexorion:api-error",{detail:error.message}));

async function refreshAccess(): Promise<boolean> {
  const refreshToken = session.refresh(); if (!refreshToken) return false;
  try {
    const response = await fetch("/api/platform/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refreshToken }) });
    if (!response.ok) return false;
    const tokens = await response.json() as TokenResponse; session.setTokens(tokens.accessToken, tokens.refreshToken); return true;
  } catch { return false; }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, authenticated = true, organizationScoped = true, workspaceScoped = /^\/api\/(workforce|payroll)\//.test(path), retryOnUnauthorized = true, ...init } = options;
  const headers = new Headers(init.headers);
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (authenticated && session.access()) headers.set("Authorization", `Bearer ${session.access()}`);
  if (organizationScoped && session.organization()) headers.set("X-Lexorion-Organization", session.organization()!);
  if (workspaceScoped && session.workspace()) headers.set("X-Lexorion-Workspace", session.workspace()!);
  let response: Response;
  try { response = await fetch(path, { ...init, headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
  catch (error) { if ((error as Error).name === "AbortError") throw error; const apiError=new ApiError(0,"The Horizon API is unavailable. Check the Gateway and try again.");reportError(apiError);throw apiError; }
  if (response.status === 401 && authenticated && retryOnUnauthorized) {
    refreshPromise ??= refreshAccess().finally(() => { refreshPromise = null; });
    if (await refreshPromise) return apiRequest<T>(path, { ...options, retryOnUnauthorized: false });
    session.clearTokens(); window.dispatchEvent(new Event("lexorion:session-expired"));
  }
  if (!response.ok) {
    let details: unknown; try { details = await response.json(); } catch { details = undefined; }
    const fallback:Record<number,string>={400:"The request was invalid.",401:"Your session is no longer valid.",403:"You do not have access to this operation.",404:"The requested resource was not found.",409:"The request conflicts with the current resource state.",500:"The service encountered an unexpected error.",502:"The Gateway received an invalid response from a service.",503:"The requested service is temporarily unavailable."};
    const message = typeof details === "object" && details && "message" in details ? String((details as {message: unknown}).message) : fallback[response.status]??`Request failed (${response.status}).`;
    const apiError=new ApiError(response.status,message,details);reportError(apiError);throw apiError;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
