import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../layout/SidebarIcon";
import { appPath } from "../../app/hostRouting";
import { useAuth } from "../../auth/AuthProvider";

interface OnboardingTopBarProps {
  completedSteps?: number;
  totalSteps?: number;
  onOpenHelp: () => void;
}

interface SearchItem {
  title: string;
  category: string;
  path: string;
}

const SEARCH_DESTINATIONS: SearchItem[] = [
  { title: "Dashboard", category: "Setup", path: "/overview" },
  { title: "Organization details", category: "Administration", path: "/organization" },
  { title: "Workspaces", category: "Administration", path: "/organization/workspaces" },
  { title: "Members", category: "Administration", path: "/people" },
  { title: "Invitations", category: "Administration", path: "/organization/invitations" },
  { title: "Settings", category: "Administration", path: "/organization/settings" },
  { title: "Product access", category: "Administration", path: "/organization/settings/product-access" },

];

export function OnboardingTopBar({
  completedSteps = 0,
  totalSteps = 4,
  onOpenHelp,
}: OnboardingTopBarProps) {
  const auth = useAuth();
  const navigate = useNavigate();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  const percentage = Math.round((completedSteps / totalSteps) * 100);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchOpen(false);
      }
      if (
        notifContainerRef.current &&
        !notifContainerRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filteredItems = searchQuery.trim()
    ? SEARCH_DESTINATIONS.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : SEARCH_DESTINATIONS;

  const handleSelect = (path: string) => {
    navigate(appPath(path));
    setSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <div className="onboarding-topbar-controls">
      {/* Global Search */}
      <div className="onboarding-search-container" ref={searchContainerRef}>
        <div
          className={`onboarding-search-input-wrap ${searchOpen ? "active" : ""}`}
          onClick={() => {
            setSearchOpen(true);
            searchInputRef.current?.focus();
          }}
        >
          <Icon name="search" size={13} className="onboarding-search-icon" />
          <input
            ref={searchInputRef}
            type="search"
            className="onboarding-search-input"
            placeholder="Search setup or pages…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchOpen(true)}
            aria-label="Global search navigation"
            aria-expanded={searchOpen}
            aria-controls="onboarding-search-results"
          />
        </div>

        {searchOpen && (
          <div
            id="onboarding-search-results"
            className="onboarding-search-results"
            role="listbox"
            aria-label="Search navigation results"
          >
            <div className="onboarding-search-results-header">
              <span>Quick navigation</span>
              <kbd>Esc</kbd>
            </div>
            <div className="onboarding-search-results-list">
              {filteredItems.length === 0 ? (
                <div className="onboarding-search-empty">No matching pages</div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    className="onboarding-search-result-item"
                    onClick={() => handleSelect(item.path)}
                    role="option"
                    aria-selected="false"
                  >
                    <Icon name="document" size={14} />
                    <div className="result-text">
                      <strong>{item.title}</strong>
                      <small>{item.category}</small>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Setup Progress Indicator */}
      <div
        className="onboarding-progress-pill"
        title={`Setup progress: ${completedSteps} of ${totalSteps} steps completed (${percentage}%)`}
        aria-label={`Setup progress: ${completedSteps} of ${totalSteps} steps completed`}
      >
        <span className="onboarding-progress-pill-label">
          Setup: <strong>{completedSteps}/{totalSteps}</strong>
        </span>
        <div className="onboarding-progress-pill-bar" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="onboarding-progress-pill-fill"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="onboarding-progress-pill-pct">{percentage}%</span>
      </div>

      {/* Help Access */}
      <button
        type="button"
        className="onboarding-topbar-btn"
        onClick={onOpenHelp}
        aria-label="Help and documentation"
        title="Help & Support"
      >
        <Icon name="help" size={16} />
      </button>

      {/* Notifications */}
      <div className="onboarding-notif-container" ref={notifContainerRef}>
        <button
          type="button"
          className={`onboarding-topbar-btn ${notifOpen ? "active" : ""}`}
          onClick={() => setNotifOpen(!notifOpen)}
          aria-label="Notifications"
          aria-expanded={notifOpen}
          aria-haspopup="dialog"
          title="Notifications"
        >
          <Icon name="bell" size={16} />
        </button>

        {notifOpen && (
          <div
            className="onboarding-notif-popover"
            role="dialog"
            aria-label="Notifications"
          >
            <div className="onboarding-notif-header">
              <strong>Notifications</strong>
              <small>{auth.organization?.organizationName}</small>
            </div>
            <div className="onboarding-notif-body">
              <span className="onboarding-notif-icon">
                <Icon name="checkCircle" size={24} />
              </span>
              <p className="onboarding-notif-title">All caught up</p>
              <p className="onboarding-notif-desc">
                No unread notifications or system alerts for this organization.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
