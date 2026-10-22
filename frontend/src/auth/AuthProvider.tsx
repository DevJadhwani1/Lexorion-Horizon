import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getCurrentUser, getOrganizations, loginRequest, logoutRequest, restoreSession, saveLastUsedContext, type CurrentUser, type OrganizationMembership } from "./authApi";
import { session } from "../api/session";

interface AuthValue {
  loading: boolean;
  user: CurrentUser | null;
  organizations: OrganizationMembership[];
  organization: OrganizationMembership | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  selectOrganization(slug: string): void;
  rememberWorkspace(organizationSlug: string, workspaceKey: string): void;
  reloadOrganizations(): Promise<void>;
  /** Re-reads memberships (names, roles, statuses) without touching the session. Resolves false when the refresh failed. */
  refreshOrganizations(): Promise<boolean>;
}

const AuthContext = createContext<AuthValue | null>(null);
// Last-used context is a convenience; a failed save must never interrupt the selection itself.
const isActiveMembership = (item: OrganizationMembership) =>
  item.membershipStatus === "ACTIVE" && (item.organizationStatus === "ACTIVE" || item.organizationStatus === "TRIAL");
const persistContext = (organizationSlug: string, workspaceKey: string | null = null) => { void saveLastUsedContext(organizationSlug, workspaceKey).catch(() => undefined); };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [requestedWorkspace, setRequestedWorkspace] = useState<string | null>(() => new URLSearchParams(window.location.search).get("workspace"));
  const [requestedSlug, setRequestedSlug] = useState<string | null>(() => new URLSearchParams(window.location.search).get("organization"));
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [slug, setSlug] = useState(session.organization());
  // Server-remembered workspace per organization slug, kept in a ref so updates do not re-trigger workspace loading.
  const rememberedWorkspaces = useRef<Record<string, string | null>>({});

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    parameters.delete("organization"); parameters.delete("workspace");
    if (window.location.search) {
      const query = parameters.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, []);

  const load = useCallback(async () => {
    if (!session.access()) {
      let restored = false;
      try { restored = await restoreSession(); }
      catch {
        setUser(null); setOrganizations([]); setSlug(null); setLoading(false); return;
      }
      if (!restored) {
        setUser(null); setOrganizations([]); setSlug(null); setLoading(false); return;
      }
    }
    try {
      const [currentUser, memberships] = await Promise.all([getCurrentUser(), getOrganizations()]);
      const active = memberships.filter(isActiveMembership);
      const storedSlug = session.organization();
      const accessible = (candidate: string | null | undefined) => Boolean(candidate && active.some((item) => item.slug === candidate));
      const requested = accessible(requestedSlug) ? requestedSlug : null;
      // Precedence: explicit link, this tab's current selection, the server-remembered organization, then the sole membership.
      const remembered = accessible(currentUser.lastOrganizationSlug) ? currentUser.lastOrganizationSlug! : null;
      const selectedSlug = requested ?? (accessible(storedSlug)
        ? storedSlug
        : remembered ?? (active.length === 1 ? active[0].slug : null));
      rememberedWorkspaces.current = Object.fromEntries(active.map((item) => [item.slug, item.lastWorkspaceKey ?? null]));

      setUser(currentUser);
      setOrganizations(active);
      setSlug(selectedSlug);
      session.setOrganization(selectedSlug);
      if (selectedSlug !== storedSlug) session.setWorkspace(selectedSlug ? rememberedWorkspaces.current[selectedSlug] ?? null : null);
      // WorkspaceProvider verifies this key against the selected organization’s accessible workspaces.
      if (requested && requestedWorkspace) session.setWorkspace(requestedWorkspace);
      setRequestedWorkspace(null);
      // A tab refresh keeps its own selection without overwriting a newer choice made elsewhere.
      if (selectedSlug && selectedSlug !== storedSlug && selectedSlug !== currentUser.lastOrganizationSlug) persistContext(selectedSlug);
      if (requestedSlug) {
        const parameters = new URLSearchParams(window.location.search);
        parameters.delete("organization");
        const query = parameters.toString();
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
        setRequestedSlug(null);
      }
    } catch {
      session.setOrganization(null);
      session.setWorkspace(null);
      setUser(null);
      setOrganizations([]);
      setSlug(null);
    } finally {
      setLoading(false);
    }
  }, [requestedSlug, requestedWorkspace]);

  useEffect(() => {
    void load();
    const expired = () => {
      session.setOrganization(null);
      session.setWorkspace(null);
      setUser(null);
      setOrganizations([]);
      setSlug(null);
    };
    window.addEventListener("lexorion:session-expired", expired);
    return () => window.removeEventListener("lexorion:session-expired", expired);
  }, [load]);

  const login = async (email: string, password: string) => {
    const tokens = await loginRequest(email, password);
    session.setMode(null);
    session.setTokens(tokens.accessToken, tokens.refreshToken ?? "");
    setLoading(true);
    await load();
  };
  const logout = async () => {
    const token = session.refresh();
    try {
      await logoutRequest(token);
    } finally {
      session.clearTokens();
      session.setMode(null);
      session.setOrganization(null);
      session.setWorkspace(null);
      rememberedWorkspaces.current = {};
      setUser(null);
      setOrganizations([]);
      setSlug(null);
    }
  };
  const selectOrganization = (next: string) => {
    const selected = next || null;
    session.setOrganization(selected);
    // WorkspaceProvider verifies the remembered workspace against the organization's accessible workspaces.
    session.setWorkspace(selected ? rememberedWorkspaces.current[selected] ?? null : null);
    setSlug(selected);
    if (selected) persistContext(selected);
  };
  // Unlike reloadOrganizations, a failure here keeps the signed-in state; callers only lose a fresher display name.
  const refreshOrganizations = useCallback(async () => {
    try {
      setOrganizations((await getOrganizations()).filter(isActiveMembership));
      return true;
    } catch {
      return false;
    }
  }, []);
  const rememberWorkspace = (organizationSlug: string, workspaceKey: string) => {
    rememberedWorkspaces.current[organizationSlug] = workspaceKey;
    persistContext(organizationSlug, workspaceKey);
  };
  const value = useMemo(() => ({
    loading,
    user,
    organizations,
    organization: organizations.find((item) => item.slug === slug) ?? null,
    login,
    logout,
    selectOrganization,
    rememberWorkspace,
    reloadOrganizations: load,
    refreshOrganizations,
  }), [loading, user, organizations, slug, load, refreshOrganizations]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}

export function useOptionalAuth() {
  return useContext(AuthContext);
}
