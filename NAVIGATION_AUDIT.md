# Horizon Navigation & Page Audit

## A. Complete Navigation Inventory

### Global/Client Mode Navigation

#### Overview (Global)
- **Route**: `/overview` or `/`
- **Component**: HomePage
- **Label**: "Overview"
- **Icon**: home
- **Access**: All authenticated users
- **Purpose**: Organization overview, workspace selection, metrics, quick actions, payroll actions

#### Organization Admin (Requires ADMIN role)
- **Organization**
  - Route: `/organization` or `/organization`
  - Component: AdminPage (sectionKey="organization")
  - Label: "Organization"
  - Icon: building
  - Purpose: Org name, contact, website, address, industry, country, currency, timezone, date format
  
- **Workspaces**
  - Route: `/organization/workspaces` or `/organization/workspaces`
  - Component: AdminWorkspaces
  - Label: "Workspaces"
  - Icon: panels
  - Purpose: Workspace management (create, list)

- **Members**
  - Route: `/people` or `/organization/members`
  - Component: AdminPage (sectionKey="members")
  - Label: "Members"
  - Icon: profile
  - Purpose: List members, change roles, remove members

- **Invitations**
  - Route: `/organization/invitations` or `/organization/invitations`
  - Component: AdminPage (sectionKey="invitations")
  - Label: "Invitations"
  - Icon: admin
  - Purpose: Send invitations, resend, revoke, list pending

- **Settings**
  - Route: `/settings/organization` or `/organization/settings`
  - Component: AdminPage (sectionKey="settings")
  - Label: "Settings"
  - Icon: settings
  - Purpose: Org settings (sub-path: /product-access)

- **Settings > Product Access** (Entitlements)
  - Route: `/settings/organization/product-access` or `/organization/settings/product-access`
  - Component: AdminPage (sectionKey="product-access")
  - Redirect: `/settings/organization/product-access` → `/settings/organization/product-access`
  - Purpose: Effective entitlements, plan details

#### Workforce (Conditional: requires "workforce" product in workspace)

##### Admin Routes (Requires ADMIN role)
- **Workforce Dashboard**
  - Route: `/workforce/employees` or `/workforce/dashboard`
  - Component: WorkforcePage (sectionKey="dashboard")
  - Label: "Dashboard"
  - Icon: workforce
  - Purpose: Overview, statistics, employee count

- **Employees**
  - Route: `/workforce/employees` or `/workforce/employees`
  - Component: WorkforcePage (sectionKey="employees")
  - Label: "Employees"
  - Icon: profile
  - Purpose: List, create, manage employees

- **Employee Profile** (Detail)
  - Route: `/workforce/employees/:employeeCode` or `/workforce/employees/:employeeCode`
  - Component: WorkforcePage (with employeeCode param)
  - Access: Admin, Manager, Employee (for self)
  - Purpose: View/edit employee details, history, transitions

- **Departments**
  - Route: `/workforce/departments` or `/workforce/departments`
  - Component: WorkforcePage (sectionKey="departments")
  - Label: "Departments"
  - Icon: workforce
  - Purpose: List, create, update departments

- **Designations**
  - Route: `/workforce/designations` or `/workforce/designations`
  - Component: WorkforcePage (sectionKey="designations")
  - Label: "Designations"
  - Icon: workforce
  - Purpose: List, create, update job titles

- **Structure**
  - Route: `/workforce/structure` or `/workforce/structure`
  - Component: WorkforcePage (sectionKey="structure")
  - Label: "Structure"
  - Icon: workforce
  - Purpose: Org hierarchy visualization

##### Manager/Employee Routes
- **My Profile** (Personal)
  - Route: `/workforce/me` or `/workforce/me`
  - Component: WorkforcePage (sectionKey="me")
  - Label: "My profile"
  - Icon: profile
  - Access: All authenticated
  - Purpose: View own employee profile

- **My Team** (Reports)
  - Route: `/workforce/team` or `/workforce/team`
  - Component: WorkforcePage (sectionKey="team")
  - Label: "My team"
  - Icon: profile
  - Access: Admin, Manager
  - Purpose: View direct reports list

##### Workforce Landing
  - Route: `/workforce` or `/workforce`
  - Component: WorkforceLanding (redirect)
  - Redirects to: `/workforce/employees` (admin) or `/workforce/me` (non-admin)

#### Payroll (Conditional: requires "payroll" product + ADMIN role)

- **Payroll Dashboard**
  - Route: `/payroll/runs` or `/payroll/dashboard`
  - Component: PayrollPage (sectionKey="dashboard")
  - Label: "Dashboard"
  - Icon: payroll
  - Purpose: Payroll workflow overview, step numbers

- **Payroll Employees**
  - Route: `/payroll/employees` or `/payroll/employees`
  - Component: PayrollPage (sectionKey="employees" - default)
  - Label: "Employees"
  - Icon: profile
  - Purpose: List payroll-configured employees, activate/deactivate

- **Components**
  - Route: `/payroll/components` or `/payroll/components`
  - Component: PayrollPage (sectionKey="components")
  - Label: "Components"
  - Icon: payroll
  - Purpose: Salary components (earnings, deductions, taxes)

- **Compensation**
  - Route: `/payroll/compensation` or `/payroll/compensation`
  - Component: PayrollPage (sectionKey="compensation")
  - Label: "Compensation"
  - Icon: payroll
  - Purpose: Employee compensation profiles by pay run
  - **Note**: Links back from /payroll/employees

- **Salary Templates**
  - Route: `/payroll/salary-templates` or `/payroll/salary-templates`
  - Component: PayrollPage (sectionKey="salary-templates")
  - Label: "Salary templates"
  - Icon: payroll
  - Purpose: Reusable compensation templates

- **Calculations**
  - Route: `/payroll/calculations` or `/payroll/calculations`
  - Component: PayrollPage (sectionKey="calculations") → EmployeeDetail
  - Label: "Calculations"
  - Icon: payroll
  - Purpose: Preview payroll calculations for employees

- **Pay Runs**
  - Route: `/payroll/runs` or `/payroll/pay-runs`
  - Component: PayrollPage (sectionKey="pay-runs")
  - Label: "Pay runs"
  - Icon: payroll
  - Purpose: Create, process, finalize, recover pay runs

- **Ledger**
  - Route: `/payroll/ledger` or `/payroll/ledger`
  - Component: PayrollPage (sectionKey="ledger") → EmployeeDetail
  - Label: "Ledger"
  - Icon: payroll
  - Purpose: Finalized signed payroll history

- **Payslips**
  - Route: `/payroll/payslips` or `/payroll/payslips`
  - Component: PayrollPage (sectionKey="payslips") → EmployeeDetail
  - Label: "Payslips"
  - Icon: payroll
  - Purpose: Employee payroll documents

##### Payroll Landing
  - Route: `/payroll` or `/payroll`
  - Component: Redirect to `/payroll/runs`

### Platform Mode Navigation (Admin only, separate console mode)

#### Platform Primary
- Overview: `/platform/` or `/` (host-dependent)
- Organizations: `/platform/organizations`
- Users: `/platform/users`
- Platform Access: `/platform/access` or `/platform/platform-access`

#### Platform Catalog
- Products: `/platform/products`
- Plans: `/platform/plans`
- Entitlements: `/platform/entitlements`

#### Platform Operations
- Workspaces: `/platform/workspaces`

#### Platform System
- Settings: `/platform/settings`

### Other Routes

- **Onboarding** (Shown to new admins with empty workspaces)
  - Route: `/onboarding`
  - Component: OnboardingPage
  - Triggered: When `workspace.workspaces.length === 0 && adminRole && !onboarding`

- **Login**
  - Route: `/login`
  - Component: LoginPage

- **Register**
  - Route: `/register`
  - Component: RegisterPage

- **Invitation Accept**
  - Route: `/invitations/accept`
  - Component: InvitationPage

---

## B. Duplicate & Overlap Analysis

### 1. Workforce Employees vs Payroll Employees
- **Workforce Employees** (/workforce/employees): All workforce records, full lifecycle
- **Payroll Employees** (/payroll/employees): Subset configured for payroll, status management
- **Overlap**: Both list employees; payroll is a filtered/status-managed subset
- **Evidence**: Different APIs (getEmployees vs getPayrollEmployees), different purposes
- **Impact**: Users must navigate to both to manage full lifecycle
- **Recommendation**: Consider a "Payroll setup" workflow within Workforce Employees that guides configuration

### 2. Workforce Dashboard vs Global Overview
- **Global Overview** (/app): Org metrics, workspaces, quick actions, payroll status
- **Workforce Dashboard** (/workforce/employees): Workforce statistics only
- **Overlap**: Both serve overview purposes but different scope
- **Evidence**: Different components (HomePage vs WorkforcePage), different data
- **Impact**: Users see multiple "dashboards"; not clear which to use first
- **Recommendation**: Keep separate but clarify purpose in sidebar

### 3. Payroll Dashboard vs Compensation/Calculations/Ledger/Payslips
- **Payroll Dashboard**: Workflow overview showing numbered steps
- **Compensation/Calculations/Ledger/Payslips**: Individual workflow steps
- **Structure**: Dashboard → links to each step
- **Status**: All are implemented but Calculations/Ledger/Payslips redirect to EmployeeDetail
- **Evidence**: Sections 189-240 in PayrollPage.tsx show dashboard as landing
- **Recommendation**: Keep as workflow navigation

### 4. Departments, Designations, Structure
- **Departments**: List/create/edit departments
- **Designations**: List/create/edit job titles
- **Structure**: Org hierarchy visualization
- **Overlap**: All relate to org structure but serve different purposes
- **Evidence**: Different APIs (getDepartments, getDesignations, getStructure)
- **Impact**: Clear separation; no true duplicate
- **Recommendation**: Keep separate

### 5. Compensation vs Salary Templates
- **Compensation**: Employee-specific pay period snapshots (immutable)
- **Salary Templates**: Reusable templates assigned to employees
- **Relationship**: Templates → assigned to employees → snapshots in compensation
- **Evidence**: Different data types, one-way flow
- **Recommendation**: Keep separate; clarify relationship in UI

### 6. Calculations vs Ledger vs Payslips
- **Calculations**: Previews using active compensation (before finalization)
- **Ledger**: Finalized signed history (after pay run processing)
- **Payslips**: Finalized employee documents (after pay run finalization)
- **Status**: All route through EmployeeDetail; implemented
- **Recommendation**: Keep as distinct workflow stages

### 7. Organization Settings vs Product Access vs Entitlements Redirect
- **Settings** (/settings/organization): Org general settings
- **Product Access** (/settings/organization/product-access): Effective entitlements
- **Entitlements** (/settings/organization/product-access): Redirects to Product Access
- **Issue**: Three labels/routes pointing to same purpose; /entitlements is legacy redirect
- **Evidence**: Router.tsx line 86, 93 show entitlements → product-access redirects
- **Recommendation**: Remove `/entitlements` entry from sidebar if present; unify naming

### 8. Global Admin Routes vs Workforce Admin vs Payroll Admin
- **Global**: Organization, Workspaces, Members, Invitations, Settings
- **Workforce**: Dashboard, Employees, Departments, Designations, Structure (ADMIN only)
- **Payroll**: Dashboard, Employees, Components, Compensation, etc. (ADMIN only)
- **Separation**: Clear by product; no overlap
- **Recommendation**: Keep separate

### 9. My Profile vs My Team vs Employee Profile
- **My Profile** (/workforce/me): Current user's profile (all roles)
- **My Team** (/workforce/team): Manager/Admin's direct reports
- **Employee Profile** (/workforce/employees/:code): Any employee detail (admin/manager can view others)
- **Distinction**: My Team is a filtered list; Employee Profile is detailed view
- **Recommendation**: Keep separate; My Team is manager-specific convenience

### 10. Admin vs Organization Routes
- **Redirect chain**: `/organization/*` → `/organization/*` (Router.tsx lines 87-94)
- **Status**: Legacy routes fully redirected; no duplicate navigation
- **Recommendation**: Keep redirects for backwards compatibility; safe to remove if no external refs

---

## C. Proposed Navigation Structure

### Minimal Sidebar (Remove Duplication)

#### Client Mode (Non-Platform)

**Quick Access**
- Overview

**Organization** (Admin only)
- Organization
- Workspaces
- Members
- Invitations
- Settings (includes Product Access sub-section)

**Workforce** (If product enabled)
- Dashboard (Admin only)
- Employees
- Departments (Admin only)
- Designations (Admin only)
- Structure (Admin only)
- My profile
- My team (Manager/Admin only)

**Payroll** (If product enabled, Admin only)
- Dashboard
- Employees
- Compensation
- Salary Templates
- Calculations
- Pay Runs
- Ledger
- Payslips

**Note**: Components and Calculations are workflow steps; keep them.

### Consolidations
1. **Remove** `/settings/organization/product-access` → use Settings > Product Access only
2. **Consider**: Rename "Payroll" group to "Payroll Setup" and structure as:
   - Configuration: Employees, Components, Salary Templates
   - Execution: Pay Runs
   - Review: Compensation, Calculations, Ledger, Payslips

---

## D. Missing Pages

### Incomplete Pages
1. **Payroll EmployeeDetail** (Calculations, Ledger, Payslips)
   - Routes exist but component renders limited content
   - Status: Placeholder/partial implementation
   - Evidence: PayrollPage.tsx line 105-106 redirects to EmployeeDetail
   - Required by: Payroll workflow step links

2. **Workforce Dashboard**
   - Exists but minimal (employee count display)
   - Evidence: WorkforcePage.tsx renders basic dashboard
   - Could include: Department count, designation count, team structure

### Missing Functionality
1. **Payroll History/Audit**
   - Ledger exists but unclear if it covers all requirements
   - No dedicated "History" page for pay-run amendments or corrections

2. **Compensation History**
   - Compensation shows current snapshots; no version history
   - Required for: Tracking changes over time

---

## E. Implementation Dependencies

### Shared Files (Exclusive Ownership Required)
- **Router.tsx**: Route definitions (affects all pages)
- **AppShell.tsx**: Sidebar navigation groups (affects all pages)
- **Sidebar.tsx**: Sidebar UI rendering (no changes needed)
- **SidebarIcon.tsx**: Icons (ensure consistency)
- **HomePage.tsx**: Overview page content
- **AdminPage.tsx**: Organization admin pages
- **AdminWorkspaces.tsx**: Workspace management
- **WorkforcePage.tsx**: Workforce section router
- **PayrollPage.tsx**: Payroll section router

### Independent Components
- Workforce sub-pages (easily isolated by section)
- Payroll sub-pages (easily isolated by section)
- Admin/Organization pages (isolated by section)

---

## Summary Table

| Item | Route | Component | Status | Owner | Notes |
|------|-------|-----------|--------|-------|-------|
| Global Overview | /app | HomePage | ✅ Complete | - | Shows org metrics, quick actions |
| Organization | /app/org | AdminPage | ✅ Complete | - | Org settings form |
| Workspaces | /app/org/ws | AdminWorkspaces | ✅ Complete | - | Workspace management |
| Members | /app/org/members | AdminPage | ✅ Complete | - | List, role management |
| Invitations | /app/org/invitations | AdminPage | ✅ Complete | - | Send, revoke, resend |
| Settings | /app/org/settings | AdminPage | ✅ Complete | - | Org config + sub-section |
| Product Access | /app/org/settings/pa | AdminPage | ✅ Complete | - | Entitlements view |
| WF Dashboard | /app/wf/dashboard | WorkforcePage | ✅ Minimal | - | Employee count only |
| WF Employees | /app/wf/employees | WorkforcePage | ✅ Complete | - | Create, edit, list |
| WF Departments | /app/wf/departments | WorkforcePage | ✅ Complete | - | Reference management |
| WF Designations | /app/wf/designations | WorkforcePage | ✅ Complete | - | Job titles |
| WF Structure | /app/wf/structure | WorkforcePage | ✅ Complete | - | Hierarchy viz |
| WF My Profile | /app/wf/me | WorkforcePage | ✅ Complete | - | Current user view |
| WF My Team | /app/wf/team | WorkforcePage | ✅ Complete | - | Manager convenience |
| WF Employee Detail | /app/wf/emp/:code | WorkforcePage | ✅ Complete | - | Full profile + history |
| PR Dashboard | /app/pr/dashboard | PayrollPage | ✅ Workflow | - | Links to workflow steps |
| PR Employees | /app/pr/employees | PayrollPage | ✅ Complete | - | Payroll config subset |
| PR Components | /app/pr/components | PayrollPage | ✅ Complete | - | Salary components |
| PR Compensation | /app/pr/compensation | PayrollPage | ✅ Employee-scoped | - | Pay period snapshots |
| PR Salary Templates | /app/pr/sal-templates | PayrollPage | ✅ Complete | - | Template reuse |
| PR Calculations | /app/pr/calculations | PayrollPage | ⚠️ Partial | - | Redirects to EmployeeDetail |
| PR Pay Runs | /app/pr/pay-runs | PayrollPage | ✅ Complete | - | Process, finalize |
| PR Ledger | /app/pr/ledger | PayrollPage | ⚠️ Partial | - | Redirects to EmployeeDetail |
| PR Payslips | /app/pr/payslips | PayrollPage | ⚠️ Partial | - | Redirects to EmployeeDetail |
| Onboarding | /onboarding | OnboardingPage | ✅ Complete | - | Staged setup flow |
| Platform Overview | /platform | PlatformHomePage | ✅ Complete | - | Platform admin |

---

## Key Findings

### No Critical Duplicates Found
The navigation is well-structured with clear separation between:
- **Global** administration (organization, members, invitations)
- **Workforce** management (employee lifecycle, org structure)
- **Payroll** processing (compensation, pay runs, finalization)
- **Platform** operations (separate console for platform admins)

### Design Observations
1. **Smart Conditional Rendering**: Sidebar items appear/disappear based on role and product enablement (not hardcoded clutter)
2. **Role-based Access**: ADMIN, MANAGER, and EMPLOYEE roles get appropriate menu visibility
3. **Workflow Navigation**: Payroll dashboard explicitly numbers steps; users can follow a clear path
4. **Legacy Compatibility**: Old `/admin/*` routes still work via redirects; safe to keep or remove

### Minor Cleanup Opportunities
1. Remove "Components" from Payroll sidebar (it's a configuration detail, not a main feature)
2. Clarify dashboard names: "Overview" vs "Dashboard" vs "Dashboard"
3. Remove `/organization/entitlements` route (legacy; already redirects to Product Access)

### Incomplete Features
- **Payroll EmployeeDetail**: Calculations, Ledger, Payslips partially implemented
- **Workforce Dashboard**: Minimal; could be enhanced with metrics

**Status**: Ready for approval before implementation.
