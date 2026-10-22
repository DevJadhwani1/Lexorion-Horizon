// IANA Time Zone database integration
// Computes dynamic UTC offsets taking daylight saving into account for the specified date.

export interface TimeZoneOption {
  id: string; // Canonical IANA identifier e.g. "Asia/Kolkata"
  name: string; // Canonical IANA identifier e.g. "Asia/Kolkata"
  offsetString: string; // e.g. "UTC+05:30"
  label: string; // e.g. "Asia/Kolkata (UTC+05:30)"
}

// Fallback list of canonical IANA timezones if Intl.supportedValuesOf is not supported
const FALLBACK_TIMEZONES = [
  "Africa/Abidjan", "Africa/Accra", "Africa/Addis_Ababa", "Africa/Algiers", "Africa/Cairo",
  "Africa/Casablanca", "Africa/Johannesburg", "Africa/Lagos", "Africa/Nairobi", "Africa/Tunis",
  "America/Anchorage", "America/Argentina/Buenos_Aires", "America/Bogota", "America/Caracas",
  "America/Chicago", "America/Denver", "America/Halifax", "America/Los_Angeles", "America/Mexico_City",
  "America/New_York", "America/Phoenix", "America/Santiago", "America/Sao_Paulo", "America/Toronto",
  "America/Vancouver", "Asia/Bangkok", "Asia/Beirut", "Asia/Colombo", "Asia/Dhaka", "Asia/Dubai",
  "Asia/Hong_Kong", "Asia/Istanbul", "Asia/Jakarta", "Asia/Jerusalem", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Kuala_Lumpur", "Asia/Kuwait", "Asia/Manila", "Asia/Qatar", "Asia/Riyadh", "Asia/Seoul",
  "Asia/Shanghai", "Asia/Singapore", "Asia/Taipei", "Asia/Tokyo", "Atlantic/Reykjavik",
  "Australia/Adelaide", "Australia/Brisbane", "Australia/Darwin", "Australia/Melbourne",
  "Australia/Perth", "Australia/Sydney", "Europe/Amsterdam", "Europe/Athens", "Europe/Belgrade",
  "Europe/Berlin", "Europe/Brussels", "Europe/Bucharest", "Europe/Budapest", "Europe/Copenhagen",
  "Europe/Dublin", "Europe/Helsinki", "Europe/Lisbon", "Europe/London", "Europe/Madrid",
  "Europe/Oslo", "Europe/Paris", "Europe/Prague", "Europe/Rome", "Europe/Stockholm", "Europe/Vienna",
  "Europe/Warsaw", "Europe/Zurich", "Pacific/Auckland", "Pacific/Fiji", "Pacific/Guam",
  "Pacific/Honolulu", "Pacific/Port_Moresby", "Pacific/Sydney", "UTC"
];

// Get list of IANA timezone identifiers
export function getIanaTimeZones(): string[] {
  const set = new Set<string>();
  try {
    if (typeof Intl !== "undefined" && typeof (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf === "function") {
      const zones = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone");
      if (zones && zones.length > 0) {
        zones.forEach((z) => set.add(z));
      }
    }
  } catch {
    // Fall back to static list
  }
  FALLBACK_TIMEZONES.forEach((z) => set.add(z));
  return Array.from(set);
}

// Compute dynamic UTC offset for a given timezone and date
export function getUtcOffsetString(timeZone: string, date = new Date()): string {
  try {
    // Format the date in UTC and in target timezone to compare
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart && tzPart.value) {
      // Short offset format is GMT+5:30 or GMT-4 or GMT
      const val = tzPart.value.replace("GMT", "UTC");
      if (val === "UTC") return "UTC+00:00";
      // Format single-digit hour to two digits: UTC+5 -> UTC+05:00, UTC+5:30 -> UTC+05:30
      const match = val.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/);
      if (match) {
        const sign = match[1];
        const hours = match[2].padStart(2, "0");
        const mins = match[3] ?? "00";
        return `UTC${sign}${hours}:${mins}`;
      }
      return val;
    }
  } catch {
    // Fallback if zone calculation fails
  }
  return "UTC+00:00";
}

// Build list of timezone options with dynamic labels
export function getTimeZoneOptions(date = new Date()): TimeZoneOption[] {
  const zones = getIanaTimeZones();
  return zones.map((tz) => {
    const offsetString = getUtcOffsetString(tz, date);
    return {
      id: tz,
      name: tz,
      offsetString,
      label: `${tz} (${offsetString})`,
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

// Lookup single option
export function formatTimeZoneOption(timeZone: string, date = new Date()): TimeZoneOption {
  const offsetString = getUtcOffsetString(timeZone, date);
  return {
    id: timeZone,
    name: timeZone,
    offsetString,
    label: `${timeZone} (${offsetString})`,
  };
}
