import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAccessibleWorkspaces, type OrganizationWorkspace } from "../features/admin/workspaceApi";
import { ApiError } from "../api/types";
import { session } from "../api/session";
import { useAuth } from "../auth/AuthProvider";
import { useApplicationContext } from "../context/ApplicationContext";

interface Value {
  loading: boolean;
  error: string;
  workspaces: OrganizationWorkspace[];
  workspace: OrganizationWorkspace | null;
  selectWorkspace(key: string): void;
  reload(): Promise<void>;
}

const Context = createContext<Value | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { organization } = useAuth();
  const { mode } = useApplicationContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<OrganizationWorkspace[]>([]);
  const [key, setKey] = useState(session.workspace());

  const reload = useCallback(async () => {
    const storedKey = session.workspace();
    setKey(storedKey);
    setError("");
    if (mode !== "client" || !organization) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const items = await getAccessibleWorkspaces();
      setWorkspaces(items);
      if (storedKey && !items.some((item) => item.key === storedKey)) {
        session.setWorkspace(null);
        setKey(null);
      }
    } catch (reason) {
      setWorkspaces([]);
      setError(reason instanceof ApiError ? reason.message : "Unable to load workspaces.");
    } finally {
      setLoading(false);
    }
  }, [mode, organization]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectWorkspace = (next: string) => {
    const selected = next || null;
    session.setWorkspace(selected);
    setKey(selected);
  };
  const value = useMemo(() => ({
    loading,
    error,
    workspaces,
    workspace: workspaces.find((item) => item.key === key) ?? null,
    selectWorkspace,
    reload,
  }), [loading, error, workspaces, key, reload]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}
