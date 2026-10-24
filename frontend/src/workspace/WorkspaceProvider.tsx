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
  /** Reloads accessible workspaces. Resolves with the confirmed list, or null when the load failed or was superseded. */
  reload(options?: { select?: string }): Promise<OrganizationWorkspace[] | null>;
}

const Context = createContext<Value | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { organization, rememberWorkspace } = useAuth();
  const { mode } = useApplicationContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [workspaces, setWorkspaces] = useState<OrganizationWorkspace[]>([]);
  const [key, setKey] = useState(session.workspace());
  // Depend on identity, not the membership object: a renamed organization must not reload workspace access.
  const organizationId = organization?.organizationId ?? null, organizationSlug = organization?.slug ?? null;
  const scope = mode === "client" ? organizationId : null;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const requestVersion = useRef(0);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  // Latest confirmed list, read by selection so a caller holding an older render cannot select against stale data.
  const loaded = useRef<{ scope: string | null; items: OrganizationWorkspace[] }>({ scope: null, items: [] });

  const select = (next: string | null) => {
    const { scope: listScope, items } = loaded.current;
    const selected = next && listScope === currentScope.current && items.some((item) => item.key === next) ? next : null;
    session.setWorkspace(selected);
    setKey(selected);
    if (selected && organizationSlug) rememberWorkspace(organizationSlug, selected);
  };

  const reload = useCallback(async (options: { select?: string } = {}): Promise<OrganizationWorkspace[] | null> => {
    const requestScope = scope;
    const version = ++requestVersion.current;
    const isCurrent = () => currentScope.current === requestScope && requestVersion.current === version;
    const storedKey = session.workspace();
    setKey(storedKey);
    setError("");
    setWorkspaces([]);
    setLoadedScope(requestScope);
    loaded.current = { scope: requestScope, items: [] };
    if (mode !== "client" || !organizationId) {
      setWorkspaces([]);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const products = await getProductAccess(organizationId);
      if (!isCurrent()) return null;
      if (!products.some((product) => product.productKey === "horizon")) {
        setWorkspaces([]);
        session.setWorkspace(null);
        setKey(null);
        setError("Horizon access is not active for this organization.");
        return null;
      }
      const items = await getAccessibleWorkspaces();
      if (!isCurrent()) return null;
      loaded.current = { scope: requestScope, items };
      setWorkspaces(items);
      if (options.select && items.some((item) => item.key === options.select)) select(options.select);
      else if (storedKey && !items.some((item) => item.key === storedKey)) {
        session.setWorkspace(null);
        setKey(null);
      }
      // With exactly one accessible workspace there is nothing to choose. Only a server-returned key is selected.
      if (items.length === 1 && session.workspace() !== items[0].key) select(items[0].key);
      return items;
    } catch (reason) {
      if (!isCurrent()) return null;
      setWorkspaces([]);
      setError(reason instanceof ApiError ? reason.message : "Unable to load workspaces.");
      return null;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [mode, organizationId, organizationSlug, scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectWorkspace = (next: string) => select(next);
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

export function useOptionalWorkspace() {
  return useContext(Context);
}

