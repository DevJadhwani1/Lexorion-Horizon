import { apiRequest } from "../../api/httpClient";

export type EntitlementValueType = "BOOLEAN" | "INTEGER";

export interface EffectiveEntitlementValue {
  key: string;
  valueType: EntitlementValueType;
  booleanValue: boolean | null;
  integerValue: number | null;
}

export interface EffectiveProductEntitlements {
  productKey: string;
  planKey: string;
  planName: string;
  entitlements: EffectiveEntitlementValue[];
}

export type EffectiveEntitlements = EffectiveProductEntitlements[];

export const getEffectiveEntitlements = () =>
  apiRequest<EffectiveEntitlements>("/api/tenant/entitlements");

export function hasEntitlement(snapshot: EffectiveEntitlements, key: string): boolean {
  const value = findValue(snapshot, key);
  return value?.valueType === "BOOLEAN" && value.booleanValue === true;
}

export function getEntitlementLimit(snapshot: EffectiveEntitlements, key: string): number | null {
  const value = findValue(snapshot, key);
  return value?.valueType === "INTEGER" && value.integerValue !== null && value.integerValue >= 0
    ? value.integerValue
    : null;
}

function findValue(snapshot: EffectiveEntitlements, key: string): EffectiveEntitlementValue | undefined {
  for (const product of Array.isArray(snapshot) ? snapshot : []) {
    // Treat a missing entitlement list as an empty list. Older platform API
    // responses can omit it, and callers should not lose the entire page.
    const value = (Array.isArray(product?.entitlements) ? product.entitlements : []).find((item) => item.key === key);
    if (value) return value;
  }
  return undefined;
}
