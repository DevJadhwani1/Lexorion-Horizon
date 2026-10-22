import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "./SidebarIcon";
import { useAuth } from "../auth/AuthProvider";
import { useWorkspace } from "../workspace/WorkspaceProvider";
import { useApplicationContext } from "../context/ApplicationContext";
import { appPath, consoleHost, consoleUrl } from "../app/hostRouting";

export function AppSwitcher() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const auth = useAuth();
  const workspace = useWorkspace();
  const application = useApplicationContext();
  const navigate = useNavigate();

  const role = auth.organization?.membershipRole;
  const adminRole = role === "ADMIN";
  const selectedWs = workspace.workspace;
  const workforceEnabled = Boolean(selectedWs?.products.some(p => p.key === "workforce"));
  const payrollEnabled = Boolean(selectedWs?.products.some(p => p.key === "payroll"));

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="app-switcher-container" ref={containerRef}>
      <button
        type="button"
        className={`app-switcher-trigger ${open ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-label="Horizon product switcher"
        aria-expanded={open}
        title="Switch apps"
      >
        <Icon name="grid" />
      </button>

      {open && (
        <div className="app-switcher-popover" role="dialog" aria-label="Available products">
          <div className="app-switcher-header">
            <span className="app-switcher-heading">Switch to</span>
            <span className="app-switcher-brand">Lexorion Horizon</span>
          </div>

          <div className="app-switcher-section">
            <span className="app-switcher-section-title">Applications</span>

            <Link
              to={appPath(adminRole ? "/app/workforce/dashboard" : "/app/workforce/me")}
              className={`app-switcher-item ${workforceEnabled ? "enabled" : "disabled"}`}
              onClick={close}
            >
              <span className="app-switcher-icon workforce">
                <Icon name="workforce" size={16} />
              </span>
              <div className="app-switcher-info">
                <strong>Horizon Workforce</strong>
                <small>People directory, organizational structure & teams</small>
              </div>
              <span className={`app-switcher-status ${workforceEnabled ? "active" : ""}`}>
                {workforceEnabled ? "Active" : "Not enabled"}
              </span>
            </Link>

            <Link
              to={appPath("/app/payroll/dashboard")}
              className={`app-switcher-item ${payrollEnabled && adminRole ? "enabled" : "disabled"}`}
              onClick={close}
            >
              <span className="app-switcher-icon payroll">
                <Icon name="payroll" size={16} />
              </span>
              <div className="app-switcher-info">
                <strong>Horizon Payroll</strong>
                <small>Compensation profiles, calculation & pay runs</small>
              </div>
              <span className={`app-switcher-status ${payrollEnabled ? "active" : ""}`}>
                {payrollEnabled ? "Active" : "Not enabled"}
              </span>
            </Link>

            {adminRole && (
              <Link
                to={appPath("/organization")}
                className="app-switcher-item enabled"
                onClick={close}
              >
                <span className="app-switcher-icon admin">
                  <Icon name="settings" size={16} />
                </span>
                <div className="app-switcher-info">
                  <strong>Organization Admin</strong>
                  <small>Workspaces, members, invitations & settings</small>
                </div>
                <span className="app-switcher-status active">Admin</span>
              </Link>
            )}

            {application.hasPlatformAccess && (
              <button
                type="button"
                className="app-switcher-item platform-operator"
                onClick={() => {
                  close();
                  if (consoleHost() === "client") {
                    window.location.assign(consoleUrl("platform"));
                  } else {
                    application.enterPlatform();
                    navigate("/app/platform");
                  }
                }}
              >
                <span className="app-switcher-icon platform">
                  <Icon name="shield" size={16} />
                </span>
                <div className="app-switcher-info">
                  <strong>Platform Console</strong>
                  <small>Global tenant registry, plans & catalog</small>
                </div>
                <span className="app-switcher-status operator">Operator</span>
              </button>
            )}
          </div>

          <div className="app-switcher-footer">
            {adminRole ? (
              <Link to={appPath("/organization/workspaces")} onClick={close}>
                <Icon name="panels" size={14} />
                <span>Manage workspace product assignments →</span>
              </Link>
            ) : (
              <Link to={appPath("/app")} onClick={close}>
                <Icon name="home" size={14} />
                <span>Return to Overview</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
