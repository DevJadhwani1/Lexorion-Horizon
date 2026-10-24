import { Navigate, Outlet, RouterProvider, createBrowserRouter, useLocation, type RouteObject } from "react-router-dom";
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
import { canonicalize, consoleHost, legacyRedirects } from "./hostRouting";
import { RouteErrorPage } from "./RouteErrorPage";

function PreserveRedirect({ to }: { to: string }) {
  const location = useLocation();
  const target = new URL(to, "http://localhost");
  return <Navigate to={{ pathname: target.pathname, search: target.search || location.search, hash: location.hash }} replace />;
}

function LegacyAppRedirect() {
  const location = useLocation();
  const next = canonicalize(location.pathname);
  const pathname = next === location.pathname || next.startsWith("/app") ? "/overview" : next;
  return <Navigate to={{ pathname, search: location.search, hash: location.hash }} replace />;
}

function Protected() {
  const auth = useAuth();
  if (auth.loading) return <div className="loading">Loading session…</div>;
  return auth.user ? <AppShell /> : <Navigate to="/login" replace />;
}

function ContextRequired({ area }: { area: "administration" | "workforce" | "payroll" | "finance" }) {
  const auth = useAuth(), workspace = useWorkspace(), application = useApplicationContext();
  if (application.mode !== "client") return <Navigate to={consoleHost() === "platform" ? "/" : "/platform"} replace />;
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
  if (mode === "platform" && consoleHost() === "local") return <Navigate to="/platform" replace />;
  return <Navigate to="/overview" replace />;
}
function PlatformRequired() {
  const application = useApplicationContext();
  if (application.mode === "platform" && application.hasPlatformAccess) return <Outlet />;
  return consoleHost() === "platform" ? <ContextNotice title="Platform Access required">This account does not have active Horizon Platform Access.</ContextNotice> : <Navigate to="/overview" replace />;
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

export function clientRoutes(): RouteObject[] {
  return [
    { index: true, element: <ApplicationHome /> },
    { path: "overview", element: <HomePage /> },
    { path: "onboarding", element: <OnboardingPage /> },
    { element: <ContextRequired area="administration" />, children: [
      { path: "organization", element: <AdminPage sectionKey="organization" /> },
      { path: "organization/workspaces", element: <AdminWorkspaces /> },
      { path: "people", element: <AdminPage sectionKey="members" /> },
      { path: "organization/invitations", element: <AdminPage sectionKey="invitations" /> },
      { path: "organization/settings", element: <AdminPage key="settings" sectionKey="settings" /> },
      { path: "organization/settings/product-access", element: <AdminPage key="product-access" sectionKey="product-access" /> },
    ] },
    { element: <ContextRequired area="workforce" />, children: workforceRoutes() },
    { element: <ContextRequired area="payroll" />, children: payrollRoutes() },
    { element: <ContextRequired area="finance" />, children: financeRoutes() },
  ];
}

function workforceRoutes(): RouteObject[] { return [
  { path: "workforce", element: <WorkforceLanding /> },
  { element: <WorkforceRoleRequired roles={["ADMIN"]} />, children: [
    { path: "workforce/employees", element: <WorkforcePage sectionKey="employees" /> },
    { path: "workforce/employees/new", element: <EmployeeSetupWizard /> },
    { path: "workforce/departments", element: <WorkforcePage sectionKey="departments" /> },
    { path: "workforce/designations", element: <WorkforcePage sectionKey="designations" /> },
    { path: "workforce/structure", element: <Navigate to="/workforce/departments" replace /> },
  ] },
  { element: <WorkforceRoleRequired roles={["ADMIN", "MANAGER"]} />, children: [
    { path: "workforce/team", element: <WorkforcePage sectionKey="team" /> },
    { path: "workforce/employees/:employeeCode", element: <WorkforcePage /> },
  ] },
  { element: <WorkforceRoleRequired roles={["ADMIN", "MANAGER", "EMPLOYEE"]} />, children: [
    { path: "workforce/me", element: <WorkforcePage sectionKey="me" /> },
  ] },
]; }
function WorkforceLanding() {
  const role = useAuth().organization?.membershipRole;
  return <Navigate to={role === "ADMIN" ? "/workforce/employees" : "/workforce/me"} replace />;
}

function payrollRoutes(): RouteObject[] {
  const sections = ["employees", "components", "compensation", "salary-templates", "calculations", "runs", "ledger", "payslips"] as const;
  return sections.map((section) => ({
    path: `payroll/${section}`,
    element: <PayrollPage sectionKey={section === "runs" ? "pay-runs" : section} />,
  }));
}

function financeRoutes(): RouteObject[] { return [
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
  if (currentHost === "platform") return [];
  return [
    ...legacyRedirects().map(({ from, to }) => ({ path: from, element: <PreserveRedirect to={to} /> })),
    { path: "/app/*", element: <LegacyAppRedirect /> },
    { path: "/admin/*", element: <PreserveRedirect to="/organization" /> },
  ];
}

export const topLevelCompatibilityRoutes: RouteObject[] = getTopLevelCompatibilityRoutes();

const protectedRoute: RouteObject = host === "platform"
  ? { path: "/", element: <Protected />, children: [...platformRoutes(), { path: "*", element: <ContextNotice title="Page not found">This Horizon Platform page does not exist.</ContextNotice> }] }
  : { path: "/", element: <Protected />, children: [
      ...clientRoutes(),
      ...(host === "local" ? platformRoutes("platform") : []),
      { path: "*", element: <ContextNotice title="Page not found">This Horizon page does not exist.</ContextNotice> },
    ] };

const router = createBrowserRouter([
  { errorElement: <RouteErrorPage />, children: [
    { path: "/invitations/accept", element: <InvitationPage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    ...topLevelCompatibilityRoutes,
    protectedRoute,
    { path: "*", element: <Navigate to={host === "platform" ? "/" : "/overview"} replace /> },
  ] },
]);
export function Router() { return <RouterProvider router={router} />; }
