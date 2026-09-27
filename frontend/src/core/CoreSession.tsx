import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { loginRequest, logoutRequest, restoreSession } from "../auth/authApi";
import { session } from "../api/session";
import { ApiError } from "../api/types";
import { coreRequest, type CoreIdentity } from "./consoleApi";

export type CoreAuthState = "loading" | "anonymous" | "authenticated" | "credential-error";
interface CoreSessionValue { identity: CoreIdentity | null; state: CoreAuthState; loading: boolean; error: string; reload(): Promise<void>; login(email: string, password: string): Promise<void>; logout(): Promise<void> }
const Context = createContext<CoreSessionValue | null>(null);
export function CoreSessionProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<CoreIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<CoreAuthState>("loading");
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true); setState("loading"); setError("");
    try {
      if (!session.access()) {
        const restored = await restoreSession();
        if (!restored) { setIdentity(null); setState("anonymous"); return; }
      }
      const value = await coreRequest<CoreIdentity>("/me"); setIdentity(value); setState("authenticated");
    } catch (reason) {
      setIdentity(null); setError(reason instanceof Error ? reason.message : "Unable to restore session.");
      if (reason instanceof ApiError && reason.status === 401 && !session.access()) setState("anonymous");
      else setState("credential-error");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void reload();
    const expired = () => { setIdentity(null); setState("anonymous"); setLoading(false); setError("Your session expired. Sign in again."); };
    window.addEventListener("lexorion:session-expired", expired);
    return () => window.removeEventListener("lexorion:session-expired", expired);
  }, [reload]);
  async function login(email: string, password: string) {
    const tokens = await loginRequest(email, password);
    session.setTokens(tokens.accessToken, tokens.refreshToken ?? "");
    try { setIdentity(await coreRequest<CoreIdentity>("/me")); setState("authenticated"); setError(""); }
    catch (reason) {
      setIdentity(null); setError(reason instanceof Error ? reason.message : "Unable to verify your Core identity.");
      setState(session.access() ? "credential-error" : "anonymous");
      if (!session.access()) throw reason;
    }
  }
  async function logout() {
    try { const refresh = session.refresh(); if (refresh) await logoutRequest(refresh); }
    finally { session.clearTokens(); setIdentity(null); setState("anonymous"); setLoading(false); setError(""); }
  }
  return <Context.Provider value={{ identity, state, loading, error, reload, login, logout }}>{children}</Context.Provider>;
}
export function useCoreSession() { const value = useContext(Context); if (!value) throw new Error("CoreSessionProvider is required"); return value; }
