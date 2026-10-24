// Display formatting shared by Horizon screens. API values stay unchanged; only presentation is converted.

/** Converts enum values and camelCase field names into sentence-case labels: `ON_LEAVE` → `On leave`. */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const words = value.replaceAll("_", " ").replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatMoney(value: number | null | undefined, currency: string, locale?: string): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency}`;
  }
}

/** Formats an ISO date (`2026-10-31`) as `31 Oct 2026` without shifting it across time zones. */
export function formatDate(value: string | null | undefined, locale?: string): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale ?? "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: match ? "UTC" : undefined }).format(date);
}

export function formatPeriod(start: string, end: string, locale?: string): string {
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
}

/** Derives a short, URL-safe key from a display name, matching the Workforce reference key pattern. */
export function keyFromName(name: string): string {
  return name.toLowerCase().normalize("NFKD").replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-+|-+$/g, "").slice(0, 63).replace(/-+$/, "");
}

export function personName(person: { firstName: string; lastName: string } | null | undefined): string {
  return person ? `${person.firstName} ${person.lastName}`.trim() : "";
}

type Tone = "success" | "warning" | "danger" | "neutral";
const tones: Record<string, Tone> = {
  ACTIVE: "success", FINALIZED: "success", ELIGIBLE: "success", SUBMITTED: "success", ACCEPTED: "success",
  CALCULATED: "warning", PROCESSING: "warning", DRAFT: "neutral", ON_LEAVE: "warning", PENDING: "warning",
  ISSUED: "warning", PARTIALLY_PAID: "warning", PAID: "success", VOID: "neutral", ARCHIVED: "neutral", OVERDUE: "danger",
  FAILED: "danger", SUSPENDED: "danger", TERMINATED: "danger", RESIGNED: "neutral", INACTIVE: "neutral", REVOKED: "neutral", EXPIRED: "neutral",
};
export function statusTone(status: string): Tone { return tones[status] ?? "neutral"; }

/** User-facing explanations for the existing pay-run states. The domain states themselves are unchanged. */
export const payRunStatusDescription: Record<string, string> = {
  DRAFT: "Choose employees and check eligibility. Nothing is calculated yet.",
  PROCESSING: "Pay is being calculated for the selected employees.",
  CALCULATED: "Pay is calculated and ready for review. Finalize to lock the results and issue payslips. Finalizing does not send a payment or approve statutory decisions.",
  FINALIZED: "Locked. Ledger entries and payslips were created and can no longer change. No payment was sent.",
  FAILED: "Calculation stopped before any results were saved. Fix the reported issue, then recover to draft.",
};
