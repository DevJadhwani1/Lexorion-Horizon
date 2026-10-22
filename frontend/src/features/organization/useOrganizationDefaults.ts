import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { getOrganization } from "../admin/adminApi";

export interface OrganizationDefaults { currency: string; locale: string | undefined; loaded: boolean }

/**
 * Reads the organization's configured currency and locale so forms never fall back to a hardcoded currency.
 * Only administrators may read organization settings; other roles keep an empty default.
 */
export function useOrganizationDefaults(): OrganizationDefaults {
  const organization = useAuth().organization;
  const admin = organization?.membershipRole === "ADMIN";
  const [value, setValue] = useState<OrganizationDefaults>({ currency: "", locale: undefined, loaded: !admin });
  useEffect(() => {
    if (!admin) return;
    let current = true;
    getOrganization()
      .then((profile) => { if (current) setValue({ currency: profile.settings?.currency ?? "", locale: profile.settings?.locale || undefined, loaded: true }); })
      .catch(() => { if (current) setValue({ currency: "", locale: undefined, loaded: true }); });
    return () => { current = false; };
  }, [admin, organization?.organizationId]);
  return value;
}
