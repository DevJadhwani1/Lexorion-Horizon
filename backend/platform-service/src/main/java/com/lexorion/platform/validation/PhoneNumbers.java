package com.lexorion.platform.validation;

import com.lexorion.horizon.organizationsettings.exception.InvalidOrganizationSettingsException;
import java.util.regex.Pattern;

/**
 * Normalizes phone numbers to E.164 ("+919876543210") for storage.
 * Accepts the formatting people type (spaces, hyphens, dots, parentheses, slashes) and requires a leading
 * country code. This is a structural check only: per-country number ranges are validated in the client with
 * libphonenumber metadata. Landlines and mobiles are both accepted.
 */
public final class PhoneNumbers {
    private static final Pattern FORMATTING = Pattern.compile("[\\s().\\-/]");
    private static final Pattern E164 = Pattern.compile("^\\+[1-9]\\d{6,14}$");

    private PhoneNumbers() {}

    /** Returns null for a blank value, otherwise the E.164 form, or throws with a message the user can act on. */
    public static String normalizeOptional(String raw, String fieldLabel) {
        if (raw == null || raw.isBlank()) return null;
        String compact = FORMATTING.matcher(raw.trim()).replaceAll("");
        if (compact.startsWith("00")) compact = "+" + compact.substring(2);
        if (!compact.startsWith("+")) {
            throw new InvalidOrganizationSettingsException(fieldLabel + " must include the country code, for example +91 98765 43210.");
        }
        if (!E164.matcher(compact).matches()) {
            throw new InvalidOrganizationSettingsException(fieldLabel + " must be a country code followed by 7 to 15 digits in total.");
        }
        return compact;
    }
}
