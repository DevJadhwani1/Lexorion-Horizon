import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError } from "../../api/types";
import { Empty, Notice, Page } from "../../components/ui/Page";
import {
  getPlatformAccess, getPlatformEntitlements, getPlatformPlans, getPlatformProducts, getPlatformUsers, updatePlatformAccessRole, updatePlatformAccessStatus,
  type PlatformAccessRecord, type PlatformEntitlement, type PlatformPlan, type PlatformProduct, type PlatformUser,
} from "../../features/platform/platformApi";
import { Definition, StatusBadge, formatDate } from "./PlatformOrganizationsPage";

type ResourceSection = "users" | "access" | "products" | "plans" | "entitlements" | "settings";

export function PlatformResourcesPage({ section }: { section: ResourceSection }) {
  const auth = useAuth();
  if (section === "settings") return <Page title="Settings" description="Platform account and access context.">
    <section className="platform-panel platform-account"><header><div><span className="eyebrow">Platform account</span><h2>{auth.user?.firstName} {auth.user?.lastName}</h2></div><StatusBadge value={auth.user?.platformAccess?.active ? "ACTIVE" : "INACTIVE"} /></header>
      <dl className="platform-definition-list"><Definition label="Email" value={auth.user?.email} /><Definition label="Platform role" value={auth.user?.platformAccess?.role} /><Definition label="Context" value="Platform Access" /></dl>
      <p className="platform-note">Platform Access is operator authorization and does not grant organization membership.</p>
    </section>
  </Page>;
  return <ResourceDirectory section={section} />;
}

function ResourceDirectory({ section }: { section: Exclude<ResourceSection, "settings"> }) {
  const [items, setItems] = useState<Array<PlatformUser | PlatformAccessRecord | PlatformProduct | PlatformPlan | PlatformEntitlement>>([]);
  const [plans, setPlans] = useState<PlatformPlan[]>([]);
  const [access, setAccess] = useState<PlatformAccessRecord[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [query, setQuery] = useState(""), [status, setStatus] = useState("ALL"), [type, setType] = useState("ALL"), [product, setProduct] = useState("ALL"), [selectedKey, setSelectedKey] = useState<string | null>(null);
  const config = resourceConfiguration[section];
  useEffect(() => {
    setLoading(true); setError(""); setSelectedKey(null); setQuery(""); setStatus("ALL"); setType("ALL"); setProduct("ALL");
    const request = config.load();
    const planRequest = section === "products" || section === "entitlements" ? getPlatformPlans() : Promise.resolve([]);
    const accessRequest = section === "users" ? getPlatformAccess() : Promise.resolve([]);
    Promise.all([request, planRequest, accessRequest]).then(([records, planRecords, accessRecords]) => { setItems(records); setPlans(planRecords); setAccess(accessRecords); })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load Platform data."))
      .finally(() => setLoading(false));
  }, [section]);
  const filtered = useMemo(() => items.filter((item) => {
    const searchable = searchText(item).toLowerCase();
    const itemStatus = "status" in item ? String(item.status) : "";
    const itemType = "valueType" in item ? item.valueType : "";
    const itemProduct = "key" in item ? String(item.key).split(".")[0] : "";
    return (!query.trim() || searchable.includes(query.trim().toLowerCase())) && (status === "ALL" || itemStatus === status)
      && (type === "ALL" || itemType === type) && (product === "ALL" || itemProduct === product);
  }), [items, query, status, type, product]);
  const statuses = distinct(items.map((item) => "status" in item ? String(item.status) : ""));
  const types = section === "entitlements" ? distinct((items as PlatformEntitlement[]).map((item) => item.valueType)) : [];
  const products = section === "entitlements" ? distinct((items as PlatformEntitlement[]).map((item) => item.key.split(".")[0])) : [];
  const selected = items.find((item, index) => recordKey(item, index) === selectedKey);
  return <Page title={config.title} description={config.description}>
    {section === "access" && <Notice tone="info">Platform Access is operator authorization. It is separate from organization membership and organization roles.</Notice>}
    <div className="platform-toolbar" role="search">
      <label><span>Search</span><input type="search" placeholder={`Search ${config.title.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {statuses.length > 1 && <label><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>}
      {products.length > 1 && <label><span>Product</span><select value={product} onChange={(event) => setProduct(event.target.value)}><option value="ALL">All products</option>{products.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>}
      {types.length > 1 && <label><span>Value type</span><select value={type} onChange={(event) => setType(event.target.value)}><option value="ALL">All value types</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label>}
      <span className="platform-result-count">{filtered.length} of {items.length}</span>
    </div>
    {loading ? <Notice tone="info">Loading {config.title.toLowerCase()}…</Notice> : error ? <Notice>{error}</Notice> : filtered.length === 0 ? <Empty>No {config.title.toLowerCase()} match the current filters.</Empty>
      : <ResourceTable section={section} items={filtered} plans={plans} access={access} onSelect={setSelectedKey} onAccessUpdate={(updated) => setItems((current) => current.map((item) => "userId" in item && item.userId === updated.userId ? updated : item))} onError={setError} />}
    {selected && <ResourceDetail item={selected} section={section} plans={plans} access={access} onClose={() => setSelectedKey(null)} />}
  </Page>;
}

const resourceConfiguration = {
  users: { title: "Users", description: "Platform user directory.", load: getPlatformUsers },
  access: { title: "Platform Access", description: "Operator access to the Horizon Platform Console.", load: getPlatformAccess },
  products: { title: "Products", description: "Products and modules registered in the Horizon catalog.", load: getPlatformProducts },
  plans: { title: "Plans", description: "Commercial configuration returned by the Platform service.", load: getPlatformPlans },
  entitlements: { title: "Entitlements", description: "Capability and capacity definitions used by Horizon plans.", load: getPlatformEntitlements },
} as const;

function ResourceTable({ section, items, plans, access, onSelect, onAccessUpdate, onError }: { section: Exclude<ResourceSection, "settings">; items: Array<PlatformUser | PlatformAccessRecord | PlatformProduct | PlatformPlan | PlatformEntitlement>; plans: PlatformPlan[]; access: PlatformAccessRecord[]; onSelect(key: string): void; onAccessUpdate(value: PlatformAccessRecord): void; onError(message: string): void }) {
  const headers = section === "users" ? ["User", "Status", "Platform Access", "Created"] : section === "access" ? ["Account", "Role", "Status", "Granted"]
    : section === "products" ? ["Product", "Key", "Status", "Plans"] : section === "plans" ? ["Plan", "Status", "Employee limit", "Workspace limit", "Enabled products"]
      : ["Entitlement", "Key", "Product", "Value type", "Status"];
  return <div className="platform-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>
    {items.map((item, index) => <tr key={recordKey(item, index)}>{section === "users" ? <UserRow item={item as PlatformUser} access={access.find((record) => record.userId === (item as PlatformUser).id)} /> : section === "access" ? <AccessRow item={item as PlatformAccessRecord} onUpdate={onAccessUpdate} onError={onError} /> : section === "products" ? <ProductRow item={item as PlatformProduct} plans={plans} /> : section === "plans" ? <PlanRow item={item as PlatformPlan} /> : <EntitlementRow item={item as PlatformEntitlement} />}<td><button className="table-action button-link" onClick={() => onSelect(recordKey(item, index))}>Details</button></td></tr>)}
  </tbody></table></div>;
}
function UserRow({ item, access }: { item: PlatformUser; access?: PlatformAccessRecord }) { return <><td><strong>{item.firstName} {item.lastName}</strong><small>{item.email}</small></td><td><StatusBadge value={item.status} /></td><td>{access ? <><StatusBadge value={access.status} /><small>{access.role}</small></> : "None"}</td><td>{formatDate(item.createdAt)}</td></>; }
function AccessRow({ item, onUpdate, onError }: { item: PlatformAccessRecord; onUpdate(value: PlatformAccessRecord): void; onError(message: string): void }) { const change = (request: Promise<PlatformAccessRecord>) => request.then(onUpdate).catch((reason) => onError(reason instanceof ApiError ? reason.message : "Unable to update Platform Access.")); return <><td><strong>{item.userEmail}</strong><small>Platform Access</small></td><td><select aria-label={`Role for ${item.userEmail}`} value={item.role} onChange={(event) => void change(updatePlatformAccessRole(item.userId, event.target.value))}>{["SUPER_ADMIN", "ADMIN", "OPERATIONS", "SUPPORT"].map((role) => <option key={role}>{role}</option>)}</select></td><td><select aria-label={`Status for ${item.userEmail}`} value={item.status} onChange={(event) => void change(updatePlatformAccessStatus(item.userId, event.target.value))}>{["ACTIVE", "INACTIVE", "SUSPENDED"].map((status) => <option key={status}>{status}</option>)}</select></td><td>{formatDate(item.grantedAt)}</td></>; }
function ProductRow({ item, plans }: { item: PlatformProduct; plans: PlatformPlan[] }) { const count = plans.filter((plan) => enabledProducts(plan).includes(item.key)).length; return <><td><strong>{item.displayName}</strong><small>{item.description || "No description"}</small></td><td><code>{item.key}</code></td><td><StatusBadge value={item.status} /></td><td>{count}</td></>; }
function PlanRow({ item }: { item: PlatformPlan }) { return <><td><strong>{item.displayName}</strong><small>{item.description || item.key}</small></td><td><StatusBadge value={item.status} /></td><td>{limit(item, "employee_limit")}</td><td>{limit(item, "workspace_limit")}</td><td><ProductList values={enabledProducts(item)} /></td></>; }
function EntitlementRow({ item }: { item: PlatformEntitlement }) { return <><td><strong>{item.displayName}</strong><small>{item.description || "No description"}</small></td><td><code>{item.key}</code></td><td>{humanize(item.key.split(".")[0])}</td><td>{humanize(item.valueType)}</td><td><StatusBadge value={item.status} /></td></>; }

function ResourceDetail({ item, section, plans, access, onClose }: { item: PlatformUser | PlatformAccessRecord | PlatformProduct | PlatformPlan | PlatformEntitlement; section: Exclude<ResourceSection, "settings">; plans: PlatformPlan[]; access: PlatformAccessRecord[]; onClose(): void }) {
  let content: ReactNode;
  if (section === "plans") { const plan = item as PlatformPlan; content = <><DetailHeader eyebrow="Plan" title={plan.displayName} status={plan.status} onClose={onClose} /><div className="platform-detail-grid"><DetailSection title="General"><Definition label="Key" value={plan.key} /><Definition label="Description" value={plan.description} /></DetailSection><DetailSection title="Capacity"><Definition label="Employee limit" value={String(limit(plan, "employee_limit"))} /><Definition label="Workspace limit" value={String(limit(plan, "workspace_limit"))} /></DetailSection><DetailSection title="Products and entitlements"><Definition label="Enabled products" value={enabledProducts(plan).map(humanize).join(", ") || "None"} />{plan.entitlements.map((value) => <Definition key={value.key} label={value.key} value={String(value.integerValue ?? (value.booleanValue ? "Enabled" : "Disabled"))} />)}</DetailSection></div></>; }
  else if (section === "products") { const value = item as PlatformProduct; const associated = plans.filter((plan) => enabledProducts(plan).includes(value.key)); const entitlementKeys = distinct(associated.flatMap((plan) => plan.entitlements.map((entry) => entry.key).filter((key) => key.startsWith(`${value.key}.`)))); content = <><DetailHeader eyebrow="Catalog product" title={value.displayName} status={value.status} onClose={onClose} /><DetailSection title="Product details"><Definition label="Key" value={value.key} /><Definition label="Description" value={value.description} /><Definition label="Associated plans" value={associated.map((plan) => plan.displayName).join(", ") || "None"} /><Definition label="Entitlements" value={entitlementKeys.join(", ") || "None"} /></DetailSection></>; }
  else if (section === "entitlements") { const value = item as PlatformEntitlement; const usedBy = plans.filter((plan) => plan.entitlements.some((entry) => entry.key === value.key)); content = <><DetailHeader eyebrow="Entitlement" title={value.displayName} status={value.status} onClose={onClose} /><DetailSection title="Definition"><Definition label="Key" value={value.key} /><Definition label="Product" value={humanize(value.key.split(".")[0])} /><Definition label="Value type" value={humanize(value.valueType)} /><Definition label="Description" value={value.description} /><Definition label="Plans using entitlement" value={usedBy.map((plan) => plan.displayName).join(", ") || "None"} /></DetailSection></>; }
  else if (section === "users") { const value = item as PlatformUser; const operator = access.find((record) => record.userId === value.id); content = <><DetailHeader eyebrow="Platform user" title={`${value.firstName} ${value.lastName}`} status={value.status} onClose={onClose} /><DetailSection title="Directory record"><Definition label="Email" value={value.email} /><Definition label="Platform Access" value={operator ? `${operator.role} · ${operator.status}` : "None"} /><Definition label="Created" value={formatDate(value.createdAt)} /><Definition label="Updated" value={formatDate(value.updatedAt)} /></DetailSection></>; }
  else { const value = item as PlatformAccessRecord; content = <><DetailHeader eyebrow="Platform Access" title={value.userEmail} status={value.status} onClose={onClose} /><DetailSection title="Operator authorization"><Definition label="Role" value={value.role} /><Definition label="Granted" value={formatDate(value.grantedAt)} /><Definition label="Updated" value={formatDate(value.updatedAt)} /></DetailSection><p className="platform-note">This access is separate from organization membership.</p></>; }
  return <section className="platform-detail" aria-live="polite">{content}</section>;
}
function DetailHeader({ eyebrow, title, status, onClose }: { eyebrow: string; title: string; status: string; onClose(): void }) { return <header><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><div className="detail-heading-actions"><StatusBadge value={status} /><button className="detail-close" aria-label="Close details" onClick={onClose}>×</button></div></header>; }
function DetailSection({ title, children }: { title: string; children: ReactNode }) { return <section className="platform-detail-section"><h3>{title}</h3><dl className="platform-definition-list">{children}</dl></section>; }
function ProductList({ values }: { values: string[] }) { return values.length ? <div className="product-tags">{values.map((value) => <span key={value}>{humanize(value)}</span>)}</div> : <>—</>; }
function enabledProducts(plan: PlatformPlan) { return plan.entitlements.filter((value) => value.valueType === "BOOLEAN" && value.booleanValue && value.key.endsWith(".enabled")).map((value) => value.key.slice(0, -".enabled".length)); }
function limit(plan: PlatformPlan, suffix: string): number | string { return plan.entitlements.find((value) => value.valueType === "INTEGER" && value.key.endsWith(suffix))?.integerValue ?? "—"; }
function recordKey(item: PlatformUser | PlatformAccessRecord | PlatformProduct | PlatformPlan | PlatformEntitlement, index: number) { return "id" in item ? String(item.id) : "key" in item ? item.key : String(index); }
function searchText(item: PlatformUser | PlatformAccessRecord | PlatformProduct | PlatformPlan | PlatformEntitlement) { return Object.values(item).filter((value) => typeof value === "string").join(" "); }
function distinct(values: string[]) { return [...new Set(values.filter(Boolean))].sort(); }
const humanize = (value: string) => value.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
