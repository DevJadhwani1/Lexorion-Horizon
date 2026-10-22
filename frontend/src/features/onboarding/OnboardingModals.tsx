import { useState, type FormEvent, useEffect, useMemo } from "react";
import { Icon } from "../../layout/SidebarIcon";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Page";
import { SearchSelect, type SelectOption } from "../../components/ui/SearchSelect";
import { WebsiteInput, validateWebsiteInput } from "../../components/ui/WebsiteInput";
import { PhoneInput, validatePhoneNumber, parsePhoneString } from "../../components/ui/PhoneInput";
import { INDUSTRY_TAXONOMY } from "../../data/industries";
import type { Organization } from "../admin/adminApi";
import { deriveProductKeysFromEntitlements, type EffectiveEntitlements } from "../entitlements/entitlementApi";

const ONBOARDING_INDUSTRY_OPTIONS: SelectOption[] = INDUSTRY_TAXONOMY.flatMap((group) =>
  group.options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    group: group.group,
    keywords: [opt.label, opt.value, group.group],
  }))
);

// Modal 1: Edit Details Modal
interface EditDetailsModalProps {
  open: boolean;
  onClose: () => void;
  organization: Organization | null;
  onSave: (details: Partial<Organization>) => Promise<unknown>;
}

export function EditDetailsModal({
  open,
  onClose,
  organization,
  onSave,
}: EditDetailsModalProps) {
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organization) {
      setName(organization.name || "");
      setLegalName(organization.legalName || "");
      setPrimaryEmail(organization.primaryEmail || "");
      setPrimaryPhone(organization.primaryPhone || "");
      setIndustry(organization.industry || "");
      setWebsite(organization.website || "");
    }
  }, [organization, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const industryOptions = useMemo(() => {
    if (!industry || !industry.trim()) return ONBOARDING_INDUSTRY_OPTIONS;
    const exists = ONBOARDING_INDUSTRY_OPTIONS.some(
      (opt) => opt.value.toLowerCase() === industry.trim().toLowerCase()
    );
    if (!exists) {
      return [
        {
          value: industry.trim(),
          label: industry.trim(),
          group: "Existing Stored Value",
          keywords: [industry.trim()],
        },
        ...ONBOARDING_INDUSTRY_OPTIONS,
      ];
    }
    return ONBOARDING_INDUSTRY_OPTIONS;
  }, [industry]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (website && website.trim()) {
      const { isValid, error: webErr } = validateWebsiteInput(website);
      if (!isValid) {
        setError(webErr || "Please enter a valid website URL.");
        return;
      }
    }
    if (primaryPhone && primaryPhone.trim()) {
      const { callingOption, localNumber } = parsePhoneString(primaryPhone);
      const { isValid, error: phoneErr } = validatePhoneNumber(localNumber, callingOption.callingCode);
      if (!isValid) {
        setError(phoneErr || "Please enter a valid phone number.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        legalName: legalName.trim() || null,
        primaryEmail: primaryEmail.trim(),
        primaryPhone: primaryPhone.trim() || null,
        industry: industry.trim() || null,
        website: website.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save organization details");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="onboarding-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="onboarding-modal-header">
          <div className="onboarding-modal-title-group">
            <span className="onboarding-modal-icon">
              <Icon name="building" size={18} />
            </span>
            <div>
              <h2 id="edit-details-title">Complete Organization Details</h2>
              <p>Verify organization name, legal entity, and primary contact information.</p>
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

        <form onSubmit={handleSubmit}>
          <div className="onboarding-modal-body">
            {error && <Notice tone="error">{error}</Notice>}

            <div className="onboarding-form-grid">
              <label className="onboarding-field">
                <span className="field-label">
                  Organization name <strong className="required">*</strong>
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                />
              </label>

              <label className="onboarding-field">
                <span className="field-label">Legal name</span>
                <input
                  type="text"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g. Acme Holdings Inc."
                />
              </label>

              <label className="onboarding-field">
                <span className="field-label">
                  Primary email <strong className="required">*</strong>
                </span>
                <input
                  type="email"
                  required
                  value={primaryEmail}
                  onChange={(e) => setPrimaryEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </label>

              <div className="onboarding-field">
                <PhoneInput
                  id="onboarding-primary-phone"
                  label="Primary phone"
                  required
                  value={primaryPhone}
                  onChange={setPrimaryPhone}
                  placeholder="555 000 1234"
                />
              </div>

              <div className="onboarding-field">
                <SearchSelect
                  id="onboarding-industry"
                  label="Industry"
                  value={industry}
                  onChange={setIndustry}
                  options={industryOptions}
                  placeholder="Select industry..."
                  searchPlaceholder="Search industry taxonomy..."
                  clearable
                  onClear={() => setIndustry("")}
                />
              </div>

              <div className="onboarding-field">
                <WebsiteInput
                  id="onboarding-website"
                  label="Website"
                  value={website}
                  onChange={setWebsite}
                  placeholder="www.example.com"
                />
              </div>
            </div>
          </div>

          <footer className="onboarding-modal-footer">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy || !name.trim() || !primaryEmail.trim() || !primaryPhone.trim()}>
              {busy ? "Saving details…" : "Save organization details"}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// Modal 2: Create Workspace Modal
interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  entitlements: EffectiveEntitlements;
  onCreate: (input: { key: string; displayName: string; productKeys?: string[] }) => Promise<unknown>;
}

export function CreateWorkspaceModal({
  open,
  onClose,
  entitlements,
  onCreate,
}: CreateWorkspaceModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDisplayName("");
      setKey("");
      setKeyTouched(false);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleNameChange = (val: string) => {
    setDisplayName(val);
    if (!keyTouched) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setKey(slug);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const productKeys = deriveProductKeysFromEntitlements(entitlements);
      await onCreate({
        key: key.trim().toLowerCase(),
        displayName: displayName.trim(),
        productKeys: productKeys.length > 0 ? productKeys : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create workspace");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="onboarding-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-ws-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="onboarding-modal-header">
          <div className="onboarding-modal-title-group">
            <span className="onboarding-modal-icon">
              <Icon name="panels" size={18} />
            </span>
            <div>
              <h2 id="create-ws-title">Create Your First Workspace</h2>
              <p>Configure the primary workspace to activate Workforce and Payroll capabilities.</p>
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

        <form onSubmit={handleSubmit}>
          <div className="onboarding-modal-body">
            {error && <Notice tone="error">{error}</Notice>}

            {entitlements && entitlements.length > 0 && (
              <div className="step-completed-summary" style={{ marginBottom: 4 }}>
                <Icon name="checkCircle" size={14} />
                <span>
                  Organization plan:{" "}
                  <strong>{[...new Set(entitlements.map((e) => e.planName))].join(", ")}</strong>
                </span>
              </div>
            )}

            <div className="onboarding-form-grid">
              <label className="onboarding-field">
                <span className="field-label">
                  Workspace display name <strong className="required">*</strong>
                </span>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Main HR"
                  autoFocus
                />
              </label>

              <label className="onboarding-field">
                <span className="field-label">
                  Workspace key <strong className="required">*</strong>
                </span>
                <input
                  type="text"
                  required
                  pattern="[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?"
                  value={key}
                  onChange={(e) => {
                    setKeyTouched(true);
                    setKey(e.target.value.toLowerCase());
                  }}
                  placeholder="e.g. main-hr"
                />
                <small className="field-hint">
                  Filled in from the name and used in links. Lowercase letters, digits and hyphens; it cannot be changed later.
                </small>
              </label>
            </div>

            <div className="onboarding-capabilities-preview">
              <span className="preview-label">Capabilities enabled from your plan:</span>
              <div className="capabilities-tags">
                <span className="capability-tag">
                  <Icon name="workforce" size={12} />
                  <span>Horizon Workforce</span>
                </span>
                <span className="capability-tag">
                  <Icon name="payroll" size={12} />
                  <span>Horizon Payroll</span>
                </span>
              </div>
            </div>
          </div>

          <footer className="onboarding-modal-footer">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy || !displayName.trim() || !key.trim()}>
              {busy ? "Creating workspace…" : "Provision workspace"}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}

// Modal 3: Invite Member Modal
interface InviteMemberModalProps {
  open: boolean;
  onClose: () => void;
  onInvite: (email: string, role: string) => Promise<unknown>;
}

export function InviteMemberModal({ open, onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EMPLOYEE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("EMPLOYEE");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onInvite(email.trim(), role);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send invitation");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboarding-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="onboarding-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-member-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="onboarding-modal-header">
          <div className="onboarding-modal-title-group">
            <span className="onboarding-modal-icon">
              <Icon name="user" size={18} />
            </span>
            <div>
              <h2 id="invite-member-title">Invite Team Member</h2>
              <p>Send an invitation to grant organization membership and role permissions.</p>
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

        <form onSubmit={handleSubmit}>
          <div className="onboarding-modal-body">
            {error && <Notice tone="error">{error}</Notice>}

            <div className="onboarding-form-grid">
              <label className="onboarding-field">
                <span className="field-label">
                  Email address <strong className="required">*</strong>
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  autoFocus
                />
              </label>

              <div className="onboarding-field">
                <SearchSelect
                  id="onboarding-invite-role"
                  label="Organization role"
                  value={role}
                  options={[
                    { value: "ADMIN", label: "ADMIN", subLabel: "Full organization & workspace authority" },
                    { value: "MANAGER", label: "MANAGER", subLabel: "Team view & direct report authority" },
                    { value: "EMPLOYEE", label: "EMPLOYEE", subLabel: "Personal profile & workspace access" },
                  ]}
                  searchable={false}
                  onChange={setRole}
                />
              </div>
            </div>
          </div>

          <footer className="onboarding-modal-footer">
            <Button variant="secondary" type="button" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={busy || !email.trim()}>
              {busy ? "Sending invitation…" : "Send invitation"}
            </Button>
          </footer>
        </form>
      </div>
    </div>
  );
}
