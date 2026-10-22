import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "./SidebarIcon";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { appPath } from "../app/hostRouting";

export function ContextSelector() {
  const auth = useAuth();
  const workspace = useWorkspace();
  const navigate = useNavigate();

  const [orgOpen, setOrgOpen] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const [orgQuery, setOrgQuery] = useState("");

  const orgContainerRef = useRef<HTMLDivElement>(null);
  const wsContainerRef = useRef<HTMLDivElement>(null);

  const role = auth.organization?.membershipRole;
  const adminRole = role === "ADMIN";
  // A sole, selected option has nothing to switch to. Administrators keep the menus for their management links.
  const orgSwitchable = adminRole || !auth.organization || auth.organizations.length !== 1;
  const wsSwitchable = adminRole || !workspace.workspace || workspace.workspaces.length !== 1;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (orgContainerRef.current && !orgContainerRef.current.contains(e.target as Node)) {
        setOrgOpen(false);
      }
      if (wsContainerRef.current && !wsContainerRef.current.contains(e.target as Node)) {
        setWsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOrgOpen(false);
        setWsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  const handleOrgChange = (slug: string) => {
    auth.selectOrganization(slug);
    setOrgOpen(false);
    navigate(appPath("/app"));
  };

  const handleWsChange = (key: string) => {
    workspace.selectWorkspace(key);
    setWsOpen(false);
    navigate(appPath("/app"));
  };

  const filteredOrgs = auth.organizations.filter(
    (item) =>
      item.organizationName.toLowerCase().includes(orgQuery.toLowerCase()) ||
      item.slug.toLowerCase().includes(orgQuery.toLowerCase())
  );

  return (
    <div className="context-selector-group">
      {/* Accessible native selects for screen readers and automated test harnesses */}
      <select
        aria-label="Organization"
        className="sr-only"
        tabIndex={-1}
        value={auth.organization?.slug ?? ""}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          auth.selectOrganization(event.target.value);
          navigate(appPath("/app"));
        }}
      >
        <option value="">Choose organization</option>
        {auth.organizations.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.organizationName}
          </option>
        ))}
      </select>

      <select
        aria-label="Workspace"
        className="sr-only"
        tabIndex={-1}
        disabled={!auth.organization || workspace.loading}
        value={workspace.workspace?.key ?? ""}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          workspace.selectWorkspace(event.target.value);
          navigate(appPath("/app"));
        }}
      >
        <option value="">Choose workspace</option>
        {workspace.workspaces.map((item) => (
          <option key={item.key} value={item.key}>
            {item.displayName} · {item.products.map((product) => product.displayName).join(", ")}
          </option>
        ))}
      </select>

      {/* Modern Atlassian-style Organization Switcher */}
      <div className="context-dropdown-container" ref={orgContainerRef}>
        <button
          type="button"
          className={`context-dropdown-trigger ${orgOpen ? "open" : ""} ${orgSwitchable ? "" : "static"}`}
          onClick={() => {
            if (!orgSwitchable) return;
            setOrgOpen(!orgOpen);
            setWsOpen(false);
          }}
          aria-haspopup={orgSwitchable ? "listbox" : undefined}
          aria-expanded={orgSwitchable ? orgOpen : undefined}
          aria-label={`Current organization: ${auth.organization?.organizationName ?? "Choose organization"}`}
        >
          <span className="context-icon org">
            <Icon name="building" size={14} />
          </span>
          <div className="context-text">
            <span className="context-label">Organization</span>
            <span className="context-value">
              {auth.organization?.organizationName ?? "Choose organization"}
            </span>
          </div>
          {auth.organization?.membershipRole && (
            <span className={`context-role-badge ${auth.organization.membershipRole.toLowerCase()}`}>
              {auth.organization.membershipRole}
            </span>
          )}
          {orgSwitchable && <span className="context-chevron">
            <Icon name="chevronDown" size={12} />
          </span>}
        </button>

        {orgOpen && orgSwitchable && (
          <div className="context-popover" role="listbox" aria-label="Organizations">
            <div className="context-popover-header">
              <span>Organizations</span>
              <small>{auth.organizations.length} available</small>
            </div>

            {auth.organizations.length > 4 && (
              <div className="context-search-wrap">
                <Icon name="search" size={13} />
                <input
                  type="text"
                  placeholder="Filter organizations…"
                  value={orgQuery}
                  onChange={(e) => setOrgQuery(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            <div className="context-popover-list">
              {filteredOrgs.length === 0 ? (
                <div className="context-empty">No matching organizations</div>
              ) : (
                filteredOrgs.map((item) => {
                  const isSelected = item.slug === auth.organization?.slug;
                  return (
                    <button
                      type="button"
                      key={item.slug}
                      className={`context-popover-item ${isSelected ? "selected" : ""}`}
                      onClick={() => handleOrgChange(item.slug)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="item-icon">
                        <Icon name="building" size={14} />
                      </span>
                      <div className="item-details">
                        <strong>{item.organizationName}</strong>
                        <small>{item.slug}</small>
                      </div>
                      <span className={`item-role-tag ${item.membershipRole.toLowerCase()}`}>
                        {item.membershipRole}
                      </span>
                      {isSelected && (
                        <span className="item-selected-check">
                          <Icon name="check" size={13} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {adminRole && (
              <div className="context-popover-footer">
                <Link
                  to={appPath("/organization")}
                  onClick={() => setOrgOpen(false)}
                >
                  <Icon name="settings" size={13} />
                  <span>Organization settings</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modern Atlassian-style Workspace Switcher */}
      <div className="context-dropdown-container" ref={wsContainerRef}>
        <button
          type="button"
          className={`context-dropdown-trigger ${wsOpen ? "open" : ""} ${
            !auth.organization || workspace.loading ? "disabled" : ""
          } ${wsSwitchable ? "" : "static"}`}
          disabled={!auth.organization || workspace.loading}
          onClick={() => {
            if (!wsSwitchable) return;
            setWsOpen(!wsOpen);
            setOrgOpen(false);
          }}
          aria-haspopup={wsSwitchable ? "listbox" : undefined}
          aria-expanded={wsSwitchable ? wsOpen : undefined}
          aria-label={`Current workspace: ${workspace.workspace?.displayName ?? "Choose workspace"}`}
        >
          <span className="context-icon ws">
            <Icon name="layers" />
          </span>
          <div className="context-text">
            <span className="context-label">Workspace</span>
            <span className="context-value">
              {workspace.loading
                ? "Loading…"
                : workspace.workspace?.displayName ?? "Choose workspace"}
            </span>
          </div>
          {workspace.workspace?.products && workspace.workspace.products.length > 0 && (
            <div className="context-product-chips">
              {workspace.workspace.products.map((p) => (
                <span key={p.key} className="product-chip">
                  {p.displayName}
                </span>
              ))}
            </div>
          )}
          {wsSwitchable && <span className="context-chevron">
            <Icon name="chevronDown" size={12} />
          </span>}
        </button>

        {wsOpen && wsSwitchable && (
          <div className="context-popover" role="listbox" aria-label="Workspaces">
            <div className="context-popover-header">
              <span>Workspaces in {auth.organization?.organizationName}</span>
              <small>{workspace.workspaces.length} active</small>
            </div>

            <div className="context-popover-list">
              {workspace.workspaces.length === 0 ? (
                <div className="context-empty">
                  <p>No active workspaces</p>
                  {adminRole && (
                    <Link
                      to={appPath("/organization/workspaces")}
                      className="button primary sm"
                      onClick={() => setWsOpen(false)}
                    >
                      Provision workspace
                    </Link>
                  )}
                </div>
              ) : (
                workspace.workspaces.map((item) => {
                  const isSelected = item.key === workspace.workspace?.key;
                  return (
                    <button
                      type="button"
                      key={item.key}
                      className={`context-popover-item ${isSelected ? "selected" : ""}`}
                      onClick={() => handleWsChange(item.key)}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className="item-icon ws">
                        <Icon name="layers" />
                      </span>
                      <div className="item-details">
                        <strong>{item.displayName}</strong>
                        <div className="item-products-row">
                          <code>{item.key}</code>
                          {item.products.map((p) => (
                            <span key={p.key} className="item-product-tag">
                              {p.displayName}
                            </span>
                          ))}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="item-selected-check">
                          <Icon name="check" size={13} />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {adminRole && (
              <div className="context-popover-footer">
                <Link
                  to={appPath("/organization/workspaces")}
                  onClick={() => setWsOpen(false)}
                >
                  <Icon name="plus" />
                  <span>Create or manage workspaces</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
