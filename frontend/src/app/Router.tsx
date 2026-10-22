import { Navigate, Outlet, RouterProvider, createBrowserRouter, type RouteObject } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { AppShell } from "../layout/AppShell";
import { Notice, Page } from "../components/ui/Page";
import { InvitationPage } from "../pages/InvitationPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { HomePage } from "../pages/HomePage";
import { OnboardingPage } from "../pages/onboarding/OnboardingPage";
import { AdminPage } from "../pages/admin/AdminPage";
import { AdminWorkspaces } from "../pages/admin/AdminWorkspaces";
import { WorkforcePage } from "../pages/workforce/WorkforcePage";
import { EmployeeSetupWizard } from "../pages/workforce/EmployeeSetupWizard";
import { PayrollPage } from "../pages/payroll/PayrollPage";
import { FinancePage } from "../pages/finance/FinancePage";
import { TemplatesPage } from "../pages/finance/TemplatesPage";
import { ClientPages } from "../pages/finance/ClientPages";
import { ItemPages } from "../pages/finance/ItemPages";
import { BooksPage } from "../pages/finance/BooksPages";
import { InvoiceWizardPage } from "../pages/finance/InvoiceWizard";
import { PlatformHomePage } from "../pages/platform/PlatformHomePage";
import { PlatformOrganizationDetailPage, PlatformOrganizationsPage } from "../pages/platform/PlatformOrganizationsPage";
import { PlatformResourcesPage } from "../pages/platform/PlatformResourcesPage";
import { PlatformWorkspacesPage } from "../pages/platform/PlatformWorkspacesPage";
import { useApplicationContext } from "../context/ApplicationContext";
import { consoleHost } from "./hostRouting";
import { RouteErrorPage } from "./RouteErrorPage";

function Protected() {
  const auth = useAuth();
  if (auth.loading) return <div className="loading">Loading session…</div>;
  return auth.user ? <AppShell /> : <Navigate to="/login" replace />;
}

function ContextRequired({ area }: { area: "administration" | "workforce" | "payroll" | "finance" }) {
  const auth = useAuth(), workspace = useWorkspace(), application = useApplicationContext();
  if (application.mode !== "client") return <Navigate to={consoleHost() === "local" ? "/app" : "/"} replace />;
  if (!auth.organization) return <ContextNotice title={title(area)}>Choose an organization before opening this area.</ContextNotice>;
  if (area === "administration") return auth.organization.membershipRole === "ADMIN" ? <Outlet /> : <ContextNotice title="Access denied">Your organization role does not provide administration access.</ContextNotice>;
  if (area === "payroll" && auth.organization.membershipRole !== "ADMIN") return <ContextNotice title="Access denied">Your organization role does not provide Payroll access.</ContextNotice>;
  if (area === "finance" && auth.organization.membershipRole !== "ADMIN") return <ContextNotice title="Access denied">Your organization role does not provide Finance access.</ContextNotice>;
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

export function clientRoutes(local: boolean): RouteObject[] {
  const base = local ? "/app" : "";
  return [
    { index: true, element: <HomePage /> },
    { path: "onboarding", element: <OnboardingPage /> },
    { element: <ContextRequired area="administration" />, children: [
      { path: "organization", element: <AdminPage sectionKey="organization" /> },
      { path: "organization/workspaces", element: <AdminWorkspaces /> },
      { path: "organization/members", element: <AdminPage sectionKey="members" /> },
      { path: "organization/invitations", element: <AdminPage sectionKey="invitations" /> },
      { path: "organization/settings", element: <AdminPage key="settings" sectionKey="settings" /> },
      { path: "organization/settings/product-access", element: <AdminPage key="product-access" sectionKey="product-access" /> },
      { path: "organization/entitlements", element: <Navigate to={`${base}/organization/settings/product-access`} replace /> },
      { path: "admin", element: <Navigate to={`${base}/organization`} replace /> },
      { path: "admin/organization", element: <Navigate to={`${base}/organization`} replace /> },
      { path: "admin/workspaces", element: <Navigate to={`${base}/organization/workspaces`} replace /> },
      { path: "admin/members", element: <Navigate to={`${base}/organization/members`} replace /> },
      { path: "admin/invitations", element: <Navigate to={`${base}/organization/invitations`} replace /> },
      { path: "admin/settings", element: <Navigate to={`${base}/organization/settings`} replace /> },
      { path: "admin/entitlements", element: <Navigate to={`${base}/organization/settings/product-access`} replace /> },
      { path: "admin/*", element: <Navigate to={`${base}/organization`} replace /> },
      { path: "workspaces", element: <Navigate to={`${base}/organization/workspaces`} replace /> },
      { path: "members", element: <Navigate to={`${base}/organization/members`} replace /> },
      { path: "invitations", element: <Navigate to={`${base}/organization/invitations`} replace /> },
      { path: "settings", element: <Navigate to={`${base}/organization/settings`} replace /> },
      { path: "entitlements", element: <Navigate to={`${base}/organization/settings/product-access`} replace /> },
    ] },
    { element: <ContextRequired area="workforce" />, children: workforceRoutes() },
    { element: <ContextRequired area="payroll" />, children: payrollRoutes() },
    { element: <ContextRequired area="finance" />, children: financeRoutes() },
  ];
}

function workforceRoutes(): RouteObject[] { return [
  { path: "workforce", element: <WorkforceLanding /> },
  { element: <WorkforceRoleRequired roles={["ADMIN"]} />, children: [
    { path: "workforce/dashboard", element: <Navigate to={`${consoleHost() === "local" ? "/app" : ""}/workforce/employees`} replace /> }, { path: "workforce/employees", element: <WorkforcePage sectionKey="employees" /> },
    { path: "workforce/employees/new", element: <EmployeeSetupWizard /> },
    { path: "workforce/departments", element: <WorkforcePage sectionKey="departments" /> }, { path: "workforce/designations", element: <WorkforcePage sectionKey="designations" /> }, { path: "workforce/structure", element: <WorkforcePage sectionKey="structure" /> },
  ] },
  { element: <WorkforceRoleRequired roles={["ADMIN", "MANAGER"]} />, children: [{ path: "workforce/team", element: <WorkforcePage sectionKey="team" /> }, { path: "workforce/employees/:employeeCode", element: <WorkforcePage /> }] },
  { element: <WorkforceRoleRequired roles={["ADMIN", "MANAGER", "EMPLOYEE"]} />, children: [{ path: "workforce/me", element: <WorkforcePage sectionKey="me" /> }] },
]; }
function WorkforceLanding() { const role = useAuth().organization?.membershipRole; const destination = role === "ADMIN" ? "employees" : "me"; return <Navigate to={`${consoleHost() === "local" ? "/app" : ""}/workforce/${destination}`} replace />; }

function payrollRoutes(): RouteObject[] { return [
  ...["payroll", "payroll/dashboard"].map((path) => ({ path, element: <Navigate to={`${consoleHost() === "local" ? "/app" : ""}/payroll/pay-runs`} replace /> })),
  ...["employees", "components", "compensation", "salary-templates", "calculations", "pay-runs", "ledger", "payslips"].map((section) => ({ path: `payroll/${section}`, element: <PayrollPage sectionKey={section} /> })),
]; }

function financeRoutes(): RouteObject[] { return [
  { path: "finance", element: <Navigate to={`${consoleHost() === "local" ? "/app" : ""}/finance/overview`} replace /> },
  { path: "finance/overview", element: <FinancePage sectionKey="overview" /> },
  { path: "finance/invoices", element: <FinancePage sectionKey="invoices" /> },
  { path: "finance/invoices/new", element: <InvoiceWizardPage mode="new" /> },
  { path: "finance/invoices/:reference", element: <FinancePage sectionKey="invoice" /> },
  { path: "finance/invoices/:reference/edit", element: <InvoiceWizardPage mode="edit" /> },
  { path: "finance/clients", element: <ClientPages section="list" /> },
  { path: "finance/clients/new", element: <ClientPages section="new" /> },
  { path: "finance/clients/:clientKey", element: <ClientPages section="profile" /> },
  { path: "finance/items", element: <ItemPages section="list" /> },
  { path: "finance/items/new", element: <ItemPages section="new" /> },
  { path: "finance/items/:itemCode", element: <ItemPages section="profile" /> },
  { path: "finance/books", element: <BooksPage section="summary" /> },
  { path: "finance/books/sales-register", element: <BooksPage section="sales-register" /> },
  { path: "finance/books/journal", element: <BooksPage section="journal" /> },
  { path: "finance/books/settings", element: <BooksPage section="settings" /> },
  { path: "finance/payments", element: <FinancePage sectionKey="payments" /> },
  { path: "finance/templates", element: <TemplatesPage section="list" /> },
  { path: "finance/templates/new", element: <TemplatesPage section="new" /> },
  { path: "finance/templates/:templateKey", element: <TemplatesPage section="edit" /> },
]; }

const host = consoleHost();
export function getTopLevelCompatibilityRoutes(currentHost = consoleHost()): RouteObject[] {
  return currentHost === "local" ? [
    { path: "/organization", element: <Navigate to="/app/organization" replace /> },
    { path: "/organization/workspaces", element: <Navigate to="/app/organization/workspaces" replace /> },
    { path: "/organization/members", element: <Navigate to="/app/organization/members" replace /> },
    { path: "/organization/invitations", element: <Navigate to="/app/organization/invitations" replace /> },
    { path: "/organization/settings", element: <Navigate to="/app/organization/settings" replace /> },
    { path: "/organization/settings/product-access", element: <Navigate to="/app/organization/settings/product-access" replace /> },
    { path: "/organization/entitlements", element: <Navigate to="/app/organization/settings/product-access" replace /> },
    { path: "/workspaces", element: <Navigate to="/app/organization/workspaces" replace /> },
    { path: "/members", element: <Navigate to="/app/organization/members" replace /> },
    { path: "/invitations", element: <Navigate to="/app/organization/invitations" replace /> },
    { path: "/settings", element: <Navigate to="/app/organization/settings" replace /> },
    { path: "/entitlements", element: <Navigate to="/app/organization/settings/product-access" replace /> },
    { path: "/admin", element: <Navigate to="/app/organization" replace /> },
    { path: "/admin/organization", element: <Navigate to="/app/organization" replace /> },
    { path: "/admin/workspaces", element: <Navigate to="/app/organization/workspaces" replace /> },
    { path: "/admin/members", element: <Navigate to="/app/organization/members" replace /> },
    { path: "/admin/invitations", element: <Navigate to="/app/organization/invitations" replace /> },
    { path: "/admin/settings", element: <Navigate to="/app/organization/settings" replace /> },
    { path: "/admin/entitlements", element: <Navigate to="/app/organization/settings/product-access" replace /> },
    { path: "/admin/*", element: <Navigate to="/app/organization" replace /> },
  ] : currentHost === "client" ? [
    { path: "/app/organization", element: <Navigate to="/organization" replace /> },
    { path: "/app/organization/workspaces", element: <Navigate to="/organization/workspaces" replace /> },
    { path: "/app/organization/members", element: <Navigate to="/organization/members" replace /> },
    { path: "/app/organization/invitations", element: <Navigate to="/organization/invitations" replace /> },
    { path: "/app/organization/settings", element: <Navigate to="/organization/settings" replace /> },
    { path: "/app/organization/settings/product-access", element: <Navigate to="/organization/settings/product-access" replace /> },
    { path: "/app/organization/entitlements", element: <Navigate to="/organization/settings/product-access" replace /> },
    { path: "/app/admin", element: <Navigate to="/organization" replace /> },
    { path: "/app/admin/organization", element: <Navigate to="/organization" replace /> },
    { path: "/app/admin/workspaces", element: <Navigate to="/organization/workspaces" replace /> },
    { path: "/app/admin/members", element: <Navigate to="/organization/members" replace /> },
    { path: "/app/admin/invitations", element: <Navigate to="/organization/invitations" replace /> },
    { path: "/app/admin/settings", element: <Navigate to="/organization/settings" replace /> },
    { path: "/app/admin/entitlements", element: <Navigate to="/organization/settings/product-access" replace /> },
    { path: "/app/admin/*", element: <Navigate to="/organization" replace /> },
    { path: "/app/workspaces", element: <Navigate to="/organization/workspaces" replace /> },
    { path: "/app/members", element: <Navigate to="/organization/members" replace /> },
    { path: "/app/invitations", element: <Navigate to="/organization/invitations" replace /> },
    { path: "/app/settings", element: <Navigate to="/organization/settings" replace /> },
    { path: "/app/entitlements", element: <Navigate to="/organization/settings/product-access" replace /> },
  ] : [];
}

export const topLevelCompatibilityRoutes: RouteObject[] = getTopLevelCompatibilityRoutes();

const protectedRoute: RouteObject = host === "platform"
  ? { path: "/", element: <Protected />, children: [...platformRoutes(), { path: "*", element: <ContextNotice title="Page not found">This Horizon Platform page does not exist.</ContextNotice> }] }
  : host === "client"
    ? { path: "/", element: <Protected />, children: [...clientRoutes(false), { path: "*", element: <ContextNotice title="Page not found">This Horizon Organization page does not exist.</ContextNotice> }] }
    : { path: "/app", element: <Protected />, children: [{ index: true, element: <ApplicationHome /> }, ...platformRoutes("platform"), ...clientRoutes(true), { path: "*", element: <ContextNotice title="Page not found">This Horizon page does not exist.</ContextNotice> }] };

const router = createBrowserRouter([
  { errorElement: <RouteErrorPage />, children: [
  { path: "/invitations/accept", element: <InvitationPage /> },
  { path: "/login", element: <LoginPage /> }, { path: "/register", element: <RegisterPage /> },
  ...topLevelCompatibilityRoutes,
  protectedRoute,
  { path: "*", element: <Navigate to={host === "local" ? "/app" : "/"} replace /> },
  ] },
]);
export function Router() { return <RouterProvider router={router} />; }
