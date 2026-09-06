import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../../api/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { getPlatformOrganization, getPlatformOrganizations, type PlatformOrganization } from "../../features/platform/platformApi";
import { useAuth } from "../../auth/AuthProvider";
import { useApplicationContext } from "../../context/ApplicationContext";
import { appPath, consoleHost, consoleUrl } from "../../app/hostRouting";

export function PlatformOrganizationsPage() {
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("ALL");
  useEffect(() => {
    getPlatformOrganizations().then(setOrganizations)
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
    <div className="platform-toolbar" role="search">
      <label><span>Search</span><input type="search" placeholder="Search name, code, slug, or email" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <span className="platform-result-count">{filtered.length} of {organizations.length}</span>
    </div>
    {loading ? <Notice tone="info">Loading organizations…</Notice> : error ? <Notice>{error}</Notice>
      : filtered.length === 0 ? <Empty>No organizations match the current filters.</Empty>
      : <div className="platform-table"><table><thead><tr><th>Organization</th><th>Code</th><th>Status</th><th>Primary contact</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{filtered.map((organization) => <tr key={organization.id}><td><strong>{organization.name}</strong><small>{organization.slug}</small></td><td>{organization.organizationCode}</td><td><StatusBadge value={organization.status} /></td><td>{organization.primaryEmail}</td><td>{formatDate(organization.updatedAt)}</td><td><Link className="table-action" to={appPath(`/app/platform/organizations/${organization.id}`)}>View details</Link></td></tr>)}</tbody></table></div>}
  </Page>;
}

export function PlatformOrganizationDetailPage() {
  const { organizationId = "" } = useParams();
  const auth = useAuth(), application = useApplicationContext(), navigate = useNavigate();
  const [organization, setOrganization] = useState<PlatformOrganization | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    getPlatformOrganization(organizationId).then(setOrganization)
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load organization."))
      .finally(() => setLoading(false));
  }, [organizationId]);
  if (loading) return <Page title="Organization"><Notice tone="info">Loading organization…</Notice></Page>;
  if (error || !organization) return <Page title="Organization"><Notice>{error || "Organization was not found."}</Notice></Page>;
  const membership = auth.organizations.find((item) => item.organizationId === organization.id);
  const enter = () => {
    if (!membership) return;
    if (consoleHost() === "platform") window.location.assign(consoleUrl("client", { organization: organization.slug }));
    else { auth.selectOrganization(organization.slug); application.enterClient(); navigate("/app"); }
  };
  return <Page title={organization.name} description={`${organization.organizationCode} · ${organization.slug}`}>
    <div className="platform-detail-actions"><Link to={appPath("/app/platform/organizations")}>← Organizations</Link>{membership && <Button variant="primary" onClick={enter}>Enter organization</Button>}</div>
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
