import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useApplicationContext } from "../../context/ApplicationContext";
import { ApiError } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { Empty, Notice, Page } from "../../components/ui/Page";
import { getPlatformOrganizations, type PlatformOrganization } from "../../features/platform/platformApi";
import { StatusBadge } from "./PlatformOrganizationsPage";
import { appPath, consoleHost, consoleUrl } from "../../app/hostRouting";

export function PlatformWorkspacesPage() {
  const auth = useAuth(), application = useApplicationContext(), navigate = useNavigate();
  const [organizations, setOrganizations] = useState<PlatformOrganization[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => { getPlatformOrganizations().then(setOrganizations).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Unable to load organizations.")).finally(() => setLoading(false)); }, []);
  const enter = (organization: PlatformOrganization) => { if (consoleHost() === "platform") window.location.assign(consoleUrl("client", { organization: organization.slug })); else { auth.selectOrganization(organization.slug); application.enterClient(); navigate("/app/admin/workspaces"); } };
  return <Page title="Workspaces" description="Workspace management remains scoped to an explicit client organization context.">
    <Notice tone="info">Horizon does not expose tenant workspace records globally. Enter an organization where you have active membership to view products, status, and capacity from the authoritative tenant APIs.</Notice>
    {loading ? <Notice tone="info">Loading organizations…</Notice> : error ? <Notice>{error}</Notice> : organizations.length === 0 ? <Empty>No organizations are available.</Empty>
      : <div className="platform-table"><table><thead><tr><th>Organization</th><th>Status</th><th>Workspace access</th><th></th></tr></thead><tbody>{organizations.map((organization) => {
        const membership = auth.organizations.find((item) => item.organizationId === organization.id);
        return <tr key={organization.id}><td><strong>{organization.name}</strong><small>{organization.organizationCode}</small></td><td><StatusBadge value={organization.status} /></td><td>{membership ? `${membership.membershipRole} membership` : "No organization membership"}</td><td>{membership ? <Button size="sm" onClick={() => enter(organization)}>Enter workspaces</Button> : <Link className="table-action" to={appPath(`/app/platform/organizations/${organization.id}`)}>View organization</Link>}</td></tr>;
      })}</tbody></table></div>}
  </Page>;
}
