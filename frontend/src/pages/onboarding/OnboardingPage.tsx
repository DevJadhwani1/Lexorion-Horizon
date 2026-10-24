import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useWorkspace } from "../../workspace/WorkspaceProvider";
import { appPath } from "../../app/hostRouting";
import { Icon } from "../../layout/SidebarIcon";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Notice, Page } from "../../components/ui/Page";
import { useOnboarding } from "../../features/onboarding/useOnboarding";
import { useOnboardingContext } from "../../features/onboarding/OnboardingContext";
import {
  EditDetailsModal,
  CreateWorkspaceModal,
  InviteMemberModal,
} from "../../features/onboarding/OnboardingModals";
import { HelpModal } from "../../features/onboarding/HelpModal";

export function OnboardingPage() {
  const auth = useAuth();
  const workspaceContext = useWorkspace();
  const navigate = useNavigate();

  let onboardingState: ReturnType<typeof useOnboarding>;
  try {
    onboardingState = useOnboardingContext();
  } catch {
    onboardingState = useOnboarding();
  }

  const {
    loading,
    error,
    organization,
    workspaces,
    members,
    entitlements,
    step1Complete,
    step2Complete,
    step3Complete,
    step4Complete,
    step2Locked,
    step3Locked,
    step4Locked,
    completedCount,
    totalSteps,
    percentage,
    setupStatus,
    reload,
    saveDetails,
    createWorkspace,
    invite,
    confirmAccessSolo,
    finishOnboarding,
    pendingInvitationCount,
    steps,
  } = onboardingState;

  const [activeModal, setActiveModal] = useState<
    "none" | "edit-details" | "create-ws" | "invite-member" | "help" | "docs"
  >("none");
  const [finishError, setFinishError] = useState("");

  const orgName = organization?.name || auth.organization?.organizationName || "Your organization";
  const firstWorkspace = workspaces.find((w) => w.status === "ACTIVE") || workspaces[0];

  const handleFinishAndEnter = () => {
    setFinishError("");
    void finishOnboarding()
      .then(() => {
        void workspaceContext.reload();
        navigate(appPath("/overview"));
      })
      .catch((reason) => setFinishError(reason instanceof Error ? reason.message : "Setup could not be finished."));
  };

  if (loading) {
    return (
      <Page title="Set up your organization">
        <div className="onboarding-loading-state" role="status">
          <span className="onboarding-loading-spinner" />
          <p>Loading organization setup state…</p>
        </div>
      </Page>
    );
  }

  if (error && !organization) {
    return (
      <Page title="Set up your organization">
        <Notice tone="error">{error}</Notice>
        <div style={{ marginTop: 16 }}>
          <Button variant="secondary" onClick={() => void reload()}>
            Retry loading
          </Button>
        </div>
      </Page>
    );
  }

  const statusVariant =
    setupStatus === "COMPLETED"
      ? "success"
      : setupStatus === "READY_FOR_REVIEW"
      ? "neutral"
      : "neutral";

  const statusDisplay =
    setupStatus === "COMPLETED"
      ? "Complete"
      : setupStatus === "READY_FOR_REVIEW"
      ? "Ready for review"
      : setupStatus === "IN_PROGRESS"
      ? "In progress"
      : "Action required";

  return (
    <div className="onboarding-page-container">
      {/* 1. Welcome Area */}
      <section className="onboarding-welcome-hero" aria-labelledby="onboarding-heading">
        <div className="onboarding-welcome-content">
          <div className="onboarding-welcome-badge">
            <span className="onboarding-welcome-pill">Organization setup</span>
          </div>
          <h1 id="onboarding-heading" className="onboarding-welcome-title">
            Set up your organization
          </h1>
          <p className="onboarding-welcome-subtitle">
            Complete a few essential steps to configure your organization and create your first HR
            workspace. You can always return and continue later.
          </p>
        </div>
        <div className="onboarding-welcome-accent" aria-hidden="true">
          <div className="welcome-accent-circle">
            <img src="/brand-icon.svg" alt="" className="welcome-accent-logo" />
          </div>
        </div>
      </section>

      {/* 2. Organization Summary & Progress Overview (Responsive 2-column) */}
      <section className="onboarding-overview-grid" aria-label="Organization overview and setup progress">
        {/* Left Column: Organization Summary Card */}
        <div className="onboarding-overview-card org-summary-card">
          <div className="overview-card-header">
            <div>
              <span className="summary-eyebrow">Organization</span>
              <div className="summary-name-row">
                <h2 id="setup-progress-title" className="summary-org-name">{orgName}</h2>
                <Badge label={statusDisplay} variant={statusVariant} />
              </div>
            </div>
            <button
              type="button"
              className="button secondary sm edit-details-btn"
              onClick={() => setActiveModal("edit-details")}
            >
              <Icon name="edit" size={13} />
              <span>Edit details</span>
            </button>
          </div>

          <div className="org-summary-meta-grid">
            <div className="org-meta-cell">
              <span className="meta-label">Primary contact</span>
              <strong className="meta-value">{organization?.primaryEmail || auth.user?.email || "Not configured"}</strong>
            </div>
            <div className="org-meta-cell">
              <span className="meta-label">Regional settings</span>
              <strong className="meta-value">
                {organization?.settings?.currency || "USD"} · {organization?.settings?.timeZone || "UTC"}
              </strong>
            </div>
            <div className="org-meta-cell">
              <span className="meta-label">Active plan</span>
              <strong className="meta-value">
                {entitlements.length > 0
                  ? [...new Set(entitlements.map((e) => e.planName))].join(", ")
                  : "Enterprise Plan"}
              </strong>
            </div>
            <div className="org-meta-cell">
              <span className="meta-label">Administrator</span>
              <strong className="meta-value">{auth.user?.firstName || "Admin"} ({auth.user?.email})</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Setup Progress Overview Card */}
        <div className="onboarding-overview-card progress-summary-card">
          <div className="overview-card-header">
            <div>
              <span className="summary-eyebrow">Setup progress</span>
              <div className="progress-headline-row">
                <h3 className="progress-headline">{completedCount} of {totalSteps} steps completed</h3>
                <span className="progress-percent-badge">{percentage}%</span>
              </div>
            </div>
            <span className="progress-status-pill">
              {percentage === 100 ? "Ready to launch" : "Setup in progress"}
            </span>
          </div>

          {/* Progress Bar Track */}
          <div
            className="onboarding-progress-track"
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Overall setup progress: ${percentage}%`}
          >
            <div className="onboarding-progress-fill" style={{ width: `${percentage}%` }} />
          </div>

          <div className="progress-summary-footer">
            <p className="summary-meta-text">
              Setup progress: <strong>{completedCount} of {totalSteps} steps completed</strong> ({percentage}%)
            </p>
            <p className="progress-hint-text">
              {step1Complete && !step2Complete
                ? "Step 1 complete! Create your first HR workspace in Step 2 to activate capabilities."
                : !step1Complete
                ? "Get started by completing required organization details in Step 1."
                : !step3Complete
                ? "Workspace created! Configure team access and permissions in Step 3."
                : step4Complete
                ? "All 4 steps complete! Review your configuration and enter your workspace."
                : "Almost done! Review your setup and finalize."}
            </p>
          </div>
        </div>
      </section>

      {/* 3. Setup Stepper (Four-column equal-width grid) */}
      <section className="onboarding-stepper-section" aria-label="Setup stages">
        <div className="onboarding-stages-stepper">
          {/* Stage 1 */}
          <div className={`stage-step-item ${step1Complete ? "completed" : "active"}`}>
            <div className="stage-step-indicator">
              {step1Complete ? <Icon name="check" size={14} className="check-icon" /> : <span>1</span>}
            </div>
            <div className="stage-step-content">
              <span className="stage-step-title">Organization details</span>
              <span className="stage-step-sub">{step1Complete ? "Completed" : "Action required"}</span>
            </div>
          </div>

          {/* Stage 2 */}
          <div className={`stage-step-item ${step2Complete ? "completed" : step2Locked ? "locked" : "active"}`}>
            <div className="stage-step-indicator">
              {step2Complete ? (
                <Icon name="check" size={14} className="check-icon" />
              ) : step2Locked ? (
                <Icon name="lock" size={14} className="lock-icon" />
              ) : (
                <span>2</span>
              )}
            </div>
            <div className="stage-step-content">
              <span className="stage-step-title">Workspace setup</span>
              <span className="stage-step-sub">
                {step2Complete ? "Configured" : step2Locked ? "Locked" : "Next step"}
              </span>
            </div>
          </div>

          {/* Stage 3 */}
          <div className={`stage-step-item ${step3Complete ? "completed" : step3Locked ? "locked" : "active"}`}>
            <div className="stage-step-indicator">
              {step3Complete ? (
                <Icon name="check" size={14} className="check-icon" />
              ) : step3Locked ? (
                <Icon name="lock" size={14} className="lock-icon" />
              ) : (
                <span>3</span>
              )}
            </div>
            <div className="stage-step-content">
              <span className="stage-step-title">Access & members</span>
              <span className="stage-step-sub">
                {step3Complete ? "Ready" : step3Locked ? "Locked" : "In progress"}
              </span>
            </div>
          </div>

          {/* Stage 4 */}
          <div className={`stage-step-item ${step4Complete ? "completed" : step4Locked ? "locked" : "active"}`}>
            <div className="stage-step-indicator">
              {step4Complete ? (
                <Icon name="check" size={14} className="check-icon" />
              ) : step4Locked ? (
                <Icon name="lock" size={14} className="lock-icon" />
              ) : (
                <span>4</span>
              )}
            </div>
            <div className="stage-step-content">
              <span className="stage-step-title">Review and finish</span>
              <span className="stage-step-sub">
                {step4Complete ? "Finished" : step4Locked ? "Locked" : "Final step"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Setup Checklist Cards */}
      <section className="onboarding-checklist-section" aria-label="Setup checklist">
        <div className="onboarding-checklist-grid">
          {/* Step 1 Card: Organization Details */}
          <article
            className={`onboarding-step-card ${step1Complete ? "step-completed" : "step-active"}`}
            aria-labelledby="card-step-1-title"
          >
            <div className="step-card-header">
              <div className="step-badge-wrap">
                <span className="step-number-tag">Step 1</span>
                {step1Complete ? (
                  <Badge label="Completed" variant="success" />
                ) : (
                  <Badge label="Action required" variant="neutral" />
                )}
              </div>
              <h3 id="card-step-1-title" className="step-card-title">
                Organization details
              </h3>
              <p className="step-card-desc">
                Verify your organization name and complete required business and contact
                information to ensure compliance and proper regional defaults.
              </p>
            </div>

            <div className="step-card-body">
              {step1Complete ? (
                <div className="step-data-preview">
                  <div className="data-preview-item">
                    <span>Name</span>
                    <strong>{organization?.name || orgName}</strong>
                  </div>
                  {organization?.legalName && (
                    <div className="data-preview-item">
                      <span>Legal name</span>
                      <strong>{organization.legalName}</strong>
                    </div>
                  )}
                  <div className="data-preview-item">
                    <span>Primary email</span>
                    <strong>{organization?.primaryEmail || auth.user?.email}</strong>
                  </div>
                  {organization?.primaryPhone && (
                    <div className="data-preview-item">
                      <span>Primary phone</span>
                      <strong>{organization.primaryPhone}</strong>
                    </div>
                  )}
                  <div className="data-preview-item">
                    <span>Regional defaults</span>
                    <strong>
                      {organization?.settings?.currency || "USD"} ·{" "}
                      {organization?.settings?.timeZone || "UTC"}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="step-callout info">
                  <Icon name="info" size={14} />
                  <span>{steps.details.explanation}</span>
                </div>
              )}
            </div>

            <div className="step-card-footer">
              <Button
                variant={step1Complete ? "secondary" : "primary"}
                onClick={() => setActiveModal("edit-details")}
              >
                {step1Complete ? "Edit details" : "Complete details"}
              </Button>
              <Link to={appPath("/organization")} className="step-secondary-link">
                Organization settings →
              </Link>
            </div>
          </article>

          {/* Step 2 Card: Create your workspace */}
          <article
            className={`onboarding-step-card ${
              step2Complete
                ? "step-completed"
                : step2Locked
                ? "step-locked"
                : "step-active"
            }`}
            aria-labelledby="card-step-2-title"
          >
            <div className="step-card-header">
              <div className="step-badge-wrap">
                <span className="step-number-tag">Step 2</span>
                {step2Complete ? (
                  <Badge label="Completed" variant="success" />
                ) : step2Locked ? (
                  <span className="step-status-locked">
                    <Icon name="lock" size={12} />
                    <span>Locked</span>
                  </span>
                ) : (
                  <Badge label="Ready to set up" variant="neutral" />
                )}
              </div>
              <h3 id="card-step-2-title" className="step-card-title">
                Create your workspace
              </h3>
              <p className="step-card-desc">
                Configure your first HR workspace to activate Horizon Workforce and Payroll
                capabilities for your organization.
              </p>
            </div>

            <div className="step-card-body">
              {step2Locked ? (
                <div className="step-callout locked">
                  <Icon name="lock" size={14} />
                  <span>
                    Locked. Complete and save your organization details in Step 1 first.
                  </span>
                </div>
              ) : step2Complete && firstWorkspace ? (
                <div className="step-data-preview">
                  <div className="data-preview-item">
                    <span>Workspace name</span>
                    <strong>{firstWorkspace.displayName}</strong>
                  </div>
                  <div className="data-preview-item">
                    <span>Workspace key</span>
                    <code>{firstWorkspace.key}</code>
                  </div>
                  <div className="data-preview-item">
                    <span>Status</span>
                    <Badge label={firstWorkspace.status} variant="success" />
                  </div>
                  <div className="data-preview-item">
                    <span>Enabled products</span>
                    <strong>
                      {firstWorkspace.products.length ? firstWorkspace.products.map((p) => p.displayName).join(", ") : "No products attached"}
                    </strong>
                  </div>
                </div>
              ) : (
                <div className="step-callout ready">
                  <Icon name="panels" size={14} />
                  <span>{steps.workspace.explanation}</span>
                </div>
              )}
            </div>

            <div className="step-card-footer">
              <Button
                variant={step2Complete ? "secondary" : "primary"}
                disabled={step2Locked}
                onClick={() => setActiveModal("create-ws")}
              >
                {step2Complete ? "Add another workspace" : "Set up workspace"}
              </Button>
              <Link
                to={appPath("/organization/workspaces")}
                className={`step-secondary-link ${step2Locked ? "disabled-link" : ""}`}
              >
                Workspace registry →
              </Link>
            </div>
          </article>

          {/* Step 3 Card: Set up access */}
          <article
            className={`onboarding-step-card ${
              step3Complete
                ? "step-completed"
                : step3Locked
                ? "step-locked"
                : "step-active"
            }`}
            aria-labelledby="card-step-3-title"
          >
            <div className="step-card-header">
              <div className="step-badge-wrap">
                <span className="step-number-tag">Step 3</span>
                {step3Complete ? (
                  <Badge label="Completed" variant="success" />
                ) : step3Locked ? (
                  <span className="step-status-locked">
                    <Icon name="lock" size={12} />
                    <span>Locked</span>
                  </span>
                ) : (
                  <Badge label="In progress" variant="neutral" />
                )}
              </div>
              <h3 id="card-step-3-title" className="step-card-title">
                Set up access
              </h3>
              <p className="step-card-desc">
                Review organization administrators and invite team members, managers, and
                specialists to collaborate.
              </p>
            </div>

            <div className="step-card-body">
              {step3Locked ? (
                <div className="step-callout locked">
                  <Icon name="lock" size={14} />
                  <span>
                    Locked. Create your first workspace in Step 2 before configuring member access.
                  </span>
                </div>
              ) : (
                <div className="step-data-preview">
                  <p className="snapshot-note">{steps.access.explanation}</p>
                  <div className="data-preview-item">
                    <span>Active members</span>
                    <strong>{members.length} member{members.length === 1 ? "" : "s"}</strong>
                  </div>
                  <div className="data-preview-item">
                    <span>Pending invitations</span>
                    <strong>{pendingInvitationCount} invitation{pendingInvitationCount === 1 ? "" : "s"}</strong>
                  </div>
                  <div className="data-preview-item">
                    <span>Primary administrator</span>
                    <strong>{auth.user?.email || "Current user"}</strong>
                  </div>
                </div>
              )}
            </div>

            <div className="step-card-footer">
              <div className="step-actions-cluster">
                <Button
                  variant={step3Complete ? "secondary" : "primary"}
                  disabled={step3Locked}
                  onClick={() => setActiveModal("invite-member")}
                >
                  Invite members
                </Button>
                {!step3Complete && !step3Locked && members.length <= 1 && pendingInvitationCount === 0 && (
                  <button
                    type="button"
                    className="button secondary sm confirm-access-btn"
                    onClick={() => { setFinishError(""); void confirmAccessSolo().catch((reason) => setFinishError(reason instanceof Error ? reason.message : "The solo administrator decision could not be saved.")); }}
                  >
                    Continue as solo admin
                  </button>
                )}
              </div>
              <Link
                to={appPath("/organization/invitations")}
                className={`step-secondary-link ${step3Locked ? "disabled-link" : ""}`}
              >
                Manage invitations →
              </Link>
            </div>
          </article>

          {/* Step 4 Card: Review and finish */}
          <article
            className={`onboarding-step-card ${
              step4Complete
                ? "step-completed"
                : step4Locked
                ? "step-locked"
                : "step-active"
            }`}
            aria-labelledby="card-step-4-title"
          >
            <div className="step-card-header">
              <div className="step-badge-wrap">
                <span className="step-number-tag">Step 4</span>
                {step4Complete ? (
                  <Badge label="Ready" variant="success" />
                ) : step4Locked ? (
                  <span className="step-status-locked">
                    <Icon name="lock" size={12} />
                    <span>Locked</span>
                  </span>
                ) : (
                  <Badge label="Ready to launch" variant="neutral" />
                )}
              </div>
              <h3 id="card-step-4-title" className="step-card-title">
                Review and finish
              </h3>
              <p className="step-card-desc">
                Summarize completed setup and enter your configured workspace to begin operations.
              </p>
            </div>

            <div className="step-card-body">
              {step4Locked ? (
                <div className="step-callout locked">
                  <Icon name="lock" size={14} />
                  <span>
                    Locked. Complete organization details and create your workspace to review setup.
                  </span>
                </div>
              ) : (
                <div className="step-data-preview finish-summary">
                  <div className="data-preview-item">
                    <span>Organization</span>
                    <strong>{organization?.name || orgName}</strong>
                  </div>
                  <div className="data-preview-item">
                    <span>First workspace</span>
                    <strong>{firstWorkspace?.displayName || "Main HR"} ({firstWorkspace?.key || "main"})</strong>
                  </div>
                  <div className="data-preview-item">
                    <span>Activated products</span>
                    <strong>
                      {firstWorkspace?.products.length
                        ? firstWorkspace.products.map((p) => p.displayName).join(", ")
                        : "No products attached"}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            <div className="step-card-footer">
              {!step4Complete && <p className="snapshot-note">{steps.finish.explanation}</p>}
              {finishError && <Notice>{finishError}</Notice>}
              <Button
                variant="primary"
                disabled={step4Locked}
                onClick={handleFinishAndEnter}
                className="finish-step-cta"
              >
                Finish setup & enter workspace →
              </Button>
            </div>
          </article>
        </div>
      </section>

      {/* 4. Supporting Cards */}
      <section className="onboarding-support-section" aria-label="Organization resources and guidance">
        <div className="onboarding-support-grid">
          <div className="support-card">
            <span className="support-card-icon">
              <Icon name="shield" size={18} />
            </span>
            <h4>Security and privacy</h4>
            <p>
              Strict tenant isolation, role-based authorization, and tamper-evident audit logging
              protect your organization data.
            </p>
            <Link to={appPath("/organization/settings")} className="support-card-link">
              Security settings →
            </Link>
          </div>

          <div className="support-card">
            <span className="support-card-icon">
              <Icon name="user" size={18} />
            </span>
            <h4>Inviting the team</h4>
            <p>
              Add department managers and employees with granular permission controls tailored to
              each role.
            </p>
            <Link to={appPath("/organization/invitations")} className="support-card-link">
              Manage invitations →
            </Link>
          </div>

          <div className="support-card">
            <span className="support-card-icon">
              <Icon name="badge" size={18} />
            </span>
            <h4>Flexible growth</h4>
            <p>
              Expand workspaces, increase employee allowances, and add payroll calculation
              capabilities seamlessly.
            </p>
            <Link to={appPath("/organization/settings/product-access")} className="support-card-link">
              View product access →
            </Link>

          </div>

          <div className="support-card">
            <span className="support-card-icon">
              <Icon name="help" size={18} />
            </span>
            <h4>Help and documentation</h4>
            <p>
              Step-by-step setup walkthroughs, keyboard shortcuts, and direct access to the Lexorion
              support team.
            </p>
            <button
              type="button"
              className="support-card-btn"
              onClick={() => setActiveModal("help")}
            >
              Open help guide →
            </button>
          </div>
        </div>
      </section>

      {/* Modals */}
      <EditDetailsModal
        open={activeModal === "edit-details"}
        onClose={() => setActiveModal("none")}
        organization={organization}
        onSave={saveDetails}
      />

      <CreateWorkspaceModal
        open={activeModal === "create-ws"}
        onClose={() => setActiveModal("none")}
        entitlements={entitlements}
        onCreate={createWorkspace}
      />

      <InviteMemberModal
        open={activeModal === "invite-member"}
        onClose={() => setActiveModal("none")}
        onInvite={invite}
      />

      <HelpModal
        open={activeModal === "help" || activeModal === "docs"}
        initialTab={activeModal === "docs" ? "docs" : "help"}
        onClose={() => setActiveModal("none")}
      />
    </div>
  );
}
