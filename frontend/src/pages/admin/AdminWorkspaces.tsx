import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { ApiError } from "../../api/types";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  createOrganizationWorkspace,
  getOrganizationWorkspaces,
  getProductCatalog,
  setOrganizationWorkspaceStatus,
  type OrganizationWorkspace,
  type ProductCatalogItem,
} from "../../features/admin/workspaceApi";
import { SEMANTIC } from "../../tokens/theme";
import { useTheme } from "../../theme/ThemeProvider";
import { AdminScreen } from "./AdminScreen";
import { getEffectiveEntitlements, getEntitlementLimit, hasEntitlement, type EffectiveEntitlements } from "../../features/entitlements/entitlementApi";
import { useWorkspace } from "../../workspace/WorkspaceProvider";

export function AdminWorkspaces() {
  const { t } = useTheme();
  const workspaceContext = useWorkspace();
  const [effective, setEffective] = useState<EffectiveEntitlements>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [workspaces, setWorkspaces] = useState<OrganizationWorkspace[]>([]);
  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [productKeys, setProductKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [catalog, tenantWorkspaces, snapshot] = await Promise.all([getProductCatalog(), getOrganizationWorkspaces(), getEffectiveEntitlements()]);
      const permitted = catalog.filter(product => hasEntitlement(snapshot, `${product.key}.enabled`));
      setEffective(snapshot); setProducts(permitted); setWorkspaces(tenantWorkspaces);
      setProductKeys((current) => current.length ? current.filter(key => permitted.some(product => product.key === key)) : permitted.map(product => product.key));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Unable to load workspace registry");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy("create"); setError(null);
    try {
      const created = await createOrganizationWorkspace({ key, displayName, productKeys });
      setWorkspaces((current) => [...current, created].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setKey(""); setDisplayName("");
      await workspaceContext.reload();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to create workspace"); }
    finally { setBusy(null); }
  }

  async function toggle(workspace: OrganizationWorkspace) {
    setBusy(workspace.key); setError(null);
    try {
      const updated = await setOrganizationWorkspaceStatus(workspace.key, workspace.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      setWorkspaces((current) => current.map((item) => item.key === updated.key ? updated : item));
      await workspaceContext.reload();
    } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Unable to update workspace"); }
    finally { setBusy(null); }
  }

  const field: CSSProperties = { width: "100%", padding: "8px 9px", border: `1px solid ${t.border}`, borderRadius: 7, background: t.field, color: t.ink };
  const limit = getEntitlementLimit(effective, "platform.workspace_limit");
  const active = workspaces.filter(workspace => workspace.status === "ACTIVE").length;
  const full = limit !== null && active >= limit;
  return <AdminScreen sectionKey="workspaces" title="Workspaces">
    <p style={{ color: t.muted, marginTop: 0 }}>Provision products as organization workspaces. Workspace keys are stable tenant-facing identifiers.</p>
    {limit !== null && <p>{active} / {limit} active workspaces · {effective[0]?.planName}</p>}
    {error && <div role="alert" style={{ marginBottom: 12, color: SEMANTIC.danger.fg }}>{error}</div>}
    <form onSubmit={(event) => void create(event)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "end", border: `1px solid ${t.border}`, borderRadius: 10, padding: 14 }}>
      <label style={{ color: t.muted, fontSize: 12 }}>Workspace key<input required pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?" value={key} onChange={(event) => setKey(event.target.value.toLowerCase())} style={field} /></label>
      <label style={{ color: t.muted, fontSize: 12 }}>Display name<input required value={displayName} onChange={(event) => setDisplayName(event.target.value)} style={field} /></label>
      <label style={{ color: t.muted, fontSize: 12 }}>Products<select multiple required value={productKeys} onChange={(event) => setProductKeys(Array.from(event.target.selectedOptions, option => option.value))} style={field}>{products.map((product) => <option key={product.key} value={product.key}>{product.displayName}</option>)}</select></label>
      <Button type="submit" variant="primary" disabled={loading || full || busy !== null || products.length === 0}>Create workspace</Button>
    </form>
    {loading ? <p style={{ color: t.muted }}>Loading workspaces…</p> : workspaces.length === 0 ? <p style={{ color: t.muted }}>No workspaces have been provisioned.</p> :
      <div style={{ marginTop: 14, border: `1px solid ${t.border}`, borderRadius: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", color: t.body }}><thead><tr>{["Workspace", "Key", "Product", "Status", "Action"].map((heading) => <th key={heading} style={{ padding: 11, textAlign: "left", borderBottom: `1px solid ${t.border}` }}>{heading}</th>)}</tr></thead>
          <tbody>{workspaces.map((workspace) => <tr key={workspace.key}>
            <td style={{ padding: 11 }}>{workspace.displayName}</td><td style={{ padding: 11 }}><code>{workspace.key}</code></td><td style={{ padding: 11 }}>{workspace.products.map(product => product.displayName).join(", ")}</td>
            <td style={{ padding: 11 }}><Badge label={workspace.status} variant={workspace.status === "ACTIVE" ? "success" : "neutral"} /></td>
            <td style={{ padding: 11 }}><Button size="sm" variant={workspace.status === "ACTIVE" ? "destructive" : "secondary"} disabled={busy !== null} onClick={() => void toggle(workspace)}>{workspace.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button></td>
          </tr>)}</tbody></table>
      </div>}
  </AdminScreen>;
}
