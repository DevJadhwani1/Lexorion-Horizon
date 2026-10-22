import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { appPath } from "../../app/hostRouting";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import {
  createOrganizationWorkspace,
  getOrganizationWorkspaces,
  setOrganizationWorkspaceProducts,
  setOrganizationWorkspaceStatus,
  type OrganizationWorkspace,
} from "../../features/admin/workspaceApi";
import { SEMANTIC } from "../../tokens/theme";
import { useTheme } from "../../theme/ThemeProvider";
import { AdminScreen } from "./AdminScreen";
import {
  getEffectiveEntitlements,
  getEntitlementLimit,
  deriveProductKeysFromEntitlements,
  type EffectiveEntitlements,
} from "../../features/entitlements/entitlementApi";
import { useWorkspace } from "../../workspace/WorkspaceProvider";

export function AdminWorkspaces() {
  const { t } = useTheme();
  const navigate = useNavigate();
  const workspaceContext = useWorkspace();
  const [effective, setEffective] = useState<EffectiveEntitlements>([]);
  const [workspaces, setWorkspaces] = useState<OrganizationWorkspace[]>([]);
  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tenantWorkspaces, snapshot] = await Promise.all([
        getOrganizationWorkspaces(),
        getEffectiveEntitlements(),
      ]);
      setEffective(snapshot);
      setWorkspaces(tenantWorkspaces);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load workspace registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const trimmedName = displayName.trim();
    const trimmedKey = key.trim().toLowerCase();
    if (!trimmedName || !trimmedKey) return;

    if (workspaces.some((w) => w.key.toLowerCase() === trimmedKey)) {
      setError(`Workspace key already exists in this organization: ${trimmedKey}`);
      return;
    }

    setBusy("create");
    setError(null);
    try {
      const productKeys = deriveProductKeysFromEntitlements(effective);
      const created = await createOrganizationWorkspace({
        key: trimmedKey,
        displayName: trimmedName,
        productKeys: productKeys.length > 0 ? productKeys : undefined,
      });
      setWorkspaces((current) => [...current, created].sort((a, b) => a.displayName.localeCompare(b.displayName)));
      // Select from the refreshed accessible list; a superseded or failed reload leaves the selection unchanged.
      await workspaceContext.reload({ select: created.key });
      setKey("");
      setDisplayName("");
      setKeyTouched(false);
      navigate(appPath("/app"));
    } catch (reason) {
      // Retain form input on failure for user recovery/retry
      setError(reason instanceof Error ? reason.message : "Unable to create workspace");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(workspace: OrganizationWorkspace) {
    setBusy(workspace.key); setError(null);
    try {
      const updated = await setOrganizationWorkspaceStatus(workspace.key, workspace.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
      setWorkspaces((current) => current.map((item) => item.key === updated.key ? updated : item));
      await workspaceContext.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update workspace"); }
    finally { setBusy(null); }
  }

  /** Finance is not tied to a plan switch: an administrator attaches it to the workspaces that bill clients. */
  async function toggleFinance(workspace: OrganizationWorkspace) {
    const enabled = workspace.products.some((product) => product.key === "finance");
    if (enabled && !confirm(`Remove Finance from ${workspace.displayName}? Billing data is kept, but nobody can open it until Finance is added again.`)) return;
    const keys = workspace.products.map((product) => product.key).filter((productKey) => productKey !== "finance");
    setBusy(workspace.key); setError(null);
    try {
      const updated = await setOrganizationWorkspaceProducts(workspace.key, enabled ? keys : [...keys, "finance"]);
      setWorkspaces((current) => current.map((item) => item.key === updated.key ? updated : item));
      await workspaceContext.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update workspace products"); }
    finally { setBusy(null); }
  }

  const field: CSSProperties = { width: "100%", padding: "8px 9px", border: `1px solid ${t.border}`, borderRadius: 7, background: t.field, color: t.ink };
  const limit = getEntitlementLimit(effective, "platform.workspace_limit");
  const active = workspaces.filter(workspace => workspace.status === "ACTIVE").length;
  const full = limit !== null && active >= limit;
  const enabledProduct = effective.some((product) => product.entitlements.some((entitlement) =>
    entitlement.valueType === "BOOLEAN" && entitlement.booleanValue === true && entitlement.key.endsWith(".enabled")));

  return <AdminScreen sectionKey="workspaces" title="Workspaces">
    <p style={{ color: t.muted, marginTop: 0 }}>Provision products as organization workspaces. Workspace keys are stable tenant-facing identifiers.</p>
    {limit !== null && <p>{active} / {limit} active workspaces · {effective[0]?.planName}</p>}
    {!loading && effective.length === 0 && !error && (
      <div role="status" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: t.panel, border: `1px solid ${t.border}` }}>
        <span style={{ flex: 1 }}>No active organization plan is assigned. Ask a Horizon platform administrator to assign a Starter or Business plan before creating a workspace.</span>
        <Button size="sm" variant="secondary" onClick={() => void load()}>Retry plan check</Button>
      </div>
    )}
    {!loading && effective.length > 0 && !enabledProduct && !error && (
      <div role="status" style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: t.panel, border: `1px solid ${t.border}` }}>
        <span style={{ flex: 1 }}>The assigned organization plan does not enable any workspace products. Ask a Horizon platform administrator to review the plan.</span>
        <Button size="sm" variant="secondary" onClick={() => void load()}>Retry</Button>
      </div>
    )}
    {!loading && full && <p role="status">This organization has reached its active workspace limit. Deactivate an existing workspace or ask a Horizon platform administrator to increase the plan limit.</p>}
    {error && (
      <div role="alert" style={{ marginBottom: 12, color: SEMANTIC.danger.fg, display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ flex: 1 }}>{error}</span>
        <Button size="sm" variant="secondary" onClick={() => void load()}>Retry</Button>
      </div>
    )}
    <form onSubmit={(event) => void create(event)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, alignItems: "end", border: `1px solid ${t.border}`, borderRadius: 10, padding: 14 }}>
      <label style={{ color: t.muted, fontSize: 12 }}>Display name<input required value={displayName} onChange={(event) => {
        const val = event.target.value;
        setDisplayName(val);
        if (!keyTouched) {
          const slug = val.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
          setKey(slug);
        }
      }} style={field} /></label>
      <label style={{ color: t.muted, fontSize: 12 }}>Workspace key<input required pattern="[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?" value={key} onChange={(event) => { setKeyTouched(true); setKey(event.target.value.toLowerCase()); }} style={field} /></label>
      <Button type="submit" variant="primary" disabled={loading || full || busy !== null || !enabledProduct || effective.length === 0}>Create workspace</Button>
    </form>
    {loading ? <p style={{ color: t.muted }}>Loading workspaces…</p> : workspaces.length === 0 ? <p style={{ color: t.muted }}>No workspaces have been provisioned.</p> :
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {["Workspace", "Key", "Capabilities", "Status", "Action"].map((heading) => (
                <th key={heading}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace) => (
              <tr key={workspace.key}>
                <td><strong>{workspace.displayName}</strong></td>
                <td><code>{workspace.key}</code></td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {workspace.products && workspace.products.length > 0 ? (
                      workspace.products.map(p => (
                        <Badge key={p.key} label={p.displayName || p.key} variant="neutral" />
                      ))
                    ) : (
                      <span style={{ color: t.muted, fontSize: 13 }}>Standard</span>
                    )}
                  </div>
                </td>
                <td><Badge label={workspace.status} variant={workspace.status === "ACTIVE" ? "success" : "neutral"} /></td>
                <td className="row-actions">
                  {workspace.status === "ACTIVE" && effective.length > 0 && (
                    <Button size="sm" disabled={busy !== null} onClick={() => void toggleFinance(workspace)}>
                      {workspace.products.some((product) => product.key === "finance") ? "Remove Finance" : "Add Finance"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={workspace.status === "ACTIVE" ? "destructive" : "secondary"}
                    disabled={busy !== null}
                    onClick={() => void toggle(workspace)}
                  >
                    {workspace.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
  </AdminScreen>;
}
