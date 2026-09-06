import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { session } from "../api/session";
import { useAuth } from "../auth/AuthProvider";
import { consoleHost } from "../app/hostRouting";

export type ApplicationMode = "platform" | "client";

interface ApplicationContextValue {
  mode: ApplicationMode;
  hasPlatformAccess: boolean;
  enterPlatform(): void;
  enterClient(): void;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function ApplicationContextProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const hasPlatformAccess = Boolean(auth.user?.platformAccess?.active);
  const hostMode = consoleHost();
  const [mode, setMode] = useState<ApplicationMode>(() => hostMode === "platform" ? "platform" : "client");

  useEffect(() => {
    if (!auth.user) {
      if (!auth.loading) {
        session.setMode(null);
        setMode("client");
      }
      return;
    }
    const stored = session.mode();
    const resolved: ApplicationMode = hostMode === "platform" ? "platform" : hostMode === "client" ? "client" : hasPlatformAccess && stored !== "client" ? "platform" : "client";
    session.setMode(resolved);
    setMode(resolved);
  }, [auth.loading, auth.user, hasPlatformAccess, hostMode]);

  const select = (next: ApplicationMode) => {
    session.setMode(next);
    setMode(next);
  };
  const value = useMemo(() => ({
    mode,
    hasPlatformAccess,
    enterPlatform: () => select("platform"),
    enterClient: () => select("client"),
  }), [mode, hasPlatformAccess]);

  return <ApplicationContext.Provider value={value}>{children}</ApplicationContext.Provider>;
}

export function useApplicationContext() {
  const value = useContext(ApplicationContext);
  if (!value) throw new Error("ApplicationContextProvider is required");
  return value;
}
