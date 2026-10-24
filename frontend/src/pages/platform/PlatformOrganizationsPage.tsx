import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Dropdown } from "../../components/ui/Dropdown";
const human = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
import { Empty, Notice, Page } from "../../components/ui/Page";
import { activatePlatformOrganization, assignPlatformOrganizationPlan, createPlatformOrganization, getPlatformOrganization, getPlatformOrganizations, getPlatformPlans, getPlatformUsers, type PlatformOrganization, type PlatformUser, type PlatformPlan } from "../../features/platform/platformApi";
import { useAuth } from "../../auth/AuthProvider";
import { useApplicationContext } from "../../context/ApplicationContext";
import { appPath, consoleHost, consoleUrl } from "../../app/hostRouting";

export function PlatformOrganizationsPage() {
  const auth = useAuth(), navigate = useNavigate();
  const [users, setUsers] = useState<PlatformUser[]>([]), [busy, setBusy] = useState(false);
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("ALL");
  useEffect(() => {
    Promise.all([getPlatformOrganizations(), getPlatformUsers()]).then(([items, owners]) => { setOrganizations(items); setUsers(owners); })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load client organizations."))
      .finally(() => setLoading(false));
  }, []);
  const statuses = [...new Set(organizations.map((organization) => organization.status))].sort();
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return organizations.filter((organization) => (status === "ALL" || organization.status === status)
      && (!term || [organization.name, organization.legalName, organization.organizationCode, organization.slug, organization.primaryEmail]
        .some((value) => value?.toLowerCase().includes(term))));
  }, [organizations, query, status]);
  return <Page title="Organizations" description="Client organizations managed through Horizon.">
    <details className="card"><summary>Create organization</summary>
      <p>Choose an existing Core user as the organization administrator. After creation, activate the organization and assign a plan before creating its workspace.</p>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault(); setBusy(true); setError("");
        const form = new FormData(event.currentTarget);
        void createPlatformOrganization({ name: String(form.get("name")), organizationCode: String(form.get("organizationCode")), primaryEmail: String(form.get("primaryEmail")), ownerUserId: String(form.get("ownerUserId")), ...(form.get("slug") ? { slug: String(form.get("slug")) } : {}) })
          .then(async (created) => { await auth.reloadOrganizations(); navigate(appPath(`/platform/organizations/${created.id}`)); })
          .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to create organization."))
          .finally(() => setBusy(false));
      }}>
        <label>Name<input name="name" required maxLength={150} /></label>
        <label>Organization code<input name="organizationCode" required maxLength={50} /></label>
        <label>Primary email<input name="primaryEmail" type="email" required maxLength={255} /></label>
        <label>Slug (optional)<input name="slug" maxLength={63} /></label>
        <Dropdown label="Organization administrator" name="ownerUserId" required defaultValue={auth.user?.id ?? ""} options={users.filter(user => user.status === "ACTIVE").map(user => ({ value: user.id, label: user.email }))} />
        <Button variant="primary" disabled={loading || busy || users.length === 0}>{busy ? "Creating…" : "Create organization"}</Button>
      </form>
    </details>
    <div className="platform-toolbar" role="search">
      <label><span>Search</span><input type="search" placeholder="Search name, code, slug, or email" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <Dropdown label="Status" value={status} onChange={setStatus} options={[{ value: "ALL", label: "All statuses" }, ...statuses.map((value) => ({ value, label: human(value) }))]} />
      <span className="platform-result-count">{filtered.length} of {organizations.length}</span>
    </div>
    {loading ? <Notice tone="info">Loading organizations…</Notice> : error ? <Notice>{error}</Notice>
      : filtered.length === 0 ? <Empty>No organizations match the current filters.</Empty>
      : <div className="platform-table"><table><thead><tr><th>Organization</th><th>Code</th><th>Status</th><th>Primary contact</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{filtered.map((organization) => <tr key={organization.id}><td><strong>{organization.name}</strong><small>{organization.slug}</small></td><td>{organization.organizationCode}</td><td><StatusBadge value={organization.status} /></td><td>{organization.primaryEmail}</td><td>{formatDate(organization.updatedAt)}</td><td><Link className="table-action" to={appPath(`/platform/organizations/${organization.id}`)}>View details</Link></td></tr>)}</tbody></table></div>}
  </Page>;
}

export function PlatformOrganizationDetailPage() {
  const { organizationId = "" } = useParams();
  const auth = useAuth(), application = useApplicationContext(), navigate = useNavigate();
  const [organization, setOrganization] = useState<PlatformOrganization | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [plans, setPlans] = useState<PlatformPlan[]>([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    Promise.all([getPlatformOrganization(organizationId), getPlatformPlans()]).then(([item, catalog]) => { setOrganization(item); setPlans(catalog.filter(plan => plan.status === "ACTIVE" && ["starter", "business"].includes(plan.key))); })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load organization."))
      .finally(() => setLoading(false));
  }, [organizationId]);
  if (loading) return <Page title="Organization"><Notice tone="info">Loading organization…</Notice></Page>;
  if (error || !organization) return <Page title="Organization"><Notice>{error || "Organization was not found."}</Notice></Page>;
  const membership = auth.organizations.find((item) => item.organizationId === organization.id);
  const enter = () => {
    if (!membership) return;
    if (consoleHost() === "platform") window.location.assign(consoleUrl("client", { organization: organization.slug }));
    else { auth.selectOrganization(organization.slug); application.enterClient(); navigate("/overview"); }
  };
  return <Page title={organization.name} description={`${organization.organizationCode} · ${organization.slug}`}>
    {notice && <Notice tone="success">{notice}</Notice>}
    <section className="card"><h2>Organization setup</h2>
      <p>Activate this organization, assign its plan, then have its administrator enter Horizon and create a workspace.</p>
      {["PENDING", "TRIAL", "SUSPENDED"].includes(organization.status) && <Button disabled={busy} onClick={() => {
        setBusy(true); setNotice("");
        void activatePlatformOrganization(organizationId).then(async (updated) => { setOrganization(updated); await auth.reloadOrganizations(); setNotice("Organization activated. Assign a plan before workspace setup."); })
          .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to activate organization."))
          .finally(() => setBusy(false));
      }}>Activate organization</Button>}
      <form className="toolbar" onSubmit={(event) => {
        event.preventDefault(); setBusy(true); setNotice("");
        const planKey = String(new FormData(event.currentTarget).get("planKey"));
        void assignPlatformOrganizationPlan(organizationId, planKey).then((updated) => { setOrganization(updated); setNotice("Plan assigned. The organization administrator can now create a workspace."); })
          .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to assign plan."))
          .finally(() => setBusy(false));
      }}><Dropdown label="Organization plan" name="planKey" required placeholder="Choose plan" options={plans.map(plan => ({ value: plan.key, label: plan.displayName }))} /><Button disabled={busy || plans.length === 0}>Assign plan</Button></form>
    </section>
    <div className="platform-detail-actions"><Link to={appPath("/platform/organizations")}>← Organizations</Link>{membership && <Button variant="primary" onClick={enter}>Enter organization</Button>}</div>
    {!membership && <Notice tone="info">Platform Access is separate from organization membership. An active membership is required to enter this client organization.</Notice>}
    <div className="platform-detail-grid">
      <section className="platform-panel"><header><div><span className="eyebrow">Overview</span><h2>Organization profile</h2></div><StatusBadge value={organization.status} /></header><dl className="platform-definition-list">
        <Definition label="Legal name" value={organization.legalName} /><Definition label="Primary email" value={organization.primaryEmail} /><Definition label="Primary phone" value={organization.primaryPhone} /><Definition label="Created" value={formatDate(organization.createdAt)} /><Definition label="Last updated" value={formatDate(organization.updatedAt)} />
      </dl></section>
      <section className="platform-panel"><header><div><span className="eyebrow">Lifecycle</span><h2>Operational status</h2></div></header><dl className="platform-definition-list">
        <Definition label="Trial started" value={formatOptionalDate(organization.trialStartedAt)} /><Definition label="Trial ends" value={formatOptionalDate(organization.trialEndsAt)} /><Definition label="Activated" value={formatOptionalDate(organization.activatedAt)} /><Definition label="Suspended" value={formatOptionalDate(organization.suspendedAt)} /><Definition label="Cancelled" value={formatOptionalDate(organization.cancelledAt)} />
      </dl></section>
    </div>
  </Page>;
}

export function StatusBadge({ value }: { value: string }) {
  const variant = value === "ACTIVE" ? "success" : value === "SUSPENDED" || value === "INACTIVE" ? "warning" : "neutral";
  return <Badge label={value} variant={variant} />;
}
export function Definition({ label, value }: { label: string; value: string | null | undefined }) { return <div><dt>{label}</dt><dd>{value || "—"}</dd></div>; }
export const formatDate = (value: string) => new Date(value).toLocaleDateString();
const formatOptionalDate = (value: string | null) => value ? formatDate(value) : "—";
