package com.lexorion.payroll.service;

import com.lexorion.payroll.api.PayrollException;
import java.util.*;

/** ISO 3166-2:IN state and union territory codes (without the "IN-" prefix). */
public final class IndianStates {
    public static final Map<String, String> NAMES = Map.ofEntries(
            Map.entry("AN", "Andaman and Nicobar Islands"), Map.entry("AP", "Andhra Pradesh"), Map.entry("AR", "Arunachal Pradesh"),
            Map.entry("AS", "Assam"), Map.entry("BR", "Bihar"), Map.entry("CH", "Chandigarh"), Map.entry("CG", "Chhattisgarh"),
            Map.entry("DH", "Dadra and Nagar Haveli and Daman and Diu"), Map.entry("DL", "Delhi"), Map.entry("GA", "Goa"),
            Map.entry("GJ", "Gujarat"), Map.entry("HR", "Haryana"), Map.entry("HP", "Himachal Pradesh"), Map.entry("JK", "Jammu and Kashmir"),
            Map.entry("JH", "Jharkhand"), Map.entry("KA", "Karnataka"), Map.entry("KL", "Kerala"), Map.entry("LA", "Ladakh"),
            Map.entry("LD", "Lakshadweep"), Map.entry("MP", "Madhya Pradesh"), Map.entry("MH", "Maharashtra"), Map.entry("MN", "Manipur"),
            Map.entry("ML", "Meghalaya"), Map.entry("MZ", "Mizoram"), Map.entry("NL", "Nagaland"), Map.entry("OD", "Odisha"),
            Map.entry("PY", "Puducherry"), Map.entry("PB", "Punjab"), Map.entry("RJ", "Rajasthan"), Map.entry("SK", "Sikkim"),
            Map.entry("TN", "Tamil Nadu"), Map.entry("TS", "Telangana"), Map.entry("TR", "Tripura"), Map.entry("UP", "Uttar Pradesh"),
            Map.entry("UK", "Uttarakhand"), Map.entry("WB", "West Bengal"));

    private IndianStates() {}

    /** Blank clears the value; anything else must be a known state code. */
    public static String optional(String raw, String label) {
        if (raw == null || raw.isBlank()) return null;
        String code = raw.trim().toUpperCase(Locale.ROOT);
        if (code.startsWith("IN-")) code = code.substring(3);
        if (!NAMES.containsKey(code)) throw new PayrollException(400, label + " must be an Indian state or union territory code, for example MH or KA");
        return code;
    }
}
