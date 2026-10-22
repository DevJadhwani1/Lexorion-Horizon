import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { HorizonWorkflowNav } from "../components/HorizonWorkflowNav";
import { Button } from "../components/ui/Button";
import { Notice } from "../components/ui/Page";
import { useApplicationContext } from "../context/ApplicationContext";
import { appPath, consoleHost, consoleUrl } from "../app/hostRouting";


import { Icon, type IconName } from "./SidebarIcon";
import { Sidebar, type SidebarGroup } from "./Sidebar";

type NavEntry = readonly [path: string, label: string, icon: IconName];
const administration: readonly NavEntry[] = [
  ["/organization", "Organization", "building"],
  ["/organization/workspaces", "Workspaces", "panels"],
  ["/organization/members", "Members", "profile"],
  ["/organization/invitations", "Invitations", "admin"],
  ["/organization/settings", "Settings", "settings"],
];
const workforceAdmin: readonly NavEntry[] = [
  ["employees", "Employees", "profile"], ["departments", "Departments", "workforce"],
  ["designations", "Designations", "workforce"], ["structure", "Reporting structure", "workforce"],
];
const workforceSelf: readonly NavEntry[] = [["me", "My profile", "profile"], ["team", "My team", "workforce"]];
const payroll: readonly NavEntry[] = [
  ["pay-runs", "Pay runs", "payroll"], ["employees", "Payroll employees", "profile"],
  ["compensation", "Compensation", "payroll"], ["components", "Salary components", "payroll"],
  ["salary-templates", "Salary templates", "payroll"], ["payslips", "Payslips", "payroll"],
  ["ledger", "Payroll ledger", "payroll"], ["calculations", "Pay preview", "payroll"],
];
const finance: readonly NavEntry[] = [
  ["overview", "Billing overview", "grid"], ["invoices", "Invoices", "document"],
  ["clients", "Clients", "building"], ["payments", "Payments received", "card"],
  ["templates", "Invoice templates", "layers"],
];
const platformPrimary: readonly NavEntry[] = [["", "Overview", "home"], ["organizations", "Organizations", "building"], ["users", "Users", "workforce"], ["access", "Platform Access", "shield"]];
const platformCatalog: readonly NavEntry[] = [["products", "Products", "package"], ["plans", "Plans", "card"], ["entitlements", "Entitlements", "badge"]];
const platformOperations: readonly NavEntry[] = [["workspaces", "Workspaces", "panels"]];
const platformSystem: readonly NavEntry[] = [["settings", "Settings", "settings"]];

import { AppSwitcher } from "./AppSwitcher";
import { ContextSelector } from "./ContextSelector";
import { AccountMenu } from "./AccountMenu";
import { OnboardingTopBar } from "../features/onboarding/OnboardingTopBar";
import { HelpModal } from "../features/onboarding/HelpModal";
import { OnboardingProvider, useOnboardingContext } from "../features/onboarding/OnboardingContext";

export function AppShell() {
  return (
    <OnboardingProvider>
      <AppShellInner />
    </OnboardingProvider>
  );
}

function AppShellInner() {
  const auth = useAuth(), workspace = useWorkspace(), navigate = useNavigate(), location = useLocation();
  // Organization administration reloads workspace access itself. Do not discard its forms during that refresh.
  const organizationAdministration = /^\/(?:(?:app\/)?(?:admin|organization)(?:\/|$)|(?:app\/)?(?:members|invitations|settings|entitlements|workspaces)(?:\/|$))/.test(location.pathname);
  const application = useApplicationContext();
  const onboarding = useOnboardingContext();
  const [apiError, setApiError] = useState(""), [collapsed, setCollapsed] = useState(() => { try { return sessionStorage.getItem("lexorion.sidebar-collapsed") === "true" || (sessionStorage.getItem("lexorion.sidebar-collapsed") === null && window.innerWidth <= 1100); } catch { return false; } }), [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<"help" | "docs">("help");

  useEffect(() => {
    const show = (event: Event) => setApiError((event as CustomEvent<string>).detail);
    window.addEventListener("lexorion:api-error", show);
    return () => window.removeEventListener("lexorion:api-error", show);
  }, []);
  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => setApiError(""), [auth.organization?.organizationId, workspace.workspace?.key]);
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

  const isOnboarding =
    application.mode === "client" &&
    Boolean(auth.organization) &&
    adminRole &&
    (workspace.workspaces.length === 0 || location.pathname === appPath("/app/onboarding"));

  const workforceProduct = Boolean(workspace.workspace?.products.some(product => product.key === "workforce"));
  const workforce = adminRole ? workforceAdmin : role === "MANAGER" ? workforceSelf : workforceSelf.filter(([key]) => key === "me");
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
    if (adminRole) {
      groups.push({
        label: "Organization",
        items: administration.map(([path, text, icon]) => ({
          to: appPath(path),
          label: text,
          icon,
        })),
      });
    }
    if (role && workforceProduct) addGroup("Workforce", "workforce", workforce);
    if (adminRole && workspace.workspace?.products.some(product => product.key === "payroll")) addGroup("Payroll", "payroll", payroll);
    if (adminRole && workspace.workspace?.products.some(product => product.key === "finance")) addGroup("Finance", "finance", finance);
  }
  const accountLinks = application.mode === "client" && adminRole && workforceProduct ? [{ to: appPath("/app/workforce/me"), label: "My profile" }] : [];
  const toggleSidebar = () => setCollapsed((value) => {
    try { sessionStorage.setItem("lexorion.sidebar-collapsed", String(!value)); } catch { /* Storage may be unavailable. */ }
    return !value;
  });

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (window.innerWidth <= 800) setDrawerOpen((value) => !value);
        else toggleSidebar();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  return (
    <div className={`shell ${application.mode === "platform" ? "platform-shell" : ""} ${collapsed ? "sidebar-collapsed" : ""} ${drawerOpen ? "drawer-open" : ""}`}>
      <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)} />
      <Sidebar platform={application.mode === "platform"} key={`${auth.user?.id}:${application.mode}:${auth.organization?.slug}:${workspace.workspace?.key}`} groups={groups} collapsed={collapsed} drawerOpen={drawerOpen}
        onToggle={toggleSidebar} onClose={() => setDrawerOpen(false)} initials={initials.toUpperCase()}
        userName={`${auth.user?.firstName ?? ""} ${auth.user?.lastName ?? ""}`.trim()}
        accountInfo={application.mode === "platform" ? "Platform Access" : auth.organization?.organizationName ?? auth.user?.email ?? "Account"}
        accountLinks={accountLinks} onLogout={() => void auth.logout()} />
      <div className="stage" inert={drawerOpen}>
        <header className="topbar">
          <AppSwitcher />
          <button className="sidebar-trigger" type="button" aria-label="Open navigation" aria-controls="application-sidebar"
            aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}><Icon name="menu" /></button>
          <div className="topbar-title-wrap">
            <span className="topbar-title">{application.mode === "platform" ? "Platform Console" : "Horizon"}</span>
            {application.mode === "client" && auth.organization && (
              <span className="topbar-crumb-sep">/</span>
            )}
            {application.mode === "client" && auth.organization && (
              <span className="topbar-org-tag">{auth.organization.organizationName}</span>
            )}
          </div>
          <div className="context-selectors">
            {application.mode === "client" ? (
              isOnboarding ? (
                <OnboardingTopBar
                  completedSteps={onboarding.completedCount}
                  totalSteps={onboarding.totalSteps}
                  onOpenHelp={() => {
                    setHelpTab("help");
                    setHelpOpen(true);
                  }}
                />
              ) : (
                <ContextSelector />
              )
            ) : (
              <div className="platform-nav-actions">
                <Button size="sm" variant="secondary" onClick={() => { if (consoleHost() === "platform") window.location.assign(consoleUrl("client")); else { application.enterClient(); navigate("/app"); } }}>
                  Open client app →
                </Button>
              </div>
            )}
          </div>
          <AccountMenu />
        </header>
        <main>
          {apiError && <div className="dismissible"><Notice>{apiError}</Notice><Button size="sm" onClick={() => setApiError("")}>Dismiss</Button></div>}
          {application.mode === "client" && <HorizonWorkflowNav />}
          <Outlet key={`${location.pathname}:${application.mode === "client" ? `client:${auth.organization?.organizationId ?? "none"}:${organizationAdministration ? "organization" : workspace.workspace?.key ?? "none"}` : "platform"}`} />
        </main>
      </div>

      <HelpModal
        open={helpOpen}
        initialTab={helpTab}
        onClose={() => setHelpOpen(false)}
      />
    </div>
  );
}
