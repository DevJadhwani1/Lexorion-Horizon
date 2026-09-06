import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Page";
import { useApplicationContext } from "../context/ApplicationContext";
import { appPath, consoleHost, consoleUrl } from "../app/hostRouting";


import { Icon, type IconName } from "./SidebarIcon";
import { Sidebar, type SidebarGroup } from "./Sidebar";

type NavEntry = readonly [path: string, label: string, icon: IconName];
const administration: readonly NavEntry[] = [
  ["organization", "Organization", "building"], ["members", "Members", "profile"],
  ["invitations", "Invitations", "admin"], ["settings", "Settings", "settings"],
];
const organizationWorkspaces: readonly NavEntry[] = [["workspaces", "Workspaces", "panels"]];
const workforceAdmin: readonly NavEntry[] = [
  ["dashboard", "Dashboard", "workforce"], ["employees", "Employees", "profile"],
  ["departments", "Departments", "workforce"], ["designations", "Designations", "workforce"],
  ["structure", "Structure", "workforce"], ["me", "My profile", "profile"], ["team", "My team", "profile"],
];
const payroll: readonly NavEntry[] = [
  ["dashboard", "Dashboard", "payroll"], ["employees", "Employees", "profile"],
  ["components", "Components", "payroll"], ["compensation", "Compensation", "payroll"],
  ["salary-templates", "Salary templates", "payroll"], ["calculations", "Calculations", "payroll"],
  ["pay-runs", "Pay runs", "payroll"], ["ledger", "Ledger", "payroll"], ["payslips", "Payslips", "payroll"],
];
const platformPrimary: readonly NavEntry[] = [["", "Overview", "home"], ["organizations", "Organizations", "building"], ["users", "Users", "workforce"], ["access", "Platform Access", "shield"]];
const platformCatalog: readonly NavEntry[] = [["products", "Products", "package"], ["plans", "Plans", "card"], ["entitlements", "Entitlements", "badge"]];
const platformOperations: readonly NavEntry[] = [["workspaces", "Workspaces", "panels"]];
const platformSystem: readonly NavEntry[] = [["settings", "Settings", "settings"]];

export function AppShell() {
  const auth = useAuth(), workspace = useWorkspace(), navigate = useNavigate(), location = useLocation();
  const application = useApplicationContext();
  const [apiError, setApiError] = useState(""), [collapsed, setCollapsed] = useState(() => { try { return sessionStorage.getItem("lexorion.sidebar-collapsed") === "true" || (sessionStorage.getItem("lexorion.sidebar-collapsed") === null && window.innerWidth <= 1100); } catch { return false; } }), [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const show = (event: Event) => setApiError((event as CustomEvent<string>).detail);
    window.addEventListener("lexorion:api-error", show);
    return () => window.removeEventListener("lexorion:api-error", show);
  }, []);
  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 801px)");
    const closeOnDesktop = () => { if (desktop.matches) setDrawerOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!drawerOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [drawerOpen]);

  const role = auth.organization?.membershipRole, adminRole = role === "ADMIN";
  const workforce = adminRole ? workforceAdmin : role === "MANAGER"
    ? workforceAdmin.filter(([key]) => key === "me" || key === "team")
    : workforceAdmin.filter(([key]) => key === "me");
  const initials = `${auth.user?.firstName?.[0] ?? ""}${auth.user?.lastName?.[0] ?? ""}` || "L";
  const groups: SidebarGroup[] = [];
  const addGroup = (label: string, base: string, entries: readonly NavEntry[]) => groups.push({ label, items: entries.map(([path, text, icon]) => ({ to: appPath(`/app/${base}/${path}`.replace(/\/$/, "")), label: text, icon })) });
  if (application.mode === "platform") {
    addGroup("Platform", "platform", platformPrimary);
    addGroup("Catalog", "platform", platformCatalog);
    addGroup("Operations", "platform", platformOperations);
    addGroup("System", "platform", platformSystem);
  }
  if (application.mode === "client") {
    groups.push({ label: "", items: [{ to: appPath("/app"), label: "Overview", icon: "home" }] });
    if (adminRole) addGroup("Organization", "admin", administration);
    if (adminRole) addGroup("Workspaces", "admin", organizationWorkspaces);
    if (role && workspace.workspace?.products.some(product => product.key === "workforce")) addGroup("Workforce", "workforce", workforce);
    if (adminRole && workspace.workspace?.products.some(product => product.key === "payroll")) addGroup("Payroll", "payroll", payroll);
  }
  const toggleSidebar = () => setCollapsed((value) => {
    try { sessionStorage.setItem("lexorion.sidebar-collapsed", String(!value)); } catch { /* Storage may be unavailable. */ }
    return !value;
  });

  return (
    <div className={`shell ${application.mode === "platform" ? "platform-shell" : ""} ${collapsed ? "sidebar-collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
      <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
      <Sidebar platform={application.mode === "platform"} key={`${auth.user?.id}:${application.mode}:${auth.organization?.slug}:${workspace.workspace?.key}`} groups={groups} collapsed={collapsed} drawerOpen={drawerOpen}
        onToggle={toggleSidebar} onClose={() => setDrawerOpen(false)} initials={initials.toUpperCase()}
        userName={`${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim()}
        accountInfo={application.mode === "platform" ? "Platform Access" : auth.organization?.organizationName ?? auth.user?.email ?? "Account"}
        onLogout={() => void auth.logout()} />
      <div className="stage" inert={drawerOpen}>
        <header className="topbar">
          <button className="sidebar-trigger" type="button" aria-label="Open navigation" aria-controls="application-sidebar"
            aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>
          <span className="topbar-title">{application.mode === "platform" ? "Platform Console" : "Horizon"}</span>
          <div className="context-selectors">
            {application.mode === "client" && <><label><span>Organization</span>
              <select aria-label="Organization" value={auth.organization?.slug ?? ""} onChange={(event) => { auth.selectOrganization(event.target.value); navigate(appPath("/app")); }}>
                <option value="">Choose organization</option>
                {auth.organizations.map((item) => <option key={item.slug} value={item.slug}>{item.organizationName}</option>)}
              </select>
            </label>
            <label><span>Workspace</span>
              <select aria-label="Workspace" disabled={!auth.organization || workspace.loading} value={workspace.workspace?.key ?? ""}
                onChange={(event) => { workspace.selectWorkspace(event.target.value); navigate(appPath("/app")); }}>
                <option value="">Choose workspace</option>
                {workspace.workspaces.map((item) => <option key={item.key} value={item.key}>{item.displayName} · {item.products.map(product => product.displayName).join(", ")}</option>)}
              </select>
            </label></>}
            {application.mode === "platform" && <Button size="sm" onClick={() => { if (consoleHost() === "platform") window.location.assign(consoleUrl("client")); else { application.enterClient(); navigate("/app"); } }}>Client application</Button>}
            {application.mode === "client" && application.hasPlatformAccess && <Button size="sm" onClick={() => { if (consoleHost() === "client") window.location.assign(consoleUrl("platform")); else { application.enterPlatform(); navigate("/app"); } }}>Platform</Button>}
          </div>
          <span className="topbar-avatar" aria-hidden="true">{initials.toUpperCase()}</span>
        </header>
        <main>
          {apiError && <div className="dismissible"><Notice>{apiError}</Notice><Button size="sm" onClick={() => setApiError("")}>Dismiss</Button></div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
