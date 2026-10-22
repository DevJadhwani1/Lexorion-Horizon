package com.lexorion.workforce.service;

import com.lexorion.workforce.api.WorkforceException;
import java.util.regex.Pattern;

/**
 * Normalizes employee phone numbers to E.164 ("+919876543210").
 * Accepts formatting (spaces, hyphens, dots, parentheses, slashes) and a "00" international prefix, and requires
 * a country code. Structural check only; per-country ranges are validated in the client with libphonenumber.
 */
final class PhoneNumbers {
    private static final Pattern FORMATTING = Pattern.compile("[\\s().\\-/]");
    private static final Pattern E164 = Pattern.compile("^\\+[1-9]\\d{6,14}$");
    private static final Pattern COUNTRY = Pattern.compile("^[A-Z]{2}$");

    private PhoneNumbers() {}

    static String normalizeOptional(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String compact = FORMATTING.matcher(raw.trim()).replaceAll("");
        if (compact.startsWith("00")) compact = "+" + compact.substring(2);
        if (!compact.startsWith("+")) throw new WorkforceException(400, "Phone must include the country code, for example +91 98765 43210");
        if (!E164.matcher(compact).matches()) throw new WorkforceException(400, "Phone must be a country code followed by 7 to 15 digits in total");
        return compact;
    }

    static String countryOptional(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String country = raw.trim().toUpperCase(java.util.Locale.ROOT);
        if (!COUNTRY.matcher(country).matches()) throw new WorkforceException(400, "Phone country must be a two-letter ISO country code");
        return country;
    }
}
