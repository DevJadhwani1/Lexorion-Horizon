import { useEffect, useState, useMemo, type FormEvent } from "react";
import { NavLink, useParams } from "react-router-dom";
import { appPath } from "../../app/hostRouting";
import { ApiError } from "../../api/types";
import {
  getEffectiveEntitlements,
  type EffectiveEntitlements,
} from "../../features/entitlements/entitlementApi";
import {
  changeMemberRole,
  createInvitation,
  getInvitations,
  getMembers,
  getOrganization,
  removeMember,
  revokeInvitation,
  resendInvitation,
  updateOrganization,
  updateSettings,
  type Invitation,
  type Member,
  type Organization,
  type Settings,
} from "../../features/admin/adminApi";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Empty, Notice } from "../../components/ui/Page";
import { AdminEntitlements } from "./AdminEntitlements";
import { SearchSelect, type SelectOption } from "../../components/ui/SearchSelect";
import { WebsiteInput, validateWebsiteInput } from "../../components/ui/WebsiteInput";
import { PhoneInput, validatePhoneNumber, parsePhoneString } from "../../components/ui/PhoneInput";
import { COUNTRIES } from "../../data/countries";
import { CURRENCIES, formatCurrencyLabel } from "../../data/currencies";
import { getTimeZoneOptions } from "../../data/timezones";
import { INDUSTRY_TAXONOMY } from "../../data/industries";
import { getDatePatternOptions } from "../../data/dateFormats";
import { formatDate, setPreferredDateFormat } from "../../utils/dateFormat";
import { AdminScreen } from "./AdminScreen";
import { useOptionalAuth } from "../../auth/AuthProvider";

// Pre-computed select options for datasets
const COUNTRY_SELECT_OPTIONS: SelectOption[] = COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.name} (${c.code})`,
  subLabel: c.code,
  keywords: [c.name, c.code],
}));

const ROLE_SELECT_OPTIONS: SelectOption[] = [
  { value: "ADMIN", label: "ADMIN" },
  { value: "MANAGER", label: "MANAGER" },
  { value: "EMPLOYEE", label: "EMPLOYEE" },
];

const CURRENCY_SELECT_OPTIONS: SelectOption[] = CURRENCIES.map((c) => ({
  value: c.code,
  label: formatCurrencyLabel(c),
  subLabel: c.code,
  keywords: [c.name, c.code, c.symbol || ""],
}));

const TIMEZONE_SELECT_OPTIONS: SelectOption[] = getTimeZoneOptions().map((tz) => ({
  value: tz.id,
  label: tz.label,
  subLabel: tz.offsetString,
  keywords: [tz.id, tz.offsetString, tz.name],
}));

const DATE_FORMAT_SELECT_OPTIONS: SelectOption[] = getDatePatternOptions().map((df) => ({
  value: df.format,
  label: df.label,
  subLabel: df.example,
  keywords: [df.format, df.example],
}));

const BASE_INDUSTRY_SELECT_OPTIONS: SelectOption[] = INDUSTRY_TAXONOMY.flatMap((group) =>
  group.options.map((opt) => ({
    value: opt.value,
    label: opt.label,
    group: group.group,
    keywords: [opt.label, opt.value, group.group],
  }))
);

export function AdminPage({ sectionKey }: { sectionKey?: string }) {
  const { section: routeSection } = useParams(),
    section = sectionKey ?? routeSection ?? "organization",
    [data, setData] = useState<unknown>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [email, setEmail] = useState(""),
    [role, setRole] = useState("EMPLOYEE");
  const auth = useOptionalAuth();
  const refreshOrganizations = auth?.refreshOrganizations ?? (async () => true);

  const loadData = async (silent: boolean) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await (section === "members"
        ? getMembers()
        : section === "invitations"
          ? getInvitations()
          : section === "product-access"
            ? getEffectiveEntitlements()
            : getOrganization());
      setData(res);
      if (res && typeof res === "object" && "settings" in res) {
        const orgSettings = (res as Organization).settings;
        if (orgSettings?.dateFormat) {
          setPreferredDateFormat(orgSettings.dateFormat);
        }
      }
    } catch (e) {
      // A post-save refresh reports its failure to the form, which keeps the user's edits on screen.
      if (silent) throw e;
      setError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Unable to load administration data",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const load = () => loadData(false);

  useEffect(() => {
    void load();
  }, [section]);

  // Settings is one page with General and Product access sections.
  const settingsNav = section === "settings" || section === "product-access" ? <SettingsSectionNav /> : null;
  const pageTitle = settingsNav ? "Settings" : title(section);

  if (loading)
    return (
      <AdminScreen sectionKey={section} title={pageTitle}>
        {settingsNav}
        <p>Loading…</p>
      </AdminScreen>
    );

  if (error && (section !== "invitations" || data === null))
    return (
      <AdminScreen sectionKey={section} title={pageTitle}>
        {settingsNav}
        <Notice>{error}</Notice>
        <div style={{ marginTop: "12px" }}>
          <Button onClick={load}>Retry</Button>
        </div>
      </AdminScreen>
    );

  if (section === "members")
    return (
      <AdminScreen
        sectionKey="members"
        title="Members"
        description="Membership roles are enforced by Platform."
      >
        {(data as Member[]).length ? (
          <Table headers={["Name", "Email", "Role", "Status", "Actions"]}>
            {(data as Member[]).map((m) => (
              <tr key={m.membershipId}>
                <td>{m.fullName}</td>
                <td>{m.email}</td>
                <td>
                  <SearchSelect
                    id={`member-role-${m.membershipId}`}
                    value={m.role}
                    ariaLabel={`Role for ${m.fullName}`}
                    options={ROLE_SELECT_OPTIONS}
                    searchable={false}
                    compact
                    minMenuWidth={130}
                    onChange={(newRole) => {
                      if (newRole === m.role) return;
                      if (
                        confirm(
                          `Change ${m.fullName}'s role to ${newRole}?`,
                        )
                      ) {
                        void changeMemberRole(m.membershipId, newRole)
                          .then(load)
                          .catch((x) => setError((x as Error).message));
                      }
                    }}
                  />
                </td>
                <td>
                  <Badge
                    label={m.status}
                    variant={m.status === "ACTIVE" ? "success" : "neutral"}
                  />
                </td>
                <td>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      confirm("Remove this membership?") &&
                      void removeMember(m.membershipId)
                        .then(load)
                        .catch((x) => setError((x as Error).message))
                    }
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty>No organization members.</Empty>
        )}
      </AdminScreen>
    );

  if (section === "invitations")
    return (
      <AdminScreen sectionKey="invitations" title="Invitations" description="Manage team invitations and delivery status.">
        <form
          className="toolbar"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void createInvitation(email, role)
              .then(() => {
                setEmail("");
                return load();
              })
              .catch((x) =>
                setError(x instanceof Error ? x.message : "Failed"),
              );
          }}
        >
          <input
            type="email"
            required
            placeholder="person@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <SearchSelect
            id="invitation-role-select"
            value={role}
            ariaLabel="Invitation role"
            options={ROLE_SELECT_OPTIONS}
            searchable={false}
            compact
            minMenuWidth={130}
            onChange={(newRole) => setRole(newRole)}
          />
          <Button variant="primary">Invite</Button>
        </form>
        {error && <Notice>{error}</Notice>}
        <Table headers={["Email", "Role", "Status", "Expires", "Action"]}>
          {(data as Invitation[]).map((i) => (
            <tr key={i.invitationId}>
              <td>{i.email}</td>
              <td>{i.role}</td>
              <td>
                <Badge label={i.status} />
                <div>Email: {i.deliveryStatus ?? "NOT_SENT"}</div>
                {i.deliveryError && <div role="alert">{i.deliveryError}</div>}
              </td>
              <td>{formatDate(i.expiresAt)}</td>
              <td>
                {i.status === "PENDING" && <>
                  <Button onClick={() => void resendInvitation(i.invitationId).then(load).catch((x: Error) => setError(x.message))}>Retry delivery</Button>
                  <Button onClick={() => void revokeInvitation(i.invitationId).then(load).catch((x: Error) => setError(x.message))}>Revoke</Button>
                </>}
              </td>
            </tr>
          ))}
        </Table>
      </AdminScreen>
    );

  if (section === "product-access")
    return (
      <AdminScreen
        sectionKey="product-access"
        title="Settings"
        description="Products and plan allowances enabled for your organization."
      >
        {settingsNav}
        <section aria-labelledby="product-access-heading">
          <header className="admin-form-section-header">
            <h2 id="product-access-heading" className="admin-form-section-title">Product access</h2>
            <p className="admin-form-section-desc">
              Product availability and allowances come from your organization's current plan and are read-only.
            </p>
          </header>
          <AdminEntitlements entitlements={data as EffectiveEntitlements} />
        </section>
      </AdminScreen>
    );

  const org = data as Organization;

  return (
    <AdminScreen
      sectionKey={section}
      title={section === "settings" ? "Settings" : "Organization"}
      description={
        section === "settings"
          ? "Configure organization-wide defaults, regional standards, and time preferences."
          : "Manage your legal entity profile, primary contact information, and registered address."
      }
    >
      {settingsNav}
      {section === "settings" ? (
        <OrganizationSettingsForm settings={org.settings} onSaveSuccess={() => loadData(true)} />
      ) : (
        <OrganizationProfileForm organization={org} onSaveSuccess={async () => {
          // The header and organization selector read memberships, so refresh them alongside the profile.
          const memberships = refreshOrganizations();
          try { await loadData(true); } finally { await memberships; }
        }} />
      )}
    </AdminScreen>
  );
}

// ============================================================================
// Organization Profile Form Component
// ============================================================================

interface OrganizationProfileFormProps {
  organization: Organization;
  onSaveSuccess: () => Promise<void>;
}

function OrganizationProfileForm({ organization, onSaveSuccess }: OrganizationProfileFormProps) {
  const [name, setName] = useState(organization.name || "");
  const [legalName, setLegalName] = useState(organization.legalName || "");
  const [primaryEmail, setPrimaryEmail] = useState(organization.primaryEmail || "");
  const [primaryPhone, setPrimaryPhone] = useState(organization.primaryPhone || "");
  const [industry, setIndustry] = useState(organization.industry || "");
  const [website, setWebsite] = useState(organization.website || "");
  const [addressLine1, setAddressLine1] = useState(organization.addressLine1 || "");
  const [addressLine2, setAddressLine2] = useState(organization.addressLine2 || "");
  const [addressCountry, setAddressCountry] = useState(organization.addressCountry || "");
  const [stateProvince, setStateProvince] = useState(organization.stateProvince || "");
  const [city, setCity] = useState(organization.city || "");
  const [postalCode, setPostalCode] = useState(organization.postalCode || "");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(organization.name || "");
    setLegalName(organization.legalName || "");
    setPrimaryEmail(organization.primaryEmail || "");
    setPrimaryPhone(organization.primaryPhone || "");
    setIndustry(organization.industry || "");
    setWebsite(organization.website || "");
    setAddressLine1(organization.addressLine1 || "");
    setAddressLine2(organization.addressLine2 || "");
    setAddressCountry(organization.addressCountry || "");
    setStateProvince(organization.stateProvince || "");
    setCity(organization.city || "");
    setPostalCode(organization.postalCode || "");
  }, [organization]);

  // Industry options including legacy value preservation
  const industryOptions = useMemo(() => {
    if (!industry || !industry.trim()) return BASE_INDUSTRY_SELECT_OPTIONS;
    const exists = BASE_INDUSTRY_SELECT_OPTIONS.some(
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
        ...BASE_INDUSTRY_SELECT_OPTIONS,
      ];
    }
    return BASE_INDUSTRY_SELECT_OPTIONS;
  }, [industry]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveSuccess(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Organization name is required.");
      return;
    }

    const trimmedEmail = primaryEmail.trim();
    if (!trimmedEmail) {
      setError("Primary email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Please provide a valid primary email address.");
      return;
    }

    // Validate website if provided
    if (website && website.trim()) {
      const { isValid, error: webErr } = validateWebsiteInput(website);
      if (!isValid) {
        setError(webErr || "Please provide a valid website URL.");
        return;
      }
    }

    // Validate phone if provided
    if (primaryPhone && primaryPhone.trim()) {
      const { callingOption, localNumber } = parsePhoneString(primaryPhone);
      const { isValid, error: phoneErr } = validatePhoneNumber(localNumber, callingOption.callingCode);
      if (!isValid) {
        setError(phoneErr || "Please provide a valid phone number.");
        return;
      }
    }

    setSaving(true);
    try {
      await updateOrganization({
        name: trimmedName,
        legalName: legalName.trim() || null,
        primaryEmail: trimmedEmail,
        primaryPhone: primaryPhone.trim() || null,
        industry: industry.trim() || null,
        website: website.trim() || null,
        addressLine1: addressLine1.trim() || null,
        addressLine2: addressLine2.trim() || null,
        addressCountry: addressCountry.trim() ? addressCountry.trim().toUpperCase() : null,
        stateProvince: stateProvince.trim() || null,
        city: city.trim() || null,
        postalCode: postalCode.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization profile");
      setSaving(false);
      return;
    }
    try {
      await onSaveSuccess();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setError(savedButNotReloaded(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form-container">
      {error && (
        <div style={{ marginBottom: "16px" }}>
          <Notice>{error}</Notice>
        </div>
      )}

      {/* Organization Details Card */}
      <div className="admin-form-card">
        <header className="admin-form-section-header">
          <h3 className="admin-form-section-title">General Information</h3>
          <p className="admin-form-section-desc">Primary identification and industry classification.</p>
        </header>

        <div className="admin-form-grid-2col">
          <label>
            <span className="admin-field-label-text">
              Organization Name <span className="field-required-asterisk">*</span>
            </span>
            <input
              type="text"
              name="name"
              required
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corporation"
            />
          </label>

          <label>
            <span className="admin-field-label-text">
              Legal Entity Name
            </span>
            <input
              type="text"
              name="legalName"
              maxLength={255}
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="e.g. Acme Global Holdings Inc."
            />
          </label>

          <label>
            <span className="admin-field-label-text">
              Primary Email <span className="field-required-asterisk">*</span>
            </span>
            <input
              type="email"
              name="primaryEmail"
              required
              maxLength={255}
              value={primaryEmail}
              onChange={(e) => setPrimaryEmail(e.target.value)}
              placeholder="ops@acme.com"
            />
          </label>

          <PhoneInput
            id="org-primary-phone"
            name="primaryPhone"
            label="Primary Phone"
            value={primaryPhone}
            onChange={setPrimaryPhone}
            placeholder="555 123 4567"
          />

          <SearchSelect
            id="org-industry"
            name="industry"
            label="Industry Classification"
            value={industry}
            onChange={setIndustry}
            options={industryOptions}
            placeholder="Select industry taxonomy..."
            searchPlaceholder="Search industries and sectors..."
            clearable
            onClear={() => setIndustry("")}
            hint="Classified by standard 18-group international taxonomy."
          />

          <WebsiteInput
            id="org-website"
            name="website"
            label="Website"
            value={website}
            onChange={setWebsite}
            placeholder="www.example.com"
            hint="Public website address (e.g. www.example.com or https://example.com)."
          />
        </div>
      </div>

      {/* Registered Office / Address Card */}
      <div className="admin-form-card">
        <header className="admin-form-section-header">
          <h3 className="admin-form-section-title">Registered Address & Region</h3>
          <p className="admin-form-section-desc">Physical registration address and legal jurisdiction.</p>
        </header>

        <div className="admin-form-grid-2col">
          <div className="admin-form-full-width">
            <label>
              Address Line 1
              <input
                type="text"
                name="addressLine1"
                maxLength={255}
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street address, suite, or unit"
              />
            </label>
          </div>

          <div className="admin-form-full-width">
            <label>
              Address Line 2
              <input
                type="text"
                name="addressLine2"
                maxLength={255}
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Building, floor, department"
              />
            </label>
          </div>

          <SearchSelect
            id="org-address-country"
            name="addressCountry"
            label="Country / Territory"
            value={addressCountry}
            onChange={setAddressCountry}
            options={COUNTRY_SELECT_OPTIONS}
            placeholder="Select country or territory..."
            searchPlaceholder="Search country name or ISO code..."
            clearable
            onClear={() => setAddressCountry("")}
            hint="Standard ISO 3166-1 country code."
          />

          <label>
            State / Province / Region
            <input
              type="text"
              name="stateProvince"
              maxLength={100}
              value={stateProvince}
              onChange={(e) => setStateProvince(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="e.g. California, Ontario, Karnataka"
            />
          </label>

          <label>
            City
            <input
              type="text"
              name="city"
              maxLength={100}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="e.g. San Francisco, Toronto, Bengaluru"
            />
          </label>

          <label>
            Postal / ZIP Code
            <input
              type="text"
              name="postalCode"
              maxLength={20}
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="e.g. 94103, M5V 2T6, 560001"
            />
          </label>
        </div>
      </div>

      <div className="admin-form-actions-bar">
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Profile Changes"}
        </Button>
        {saveSuccess && (
          <span className="admin-form-save-status is-success" role="status">
            ✓ Organization profile updated successfully.
          </span>
        )}
      </div>
    </form>
  );
}

// ============================================================================
// Organization Settings Form Component
// ============================================================================

interface OrganizationSettingsFormProps {
  settings: Settings;
  onSaveSuccess: () => Promise<void>;
}

function OrganizationSettingsForm({ settings, onSaveSuccess }: OrganizationSettingsFormProps) {
  const [country, setCountry] = useState(settings.country || "US");
  const [currency, setCurrency] = useState(settings.currency || "USD");
  const [timeZone, setTimeZone] = useState(settings.timeZone || "UTC");
  const [dateFormat, setDateFormat] = useState(settings.dateFormat || "YYYY-MM-DD");
  const [locale, setLocale] = useState(settings.locale || "en-US");
  const [brandingDisplayName, setBrandingDisplayName] = useState(settings.brandingDisplayName || "");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if settings prop changes from backend reload
  useEffect(() => {
    setCountry(settings.country || "US");
    setCurrency(settings.currency || "USD");
    setTimeZone(settings.timeZone || "UTC");
    setDateFormat(settings.dateFormat || "YYYY-MM-DD");
    setLocale(settings.locale || "en-US");
    setBrandingDisplayName(settings.brandingDisplayName || "");
  }, [settings]);

  const isDirty =
    country !== (settings.country || "US") ||
    currency !== (settings.currency || "USD") ||
    timeZone !== (settings.timeZone || "UTC") ||
    dateFormat !== (settings.dateFormat || "YYYY-MM-DD") ||
    locale !== (settings.locale || "en-US") ||
    brandingDisplayName !== (settings.brandingDisplayName || "");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaveSuccess(false);

    setSaving(true);
    try {
      await updateSettings({
        country: country.toUpperCase(),
        currency: currency.toUpperCase(),
        timeZone: timeZone.trim(),
        dateFormat: dateFormat.trim(),
        locale: locale.trim(),
        // Settings PATCH ignores omitted and null fields; an empty string is what clears the branding name.
        brandingDisplayName: brandingDisplayName.trim(),
      });
      setPreferredDateFormat(dateFormat);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update organization settings");
      setSaving(false);
      return;
    }
    try {
      await onSaveSuccess();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setError(savedButNotReloaded(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-form-container">
      {error && (
        <div style={{ marginBottom: "16px" }}>
          <Notice>{error}</Notice>
        </div>
      )}

      {/* Regional Defaults Card */}
      <div className="admin-form-card">
        <header className="admin-form-section-header">
          <div className="admin-form-section-header-row">
            <div>
              <h3 className="admin-form-section-title">Regional & Localization Defaults</h3>
              <p className="admin-form-section-desc">
                Default country, currency, time zone, and date format standards across workforce operations.
              </p>
            </div>
            {isDirty && (
              <span className="admin-form-dirty-pill" data-testid="settings-dirty-indicator">
                Unsaved changes
              </span>
            )}
          </div>
        </header>

        <div className="admin-form-grid-2col">
          <SearchSelect
            id="settings-default-country"
            name="country"
            label="Default Country"
            value={country}
            onChange={setCountry}
            options={COUNTRY_SELECT_OPTIONS}
            placeholder="Select default country..."
            searchPlaceholder="Search country or ISO code..."
            hint="Primary operational jurisdiction for statutory rules."
          />

          <SearchSelect
            id="settings-default-currency"
            name="currency"
            label="Default Operating Currency"
            value={currency}
            onChange={setCurrency}
            options={CURRENCY_SELECT_OPTIONS}
            placeholder="Select currency..."
            searchPlaceholder="Search currency name, code, or symbol..."
            hint="ISO 4217 code. Changing default currency does not alter existing records."
          />

          <SearchSelect
            id="settings-timezone"
            name="timeZone"
            label="Standard Time Zone"
            value={timeZone}
            onChange={setTimeZone}
            options={TIMEZONE_SELECT_OPTIONS}
            placeholder="Select IANA time zone..."
            searchPlaceholder="Search city, region, or offset..."
            hint="Canonical IANA identifier. Accounts for daylight saving automatically."
          />

          <SearchSelect
            id="settings-date-format"
            name="dateFormat"
            label="Preferred Date Format"
            value={dateFormat}
            onChange={setDateFormat}
            options={DATE_FORMAT_SELECT_OPTIONS}
            placeholder="Select date display format..."
            searchPlaceholder="Search format or pattern..."
            hint="Applied across administrative screens and timestamps."
          />

          <div className="admin-form-field">
            <label htmlFor="settings-locale" className="admin-form-field-label">
              Language / Locale
            </label>
            <input
              id="settings-locale"
              type="text"
              name="locale"
              maxLength={35}
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              placeholder="e.g. en-US, en-GB, fr-FR"
            />
            <span className="admin-form-field-hint">
              Primary language and regional format tag (BCP 47).
            </span>
          </div>

          <div className="admin-form-field">
            <label htmlFor="settings-branding-display-name" className="admin-form-field-label">
              Branding Display Name
            </label>
            <input
              id="settings-branding-display-name"
              type="text"
              name="brandingDisplayName"
              maxLength={150}
              value={brandingDisplayName}
              onChange={(e) => setBrandingDisplayName(e.target.value)}
              placeholder="e.g. Acme Corp Portal"
            />
            <span className="admin-form-field-hint">
              Custom organization name displayed across customer-facing portals.
            </span>
          </div>
        </div>
      </div>

      <div className="admin-form-actions-bar">
        <Button variant="primary" type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Settings Changes"}
        </Button>
        {isDirty && !saving && !saveSuccess && (
          <span className="admin-form-dirty-status" role="status">
            ● Unsaved changes
          </span>
        )}
        {saveSuccess && (
          <span className="admin-form-save-status is-success" role="status">
            ✓ Organization settings updated successfully.
          </span>
        )}
      </div>
    </form>
  );
}

function SettingsSectionNav() {
  const link = ({ isActive }: { isActive: boolean }) => `admin-tab-link${isActive ? " active" : ""}`;
  return (
    <nav className="settings-section-nav" aria-label="Settings sections">
      <NavLink to={appPath("/organization/settings")} end className={link}>General</NavLink>
      <NavLink to={appPath("/organization/settings/product-access")} className={link}>Product access</NavLink>
    </nav>
  );
}

const savedButNotReloaded = (err: unknown) =>
  `Your changes were saved, but the latest values could not be reloaded${err instanceof Error && err.message ? ` (${err.message})` : ""}. Refresh the page to confirm them.`;

const title = (s: string) => s[0].toUpperCase() + s.slice(1);

export function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
