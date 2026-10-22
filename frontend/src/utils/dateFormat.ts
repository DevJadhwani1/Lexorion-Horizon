import { formatDateByPattern } from "../data/dateFormats";

let globalPreferredDateFormat = "YYYY-MM-DD";

export function setPreferredDateFormat(format: string) {
  if (format && format.trim()) {
    globalPreferredDateFormat = format.trim();
  }
}

export function getPreferredDateFormat(): string {
  return globalPreferredDateFormat;
}

export function formatDate(
  dateInput: Date | string | number | null | undefined,
  overridePattern?: string
): string {
  if (!dateInput) return "";
  const pattern = overridePattern || globalPreferredDateFormat;
  return formatDateByPattern(dateInput, pattern);
}
