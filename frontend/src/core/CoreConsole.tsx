import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Empty, Notice, Page } from "../components/ui/Page";
import { CoreSessionProvider, useCoreSession } from "./CoreSession";
import { coreBase } from "./routing";
import { coreRequest, type CoreOrganization, type CoreUser, type CoreProduct, type CoreGrant, type CoreOperator, type CoreSession, type CoreAudit, type CoreMembership } from "./consoleApi";
import "./core.css";

export const coreNavigation = [
  ["", "Overview"], ["organizations", "Organizations"], ["users", "Users"], ["products", "Products"],
  ["product-access", "Product Access"], ["operators", "Platform Operators"], ["sessions", "Sessions"], ["security", "Security"], ["audit", "Audit"],
] as const;
export function CoreConsole() { useEffect(() => { document.title = "Lexorion Core Console"; }, []); return <CoreSessionProvider><BrowserRouter basename={coreBase()}><CoreRoutes /></BrowserRouter></CoreSessionProvider>; }
export function CoreRoutes() { return <Routes><Route path="login" element={<CoreLogin />} /><Route element={<CoreProtected />}>
  <Route index element={<Overview />} /><Route path="organizations" element={<Organizations />} /><Route path="users" element={<Users />} />
  <Route path="products" element={<Products />} /><Route path="product-access" element={<ProductAccess />} /><Route path="operators" element={<Operators />} />
  <Route path="sessions" element={<Sessions />} /><Route path="security" element={<Security />} /><Route path="audit" element={<Audit />} />
  <Route path="*" element={<Page title="Page not found"><Link to="/">Return to overview</Link></Page>} />
</Route></Routes>; }
function CoreProtected() {
  const auth = useCoreSession();
  if (auth.loading) return <div className="loading">Restoring Core session…</div>;
  if (auth.state === "credential-error") return <main className="core-login"><Page title="Unable to verify your session"><Notice>{auth.error || "Core identity is temporarily unavailable."}</Notice><div className="core-actions"><button onClick={() => void auth.reload()}>Retry</button><button onClick={() => void auth.logout()}>Sign out</button></div></Page></main>;
  if (auth.state === "anonymous") return <Navigate to="/login" replace />;
  if (!auth.identity) return <div className="loading">Restoring Core session…</div>;
  if (!auth.identity.coreOperator) return <main className="core-login"><Page title="Core operator access required"><Notice tone="info">You are signed in as {auth.identity.email}. This account does not have global operator access.</Notice><Logout /></Page></main>;
  return <div className="core-console"><aside className="core-sidebar"><Link className="core-brand" to="/">LEXORION <strong>CORE</strong></Link>
    <nav aria-label="Core Console">{coreNavigation.map(([path, label]) => <NavLink key={path} to={`/${path}`} end>{label}</NavLink>)}</nav>
    <div className="core-account"><span>{auth.identity.email}</span><Logout /></div></aside>
    <main className="core-main"><header className="core-topbar"><span>Lexorion Core Console</span><span>Global operator</span></header><Outlet /></main></div>;
}
function Logout() {
  const auth = useCoreSession(); const [error, setError] = useState("");
  return <><button onClick={() => { void auth.logout().catch(e => setError(message(e))); }}>Sign out</button>{error && <Notice>{error}</Notice>}</>;
}
function CoreLogin() {
  const auth = useCoreSession(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (auth.loading) return <div className="loading">Restoring Core session…</div>;
  if (auth.state === "authenticated" && auth.identity) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError("");
    try { await auth.login(String(data.get("email")), String(data.get("password"))); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <main className="core-login"><div className="core-login-card"><span className="eyebrow">LEXORION CORE</span><h1>Sign in to Core Console</h1><p>Manage identity, organizations and product access.</p>
    {(error || auth.error) && <Notice>{error || auth.error}</Notice>}
    {auth.state === "credential-error" && <button type="button" onClick={() => void auth.reload()}>Retry identity check</button>}
    <form onSubmit={submit}><label>Email<input name="email" type="email" required autoComplete="username" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label><button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form></div></main>;
}
function useData<T>(path: string) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0); const reload = useCallback(() => setRevision(r => r + 1), []);
  useEffect(() => { const controller = new AbortController(); setData(null); setLoading(true); setError("");
    coreRequest<T>(path, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) setData(value); }).catch(e => { if (!controller.signal.aborted) setError(message(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, revision]);
  return { data, error, loading, reload };
}
function Load({ state, children }: { state: { error: string; loading: boolean; reload(): void }; children: ReactNode }) {
  return state.loading ? <p role="status">Loading…</p> : state.error ? <Notice>{state.error} <button onClick={state.reload}>Retry</button></Notice> : <>{children}</>;
}
function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return rows.length ? <div className="platform-table"><table><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : <Empty>No records found.</Empty>;
}
function Action({ children, run, done }: { children: ReactNode; run(): Promise<unknown>; done(): void }) {
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <><button disabled={busy} onClick={() => { setBusy(true); setError(""); void run().then(done).catch(e => setError(message(e))).finally(() => setBusy(false)); }}>{busy ? "Saving…" : children}</button>{error && <Notice>{error}</Notice>}</>;
}
function Editor({ title, children, submit, done }: { title: string; children: ReactNode; submit(data: FormData): Promise<unknown>; done(): void }) {
  const [error, setError] = useState(""), [success, setSuccess] = useState(false), [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setSuccess(false); setError("");
    try { await submit(data); form.reset(); setSuccess(true); done(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <details className="core-editor"><summary>{title}</summary><form onSubmit={save}>{children}<button disabled={busy}>{busy ? "Saving…" : "Save"}</button></form>{error && <Notice>{error}</Notice>}{success && <Notice tone="success">Saved.</Notice>}</details>;
}
function Field({ name, label, type = "text", required = true, ...props }: { name: string; label: string; type?: string; required?: boolean; minLength?: number; maxLength?: number }) {
  return <label>{label}<input name={name} type={type} required={required} {...props} /></label>;
}
function Select({ name, label, options }: { name: string; label: string; options: Array<[string, string]> }) { return <label>{label}<select name={name} required><option value="">Select…</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>; }
const text = (d: FormData, key: string) => String(d.get(key) ?? "");
const message = (e: unknown) => e instanceof Error ? e.message : "The request failed.";
const date = (value: string | null) => value ? new Date(value).toLocaleString() : "—";
const json = (method: string, body: unknown) => ({ method, body });

function Overview() {
  const state = useData<Record<string, number>>("/overview"); const auth = useCoreSession(); const associations = useData<Array<{ id: string; name: string; status: string }>>("/me/organizations");
  return <Page title="Overview" description="Identity and access across Lexorion."><Load state={state}><div className="core-metrics">{Object.entries(state.data ?? {}).map(([key, value]) => <article key={key}><span>{key === "productGrants" ? "Product grants" : key}</span><strong>{value}</strong></article>)}</div></Load>
    <section className="core-panel"><h2>Current identity</h2><p>{auth.identity?.email}</p><code>{auth.identity?.userId}</code><h3>Your organization associations</h3><Load state={associations}><Table headers={["Organization", "Lifecycle"]} rows={(associations.data ?? []).map(o => [o.name, o.status])} /></Load></section></Page>;
}
function Organizations() {
  const state = useData<CoreOrganization[]>("/organizations"), users = useData<CoreUser[]>("/users"); const [selected, setSelected] = useState("");
  return <Page title="Organizations" description="Global organization identity and lifecycle."><Load state={state}>
    <Editor title="Create organization" done={state.reload} submit={d => coreRequest("/organizations", json("POST", { name: text(d,"name"), organizationCode: text(d,"organizationCode"), slug: text(d,"slug") || null, primaryEmail: text(d,"primaryEmail"), initialUserId: text(d,"initialUserId") || null }))}>
      <Field name="name" label="Name" maxLength={150} /><Field name="organizationCode" label="Organization code" maxLength={50} /><Field name="slug" label="Slug" required={false} maxLength={63} /><Field name="primaryEmail" label="Primary email" type="email" /><label>Initial member (optional)<select name="initialUserId"><option value="">None</option>{users.data?.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}</select></label>
    </Editor>
    <Table headers={["Organization", "Code", "Lifecycle", "Actions"]} rows={(state.data ?? []).map(o => [o.name, o.organizationCode, o.status, <div className="core-actions"><button onClick={() => setSelected(o.id)}>Memberships</button>{lifecycleTargets(o.status).map(status => <Action key={status} run={() => coreRequest(`/organizations/${o.id}/status`, json("PATCH", { status }))} done={state.reload}>{status.toLowerCase()}</Action>)}</div>])} />
  </Load>{selected && <Memberships organizationId={selected} users={users.data ?? []} />}</Page>;
}
function lifecycleTargets(status: string) { return ({ PENDING: ["ACTIVE", "TRIAL", "CANCELLED"], TRIAL: ["ACTIVE", "SUSPENDED", "CANCELLED"], ACTIVE: ["SUSPENDED", "CANCELLED"], SUSPENDED: ["ACTIVE", "CANCELLED"] } as Record<string,string[]>)[status] ?? []; }
function Memberships({ organizationId, users }: { organizationId: string; users: CoreUser[] }) {
  const state = useData<CoreMembership[]>(`/organizations/${organizationId}/memberships`);
  return <section className="core-panel"><h2>Organization associations</h2><code>{organizationId}</code><Load state={state}>
    <Editor title="Add or update association" done={state.reload} submit={d => coreRequest(`/organizations/${organizationId}/memberships/${text(d,"userId")}`, json("PUT", { status: text(d,"status") }))}><Select name="userId" label="User" options={users.map(u => [u.id,u.email])} /><Select name="status" label="Status" options={["ACTIVE","INACTIVE","SUSPENDED"].map(s => [s,s])} /></Editor>
    <Table headers={["User", "Status"]} rows={(state.data ?? []).map(m => [users.find(u => u.id === m.userId)?.email ?? m.userId, m.status])} /></Load></section>;
}
function Users() {
  const state = useData<CoreUser[]>("/users");
  return <Page title="Users" description="One identity across Lexorion products."><Load state={state}><Editor title="Create user" done={state.reload} submit={d => coreRequest("/users", json("POST", Object.fromEntries(d)))}><Field name="email" label="Email" type="email" /><Field name="firstName" label="First name" /><Field name="lastName" label="Last name" /><Field name="password" label="Initial password" type="password" minLength={8} maxLength={100} /></Editor>
    <Table headers={["Name", "Email", "Status", "Action"]} rows={(state.data ?? []).map(u => [`${u.firstName} ${u.lastName}`, u.email, u.status, <Action run={() => coreRequest(`/users/${u.id}`, json("PATCH", { status: u.status === "ACTIVE" ? "LOCKED" : "ACTIVE" }))} done={state.reload}>{u.status === "ACTIVE" ? "Lock" : "Activate"}</Action>])} /></Load></Page>;
}
function Products() {
  const state = useData<CoreProduct[]>("/products");
  return <Page title="Products" description="Register products without introducing their business domain into Core."><Load state={state}>
    <Editor title="Register product" done={state.reload} submit={d => coreRequest("/products", json("POST", { key: text(d,"key"), displayName: text(d,"displayName"), active: text(d,"active") === "true" }))}><Field name="key" label="Stable product key" maxLength={63} /><Field name="displayName" label="Name" maxLength={150} /><Select name="active" label="Availability" options={[["false","Inactive"],["true","Active"]]} /></Editor>
    <Table headers={["Product", "Key", "Availability", "Action"]} rows={(state.data ?? []).map(p => [p.displayName, p.key, p.active ? "Active" : "Inactive", <Action run={() => coreRequest(`/products/${p.key}`, json("PATCH", { displayName: p.displayName, active: !p.active }))} done={state.reload}>{p.active ? "Deactivate" : "Activate"}</Action>])} /></Load></Page>;
}
function ProductAccess() {
  const state = useData<CoreGrant[]>("/product-access"), orgs = useData<CoreOrganization[]>("/organizations"), products = useData<CoreProduct[]>("/products");
  return <Page title="Product Access" description="Organization enrollment and grant validity. Product permissions remain in each product."><Load state={orgs}><Load state={products}><Load state={state}>
    <Editor title="Grant or update product access" done={state.reload} submit={d => coreRequest(`/organizations/${text(d,"organizationId")}/products/${text(d,"productKey")}`, json("PUT", { status: text(d,"status"), validFrom: text(d,"validFrom") ? new Date(text(d,"validFrom")).toISOString() : null, validUntil: text(d,"validUntil") ? new Date(text(d,"validUntil")).toISOString() : null }))}>
      <Select name="organizationId" label="Organization" options={(orgs.data ?? []).map(o => [o.id,o.name])} /><Select name="productKey" label="Product" options={(products.data ?? []).map(p => [p.key,p.displayName])} /><Select name="status" label="Grant status" options={["ACTIVE","SUSPENDED","REVOKED"].map(s => [s,s])} /><Field name="validFrom" label="Valid from (local time, optional)" type="datetime-local" required={false} /><Field name="validUntil" label="Valid until (local time, optional)" type="datetime-local" required={false} />
    </Editor>
    <Table headers={["Organization", "Product", "Grant status", "From", "Until"]} rows={(state.data ?? []).map(g => [orgs.data?.find(o => o.id === g.organizationId)?.name ?? g.organizationId, products.data?.find(p => p.key === g.productKey)?.displayName ?? g.productKey, g.status, date(g.validFrom), date(g.validUntil)])} /></Load></Load></Load></Page>;
}
function Operators() {
  const state = useData<CoreOperator[]>("/operators"), users = useData<CoreUser[]>("/users");
  return <Page title="Platform Operators" description="Global Core authority is separate from product administration."><Load state={users}><Load state={state}>
    <Editor title="Grant global operator access" done={state.reload} submit={d => coreRequest("/operators", json("POST", Object.fromEntries(d)))}><Select name="userId" label="User" options={(users.data ?? []).filter(u => !state.data?.some(o => o.userId === u.id)).map(u => [u.id,u.email])} /><Select name="role" label="Operator role" options={["SUPER_ADMIN","ADMIN","OPERATIONS","SUPPORT"].map(s => [s,s])} /></Editor>
    <Table headers={["Email", "Role", "Status", "Action"]} rows={(state.data ?? []).map(o => [o.userEmail, o.role, o.status, <Action run={() => coreRequest(`/operators/${o.userId}/status`, json("PATCH", { status: o.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" }))} done={state.reload}>{o.status === "ACTIVE" ? "Suspend" : "Activate"}</Action>])} /></Load></Load></Page>;
}
function Sessions() {
  const state = useData<CoreSession[]>("/sessions");
  return <Page title="Sessions" description="Refresh sessions across Core identity. Revocation stops renewal; issued access tokens retain their configured lifetime."><Load state={state}><Table headers={["User", "Session", "Expires", "Status", "Action"]} rows={(state.data ?? []).map(s => [s.email, <code>{s.sessionId}</code>, date(s.expiresAt), s.active ? "Active" : "Expired or revoked", <Action run={() => coreRequest(`/users/${s.userId}/sessions/revoke`, { method: "POST" })} done={state.reload}>Revoke user sessions</Action>])} /></Load></Page>;
}
function Security() {
  const state = useData<Record<string, string | boolean>>("/security");
  return <Page title="Security" description="Effective identity and session security configuration."><Load state={state}><Table headers={["Setting", "Value"]} rows={Object.entries(state.data ?? {}).map(([k,v]) => [k, String(v)])} /></Load></Page>;
}
function Audit() {
  const [page, setPage] = useState(0); const state = useData<CoreAudit[]>(`/audit?page=${page}`); const location = useLocation();
  return <Page title="Audit" description="Persisted administrative and security events."><Load state={state}><Table headers={["Time", "Actor", "Operation", "Resource", "Result", "Correlation"]} rows={(state.data ?? []).map(e => [date(e.occurredAt), e.actorUserId ?? "System", e.operation, `${e.resourceType} ${e.resourceId ?? ""}`, e.result, e.correlationId ?? "—"])} /></Load>
    <div className="core-actions" aria-label={`Audit pagination ${location.pathname}`}><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={!state.data || state.data.length < 100} onClick={() => setPage(p => p + 1)}>Next</button></div></Page>;
}
