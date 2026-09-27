import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentUser, getOrganizations, loginRequest, logoutRequest, restoreSession, type CurrentUser, type OrganizationMembership } from "./authApi";
import { session } from "../api/session";

interface AuthValue {
  loading: boolean;
  user: CurrentUser | null;
  organizations: OrganizationMembership[];
  organization: OrganizationMembership | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  selectOrganization(slug: string): void;
  reloadOrganizations(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [requestedSlug, setRequestedSlug] = useState<string | null>(() => new URLSearchParams(window.location.search).get("organization"));
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [slug, setSlug] = useState(session.organization());

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const workspace = parameters.get("workspace");
    parameters.delete("organization"); parameters.delete("workspace");
    if (workspace) session.setWorkspace(workspace);
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
      const active = memberships.filter((item) => item.membershipStatus === "ACTIVE" && item.organizationStatus === "ACTIVE");
      const storedSlug = session.organization();
      const requested = requestedSlug && active.some((item) => item.slug === requestedSlug) ? requestedSlug : null;
      const selectedSlug = requested ?? (storedSlug && active.some((item) => item.slug === storedSlug)
        ? storedSlug
        : active.length === 1 ? active[0].slug : null);

      setUser(currentUser);
      setOrganizations(active);
      setSlug(selectedSlug);
      session.setOrganization(selectedSlug);
      if (selectedSlug !== storedSlug) session.setWorkspace(null);
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
  }, [requestedSlug]);

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
      setUser(null);
      setOrganizations([]);
      setSlug(null);
    }
  };
  const selectOrganization = (next: string) => {
    const selected = next || null;
    session.setOrganization(selected);
    session.setWorkspace(null);
    setSlug(selected);
  };
  const value = useMemo(() => ({
    loading,
    user,
    organizations,
    organization: organizations.find((item) => item.slug === slug) ?? null,
    login,
    logout,
    selectOrganization,
    reloadOrganizations: load,
  }), [loading, user, organizations, slug, load]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
