import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAccessibleWorkspaces, type OrganizationWorkspace } from "../features/admin/workspaceApi";
import { getProductAccess } from "../core/coreApi";
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
  const scope = mode === "client" ? organization?.organizationId ?? null : null;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const requestVersion = useRef(0);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const requestScope = scope;
    const version = ++requestVersion.current;
    const isCurrent = () => currentScope.current === requestScope && requestVersion.current === version;
    const storedKey = session.workspace();
    setKey(storedKey);
    setError("");
    setWorkspaces([]);
    setLoadedScope(requestScope);
    if (mode !== "client" || !organization) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const products = await getProductAccess(organization.organizationId);
      if (!isCurrent()) return;
      if (!products.some((product) => product.productKey === "horizon")) {
        setWorkspaces([]);
        session.setWorkspace(null);
        setKey(null);
        setError("Horizon access is not active for this organization.");
        return;
      }
      const items = await getAccessibleWorkspaces();
      if (!isCurrent()) return;
      setWorkspaces(items);
      if (storedKey && !items.some((item) => item.key === storedKey)) {
        session.setWorkspace(null);
        setKey(null);
      }
    } catch (reason) {
      if (!isCurrent()) return;
      setWorkspaces([]);
      setError(reason instanceof ApiError ? reason.message : "Unable to load workspaces.");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [mode, organization, scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectWorkspace = (next: string) => {
    const selected = loadedScope === scope && workspaces.some(item => item.key === next) ? next : null;
    session.setWorkspace(selected);
    setKey(selected);
  };
  const value = useMemo(() => ({
    loading: scope !== loadedScope || loading,
    error: scope === loadedScope ? error : "",
    workspaces: scope === loadedScope ? workspaces : [],
    workspace: scope === loadedScope ? workspaces.find((item) => item.key === key) ?? null : null,
    selectWorkspace,
    reload,
  }), [loading, error, workspaces, key, reload, scope, loadedScope]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}
