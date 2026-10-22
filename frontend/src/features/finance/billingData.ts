import { formatMoney } from "../../lib/format";
import { INDIAN_STATES } from "../../data/indianStates";

/** GST state codes (the first two digits of a GSTIN) to ISO 3166-2:IN codes. */
const GST_STATE_CODES: Record<string, string> = {
  "01": "JK", "02": "HP", "03": "PB", "04": "CH", "05": "UK", "06": "HR", "07": "DL", "08": "RJ", "09": "UP", "10": "BR",
  "11": "SK", "12": "AR", "13": "NL", "14": "MN", "15": "MZ", "16": "TR", "17": "ML", "18": "AS", "19": "WB", "20": "JH",
  "21": "OD", "22": "CG", "23": "MP", "24": "GJ", "25": "DH", "26": "DH", "27": "MH", "29": "KA", "30": "GA", "31": "LD",
  "32": "KL", "33": "TN", "34": "PY", "35": "AN", "36": "TS", "37": "AP", "38": "LA",
};

export const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** State names are what invoices store as place of supply, so they match the template's seller state exactly. */
export const STATE_OPTIONS = INDIAN_STATES.map((state) => ({ value: state.name, label: state.name, keywords: [state.code] }));

/** The state a GSTIN is registered in, or null when the GSTIN is incomplete or its state code is unknown. */
export function gstinState(gstin: string): string | null {
  const code = GST_STATE_CODES[gstin.trim().slice(0, 2)];
  return code ? INDIAN_STATES.find((state) => state.code === code)?.name ?? null : null;
}

/** Explains what is wrong with a GSTIN as typed, or returns null when it is empty or valid. */
export function gstinProblem(value: string): string | null {
  const gstin = value.trim().toUpperCase();
  if (!gstin) return null;
  if (gstin.length !== 15) return `A GSTIN has 15 characters; this has ${gstin.length}.`;
  if (!GSTIN_PATTERN.test(gstin)) return "Check the GSTIN: 2-digit state code, 10-character PAN, entity number, Z and a check character.";
  if (!gstinState(gstin)) return `${gstin.slice(0, 2)} is not a GST state code.`;
  return null;
}

/** Common payment terms; any other number of days is still allowed. */
export const PAYMENT_TERMS = [
  { value: "0", label: "Due on receipt" }, { value: "7", label: "Net 7", subLabel: "7 days" }, { value: "15", label: "Net 15", subLabel: "15 days" },
  { value: "30", label: "Net 30", subLabel: "30 days" }, { value: "45", label: "Net 45", subLabel: "45 days" }, { value: "60", label: "Net 60", subLabel: "60 days" },
  { value: "90", label: "Net 90", subLabel: "90 days" },
];

export function termsLabel(days: number): string {
  return days === 0 ? "Due on receipt" : `Net ${days}`;
}

/** Money on finance screens. Rupees always use Indian digit grouping (₹2,12,400.00), whatever the browser locale. */
export function formatBillingMoney(value: number | null | undefined, currency: string, locale?: string): string {
  return formatMoney(value, currency, currency === "INR" ? "en-IN" : locale);
}
