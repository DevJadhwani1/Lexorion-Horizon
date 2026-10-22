import { useEffect, useRef, useState } from "react";
import { Icon } from "../../layout/SidebarIcon";
import { Button } from "../../components/ui/Button";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "help" | "docs";
}

export function HelpModal({ open, onClose, initialTab = "help" }: HelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"help" | "docs">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="onboarding-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="onboarding-modal-dialog help-modal-dialog"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="onboarding-modal-header">
          <div className="onboarding-modal-title-group">
            <span className="onboarding-modal-icon">
              <Icon name="help" size={18} />
            </span>
            <div>
              <h2 id="help-modal-title">Help & Documentation</h2>
              <p>Guides, keyboard shortcuts, and support for your organization</p>
            </div>
          </div>
          <button
            type="button"
            className="onboarding-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="help-modal-tabs">
          <button
            type="button"
            className={`help-tab-btn ${tab === "help" ? "active" : ""}`}
            onClick={() => setTab("help")}
          >
            <Icon name="help" size={14} />
            <span>Help & Support</span>
          </button>
          <button
            type="button"
            className={`help-tab-btn ${tab === "docs" ? "active" : ""}`}
            onClick={() => setTab("docs")}
          >
            <Icon name="document" size={14} />
            <span>Setup Documentation</span>
          </button>
        </div>

        <div className="onboarding-modal-body help-modal-body">
          {tab === "help" ? (
            <div className="help-content-section">
              <div className="help-card">
                <h3>Organization Onboarding Guide</h3>
                <p>
                  Setting up Lexorion Horizon requires four simple, verified steps:
                </p>
                <ol className="help-step-list">
                  <li>
                    <strong>Organization details:</strong> Confirm your organization name, legal name, contact email, and primary phone. These ensure correct regional records.
                  </li>
                  <li>
                    <strong>Create workspace:</strong> Workspaces isolate people, departments, and payroll calculations. Each workspace inherits products enabled by your plan.
                  </li>
                  <li>
                    <strong>Set up access:</strong> Review administrators and send email invitations to team members or managers.
                  </li>
                  <li>
                    <strong>Review & enter:</strong> Confirm all details and transition directly into your operational dashboard.
                  </li>
                </ol>
              </div>

              <div className="help-card">
                <h3>Keyboard Shortcuts</h3>
                <div className="help-shortcut-row">
                  <span>Toggle navigation sidebar</span>
                  <kbd>⇧⌘S</kbd> or <kbd>Ctrl ⇧ S</kbd>
                </div>
                <div className="help-shortcut-row">
                  <span>Close dialogs / popovers</span>
                  <kbd>Esc</kbd>
                </div>
                <div className="help-shortcut-row">
                  <span>Form navigation</span>
                  <kbd>Tab</kbd> / <kbd>⇧ Tab</kbd>
                </div>
              </div>

              <div className="help-card highlight">
                <h3>Lexorion Enterprise Support</h3>
                <p>
                  Need assistance with setup, employee migration, or plan customization?
                </p>
                <p>
                  Contact support at{" "}
                  <a href="mailto:support@lexorion.com" className="help-link">
                    support@lexorion.com
                  </a>
                </p>
              </div>
            </div>
          ) : (
            <div className="help-content-section">
              <div className="help-search-box">
                <Icon name="search" size={14} />
                <input
                  type="text"
                  placeholder="Filter documentation topics…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="help-doc-articles">
                <article className="help-doc-card">
                  <h4>Tenant Architecture & Isolation</h4>
                  <p>
                    Every organization is isolated at the database, access context, and audit recorder layers. Workspaces provide logical isolation for business units and regional subsidiaries.
                  </p>
                </article>

                <article className="help-doc-card">
                  <h4>Workforce & Payroll Prerequisites</h4>
                  <p>
                    Workforce employees must be created and marked active before enrollment into payroll compensation profiles. Once active, compensation components calculate automatically during monthly or bi-weekly pay runs.
                  </p>
                </article>

                <article className="help-doc-card">
                  <h4>Plan Entitlements</h4>
                  <p>
                    Starter and Business plans define maximum employee count, workspace capacity, and payroll calculation features. Platform administrators manage plan assignments from the Platform Console.
                  </p>
                </article>
              </div>
            </div>
          )}
        </div>

        <footer className="onboarding-modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </footer>
      </div>
    </div>
  );
}
