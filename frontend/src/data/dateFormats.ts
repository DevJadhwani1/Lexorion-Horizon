// Date Format definitions, canonical options, and dynamic examples

export interface DateFormatOption {
  id: string; // Canonical format string e.g. "DD/MM/YYYY"
  format: string; // Format pattern
  example: string; // Formatted example e.g. "21/10/2026"
  label: string; // e.g. "DD/MM/YYYY — 21/10/2026"
}

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export function formatDateByPattern(dateInput: Date | string | number, pattern = "YYYY-MM-DD"): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const day = String(d.getDate()).padStart(2, "0");
  const monthNum = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  const monthName = MONTH_NAMES_SHORT[d.getMonth()] || "";

  switch (pattern) {
    case "DD/MM/YYYY":
      return `${day}/${monthNum}/${year}`;
    case "MM/DD/YYYY":
      return `${monthNum}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${monthNum}-${day}`;
    case "DD MMM YYYY":
      return `${day} ${monthName} ${year}`;
    default:
      return `${year}-${monthNum}-${day}`;
  }
}

export function getDatePatternOptions(referenceDate = new Date()): DateFormatOption[] {
  const patterns = [
    { format: "DD/MM/YYYY", example: formatDateByPattern(referenceDate, "DD/MM/YYYY") },
    { format: "MM/DD/YYYY", example: formatDateByPattern(referenceDate, "MM/DD/YYYY") },
    { format: "YYYY-MM-DD", example: formatDateByPattern(referenceDate, "YYYY-MM-DD") },
    { format: "DD MMM YYYY", example: formatDateByPattern(referenceDate, "DD MMM YYYY") },
  ];

  return patterns.map((p) => ({
    id: p.format,
    format: p.format,
    example: p.example,
    label: `${p.format} — ${p.example}`,
  }));
}
