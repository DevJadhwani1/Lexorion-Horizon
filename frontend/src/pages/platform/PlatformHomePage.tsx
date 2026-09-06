import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Page } from "../../components/ui/Page";
import { Button } from "../../components/ui/Button";
import { getPlatformAccess, getPlatformOrganizations, getPlatformPlans, getPlatformProducts, getPlatformUsers } from "../../features/platform/platformApi";
import { StatusBadge, formatDate } from "./PlatformOrganizationsPage";
import { appPath } from "../../app/hostRouting";

const loaders = { organizations: getPlatformOrganizations, users: getPlatformUsers, access: getPlatformAccess, products: getPlatformProducts, plans: getPlatformPlans };
type Resource = keyof typeof loaders;
type DashboardData = { [K in Resource]?: Awaited<ReturnType<typeof loaders[K]>> };

export function PlatformHomePage() {
  const [data, setData] = useState<DashboardData>({});
  const [failed, setFailed] = useState<Resource[]>([]);
  const [pending, setPending] = useState<Resource[]>(Object.keys(loaders) as Resource[]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setData({}); setFailed([]); setPending(Object.keys(loaders) as Resource[]);
    for (const key of Object.keys(loaders) as Resource[]) {
      void loaders[key]().then(value => { if (live) setData(previous => ({ ...previous, [key]: value })); })
        .catch(() => { if (live) setFailed(previous => [...previous, key]); })
        .finally(() => { if (live) setPending(previous => previous.filter(item => item !== key)); });
    }
    return () => { live = false; };
  }, [revision]);
  const state = (key: Resource, children: ReactNode, empty: boolean) => pending.includes(key)
    ? <p className="platform-note" role="status">Loading {key === "access" ? "Platform Access" : key}…</p>
    : failed.includes(key) ? <p className="platform-note" role="alert">Unable to load {key === "access" ? "Platform Access" : key}. Retry using Refresh overview.</p>
      : empty ? <p className="platform-note">No {key} configured.</p> : children;
  const attention = data.organizations?.filter(item => item.status !== "ACTIVE") ?? [];
  const organizations = [...(data.organizations ?? [])].sort((a, b) => Number(a.status === "ACTIVE") - Number(b.status === "ACTIVE") || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 6);
  const activeCount = (key: "organizations" | "users" | "products" | "plans") => data[key] ? `${data[key].filter(item => item.status === "ACTIVE").length} active` : "Current platform records";
  return <div className="horizon-dashboard"><Page title="Horizon" description="Manage organizations, access, products, plans and workspaces across Horizon."
    actions={<Button size="sm" disabled={pending.length > 0} onClick={() => setRevision(value => value + 1)}>{pending.length ? "Refreshing…" : "Refresh overview"}</Button>}>
    <div className="platform-overview">
      {failed.length > 0 && <div className="overview-warning" role="alert">Some platform data is unavailable. Available records remain visible; refresh to retry.</div>}
      <div className="platform-metrics" aria-label="Platform summary">
        {([ ["organizations", "Organizations"], ["users", "Users"], ["products", "Products"], ["plans", "Plans"]] as const).map(([key, label]) => <Link key={key} className="platform-metric" to={appPath(`/app/platform/${key}`)}>
          <span>{label}<span aria-hidden="true">↗</span></span><strong>{data[key]?.length ?? "—"}</strong><small>{pending.includes(key) ? "Loading…" : failed.includes(key) ? "Data unavailable" : activeCount(key)}</small>
        </Link>)}
      </div>
      <section className="platform-section"><header><div><span className="eyebrow">Organization operations</span><h2>Organizations</h2><p>Status and contact details. Inactive records appear first.</p></div><Link className="platform-section-link" to={appPath("/app/platform/organizations")}>View all organizations →</Link></header>
        {state("organizations", <div className="platform-table compact" role="region" aria-label="Organization records, scroll horizontally for more columns" tabIndex={0}><table><thead><tr><th>Organization</th><th>Status</th><th>Primary contact</th><th>Updated</th><th><span className="overview-sr-only">Actions</span></th></tr></thead><tbody>{organizations.map(organization => <tr key={organization.id}>
          <td><Link className="overview-org-link" to={appPath(`/app/platform/organizations/${organization.id}`)}>{organization.name}</Link><small>{organization.organizationCode}</small></td><td><StatusBadge value={organization.status} /></td><td className="overview-contact">{organization.primaryEmail || "Not provided"}</td><td>{formatDate(organization.updatedAt)}</td><td><Link className="table-action" aria-label={`Open ${organization.name}`} to={appPath(`/app/platform/organizations/${organization.id}`)}>Open →</Link></td>
        </tr>)}</tbody></table></div>, !organizations.length)}
      </section>
      <div className="platform-dashboard-grid">
        <section className="platform-section"><header><div><span className="eyebrow">Operational status</span><h2>Needs attention</h2></div></header>
          {state("organizations", attention.length ? <><p className="platform-note">{attention.length} organization{attention.length === 1 ? " is" : "s are"} not active. Review lifecycle status before taking action.</p><ul className="platform-record-list">{attention.slice(0, 4).map(item => <li key={item.id}><Link to={appPath(`/app/platform/organizations/${item.id}`)}>{item.name}</Link><StatusBadge value={item.status} /></li>)}</ul>{attention.length > 4 && <Link className="platform-section-link" to={appPath("/app/platform/organizations")}>Review all organizations →</Link>}</> : <div className="overview-clear"><strong>No organization status issues requiring attention.</strong><p>All returned organization records are active, or no organizations have been created.</p></div>, false)}
          <p className="overview-scope">Based on organization lifecycle status. Workspace constraints are reviewed within each organization.</p>
        </section>
        <section className="platform-section"><header><div><span className="eyebrow">Platform operations</span><h2>Access & workspaces</h2></div></header>
          {state("access", <div className="overview-access"><div><strong>{data.access?.filter(item => item.status === "ACTIVE").length}</strong><span>active Platform Access grants</span></div><Link className="platform-section-link" to={appPath("/app/platform/access")}>Review access →</Link></div>, false)}
          <div className="overview-workspaces"><h3>Workspace management</h3><p>Workspace status, products and capacity are available within an organization. A platform-wide workspace total is not available.</p><Link className="platform-section-link" to={appPath("/app/platform/workspaces")}>Explore workspaces →</Link></div>
        </section>
        <section className="platform-section"><header><div><span className="eyebrow">Catalog</span><h2>Products</h2></div><Link className="platform-section-link" to={appPath("/app/platform/products")}>View products →</Link></header>
          {state("products", <ul className="platform-record-list">{data.products?.slice(0, 5).map(product => <li key={product.key}><div><strong>{product.displayName}</strong><small>{product.description || product.key}</small></div><StatusBadge value={product.status} /></li>)}</ul>, !data.products?.length)}
        </section>
        <section className="platform-section"><header><div><span className="eyebrow">Configuration</span><h2>Plans</h2></div><Link className="platform-section-link" to={appPath("/app/platform/plans")}>View plans →</Link></header>
          {state("plans", <ul className="platform-record-list">{data.plans?.slice(0, 5).map(plan => <li key={plan.key}><div><strong>{plan.displayName}</strong><small>{plan.productKey ? data.products?.find(product => product.key === plan.productKey)?.displayName ?? plan.productKey : "No product specified"} · {plan.entitlements.length} entitlements</small></div><StatusBadge value={plan.status} /></li>)}</ul>, !data.plans?.length)}
        </section>
      </div>
    </div>
  </Page></div>;
}
