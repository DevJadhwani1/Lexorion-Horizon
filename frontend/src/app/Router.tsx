import { Navigate, Outlet, RouterProvider, createBrowserRouter, type RouteObject } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { AppShell } from "../layout/AppShell";
import { Notice, Page } from "../components/ui/Page";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { HomePage } from "../pages/HomePage";
import { AdminPage } from "../pages/admin/AdminPage";
import { AdminWorkspaces } from "../pages/admin/AdminWorkspaces";
import { WorkforcePage } from "../pages/workforce/WorkforcePage";
import { PayrollPage } from "../pages/payroll/PayrollPage";
import { PlatformHomePage } from "../pages/platform/PlatformHomePage";
import { PlatformOrganizationDetailPage, PlatformOrganizationsPage } from "../pages/platform/PlatformOrganizationsPage";
import { PlatformResourcesPage } from "../pages/platform/PlatformResourcesPage";
import { PlatformWorkspacesPage } from "../pages/platform/PlatformWorkspacesPage";
import { useApplicationContext } from "../context/ApplicationContext";
import { consoleHost } from "./hostRouting";

function Protected() {
  const auth = useAuth();
  if (auth.loading) return <div className="loading">Loading session…</div>;
  return auth.user ? <AppShell /> : <Navigate to="/login" replace />;
}

function ContextRequired({ area }: { area: "administration" | "workforce" | "payroll" }) {
  const auth = useAuth(), workspace = useWorkspace(), application = useApplicationContext();
  if (application.mode !== "client") return <Navigate to={consoleHost() === "local" ? "/app" : "/"} replace />;
  if (!auth.organization) return <ContextNotice title={title(area)}>Choose an organization before opening this area.</ContextNotice>;
  if (area === "administration") return auth.organization.membershipRole === "ADMIN" ? <Outlet /> : <ContextNotice title="Access denied">Your organization role does not provide administration access.</ContextNotice>;
  if (area === "payroll" && auth.organization.membershipRole !== "ADMIN") return <ContextNotice title="Access denied">Your organization role does not provide Payroll access.</ContextNotice>;
  if (workspace.loading) return <ContextNotice title={title(area)}>Loading available workspaces…</ContextNotice>;
  if (workspace.error) return <ContextNotice title={title(area)}>{workspace.error}</ContextNotice>;
  if (!workspace.workspace || !workspace.workspace.products.some((product) => product.key === area)) return <ContextNotice title={title(area)}>Choose an active {title(area)} workspace before opening this area.</ContextNotice>;
  return <Outlet />;
}

function ApplicationHome() {
  const { mode } = useApplicationContext();
  return mode === "platform" ? <Navigate to="/app/platform" replace /> : <HomePage />;
}
function PlatformRequired() {
  const application = useApplicationContext();
  if (application.mode === "platform" && application.hasPlatformAccess) return <Outlet />;
  return consoleHost() === "platform" ? <ContextNotice title="Platform Access required">This account does not have active Horizon Platform Access.</ContextNotice> : <Navigate to="/app" replace />;
}
function WorkforceRoleRequired({ roles }: { roles: Array<"ADMIN" | "MANAGER" | "EMPLOYEE"> }) {
  const role = useAuth().organization?.membershipRole;
  return role && roles.includes(role) ? <Outlet /> : <ContextNotice title="Access denied">Your organization role does not provide access to this Workforce page.</ContextNotice>;
}
function ContextNotice({ title: heading, children }: { title: string; children: ReactNode }) { return <Page title={heading}><Notice tone="info">{children}</Notice></Page>; }
const title = (value: string) => value[0].toUpperCase() + value.slice(1);

function platformRoutes(prefix = ""): RouteObject[] {
  const path = (value: string) => [prefix, value].filter(Boolean).join("/");
  return [{ element: <PlatformRequired />, children: [
    { index: !prefix, path: prefix || undefined, element: <PlatformHomePage /> },
    { path: path("organizations"), element: <PlatformOrganizationsPage /> },
    { path: path("organizations/:organizationId"), element: <PlatformOrganizationDetailPage /> },
    { path: path("users"), element: <PlatformResourcesPage section="users" /> },
    { path: path(prefix ? "access" : "platform-access"), element: <PlatformResourcesPage section="access" /> },
    { path: path("products"), element: <PlatformResourcesPage section="products" /> },
    { path: path("plans"), element: <PlatformResourcesPage section="plans" /> },
    { path: path("entitlements"), element: <PlatformResourcesPage section="entitlements" /> },
    { path: path("workspaces"), element: <PlatformWorkspacesPage /> },
    { path: path("settings"), element: <PlatformResourcesPage section="settings" /> },
  ] }];
}

function clientRoutes(local: boolean): RouteObject[] {
  const admin = (value: string) => local ? `admin/${value}` : value;
  return [
    { index: true, element: <HomePage /> },
    { element: <ContextRequired area="administration" />, children: [
      ...(local ? [{ path: "admin", element: <Navigate to="/app/admin/organization" replace /> }] : []),
      { path: admin("organization"), element: <AdminPage sectionKey="organization" /> },
      { path: admin("members"), element: <AdminPage sectionKey="members" /> },
      { path: admin("invitations"), element: <AdminPage sectionKey="invitations" /> },
      { path: admin("settings"), element: <AdminPage sectionKey="settings" /> },
      { path: admin("entitlements"), element: <AdminPage sectionKey="entitlements" /> },
      { path: admin("workspaces"), element: <AdminWorkspaces /> },
    ] },
    { element: <ContextRequired area="workforce" />, children: workforceRoutes() },
    { element: <ContextRequired area="payroll" />, children: payrollRoutes() },
  ];
}

function workforceRoutes(): RouteObject[] { return [
  { path: "workforce", element: <WorkforceLanding /> },
  { element: <WorkforceRoleRequired roles={["ADMIN"]} />, children: [
    { path: "workforce/dashboard", element: <WorkforcePage sectionKey="dashboard" /> }, { path: "workforce/employees", element: <WorkforcePage sectionKey="employees" /> },
    { path: "workforce/departments", element: <WorkforcePage sectionKey="departments" /> }, { path: "workforce/designations", element: <WorkforcePage sectionKey="designations" /> }, { path: "workforce/structure", element: <WorkforcePage sectionKey="structure" /> },
  ] },
  { element: <WorkforceRoleRequired roles={["ADMIN", "MANAGER"]} />, children: [{ path: "workforce/team", element: <WorkforcePage sectionKey="team" /> }, { path: "workforce/employees/:employeeCode", element: <WorkforcePage /> }] },
  { element: <WorkforceRoleRequired roles={["ADMIN", "MANAGER", "EMPLOYEE"]} />, children: [{ path: "workforce/me", element: <WorkforcePage sectionKey="me" /> }] },
]; }
function WorkforceLanding() { const role = useAuth().organization?.membershipRole; const destination = role === "ADMIN" ? "dashboard" : "me"; return <Navigate to={`${consoleHost() === "local" ? "/app" : ""}/workforce/${destination}`} replace />; }

function payrollRoutes(): RouteObject[] { return [
  { path: "payroll", element: <Navigate to={`${consoleHost() === "local" ? "/app" : ""}/payroll/dashboard`} replace /> },
  ...["dashboard", "employees", "components", "compensation", "salary-templates", "calculations", "pay-runs", "ledger", "payslips"].map((section) => ({ path: `payroll/${section}`, element: <PayrollPage sectionKey={section} /> })),
]; }

const host = consoleHost();
const protectedRoute: RouteObject = host === "platform"
  ? { path: "/", element: <Protected />, children: [...platformRoutes(), { path: "*", element: <ContextNotice title="Page not found">This Horizon Platform page does not exist.</ContextNotice> }] }
  : host === "client"
    ? { path: "/", element: <Protected />, children: [...clientRoutes(false), { path: "*", element: <ContextNotice title="Page not found">This Horizon Organization page does not exist.</ContextNotice> }] }
    : { path: "/app", element: <Protected />, children: [{ index: true, element: <ApplicationHome /> }, ...platformRoutes("platform"), ...clientRoutes(true), { path: "*", element: <ContextNotice title="Page not found">This Horizon page does not exist.</ContextNotice> }] };

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> }, { path: "/register", element: <RegisterPage /> }, protectedRoute,
  { path: "*", element: <Navigate to={host === "local" ? "/app" : "/"} replace /> },
]);
export function Router() { return <RouterProvider router={router} />; }
