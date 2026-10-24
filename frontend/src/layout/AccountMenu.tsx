import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "./SidebarIcon";
import { useAuth } from "../auth/AuthProvider";
import { useApplicationContext } from "../context/ApplicationContext";
import { appPath, consoleHost, consoleUrl } from "../app/hostRouting";

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const auth = useAuth();
  const application = useApplicationContext();
  const navigate = useNavigate();

  const user = auth.user;
  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "U";
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || user?.email || "User";
  const role = auth.organization?.membershipRole;

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = containerRef.current?.querySelectorAll<HTMLElement>(".account-popover-link, .account-popover-logout");
        if (!items || items.length === 0) return;
        const list = Array.from(items);
        const currentIdx = list.indexOf(document.activeElement as HTMLElement);
        if (e.key === "ArrowDown") {
          const nextIdx = currentIdx < list.length - 1 ? currentIdx + 1 : 0;
          list[nextIdx]?.focus();
        } else {
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : list.length - 1;
          list[prevIdx]?.focus();
        }
      }
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
    <div className="account-menu-container" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-menu-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${fullName}`}
        title={fullName}
      >
        <span className="account-avatar">{initials}</span>
      </button>

      {open && (
        <div className="account-popover" role="menu" aria-label="User account">
          <div className="account-popover-header">
            <span className="account-avatar lg">{initials}</span>
            <div className="account-popover-user">
              <strong>{fullName}</strong>
              <small title={user?.email}>{user?.email}</small>
              <div className="account-badges">
                {role && (
                  <span className={`badge ${role.toLowerCase()}`}>
                    {role === "ADMIN" ? "Org Admin" : role === "MANAGER" ? "Manager" : "Employee"}
                  </span>
                )}
                {application.hasPlatformAccess && (
                  <span className="badge operator">Platform Admin</span>
                )}
              </div>
            </div>
          </div>

          <div className="account-popover-links">
            <Link to={appPath("/workforce/me")} className="account-popover-link" onClick={close} role="menuitem">
              <span className="account-popover-icon">
                <Icon name="user" size={16} />
              </span>
              <span className="account-popover-label">My workforce profile</span>
            </Link>

            {role === "ADMIN" && (
              <Link to={appPath("/organization")} className="account-popover-link" onClick={close} role="menuitem">
                <span className="account-popover-icon">
                  <Icon name="settings" size={16} />
                </span>
                <span className="account-popover-label">Organization administration</span>
              </Link>
            )}

            {application.hasPlatformAccess && (
              <button
                type="button"
                className="account-popover-link mode-switch"
                role="menuitem"
                onClick={() => {
                  close();
                  if (application.mode === "platform") {
                    if (consoleHost() === "platform") window.location.assign(consoleUrl("client"));
                    else { application.enterClient(); navigate("/overview"); }
                  } else {
                    if (consoleHost() === "client") window.location.assign(consoleUrl("platform"));
                    else { application.enterPlatform(); navigate("/platform"); }
                  }
                }}
              >
                <span className="account-popover-icon">
                  <Icon name="shield" size={16} />
                </span>
                <span className="account-popover-label">
                  {application.mode === "platform" ? "Switch to Client App" : "Switch to Platform Console"}
                </span>
              </button>
            )}
          </div>

          <div className="account-popover-footer">
            <button
              type="button"
              className="account-popover-logout"
              role="menuitem"
              onClick={() => {
                close();
                void auth.logout();
              }}
            >
              <span className="account-popover-icon">
                <Icon name="logout" size={16} />
              </span>
              <span className="account-popover-label">Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
