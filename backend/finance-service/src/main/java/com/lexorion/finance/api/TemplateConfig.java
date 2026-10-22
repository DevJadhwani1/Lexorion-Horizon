package com.lexorion.finance.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * Everything a subscriber can change about how their bill looks and what it carries. Stored as JSON on the template and
 * frozen onto each invoice when it is issued. Every section is optional; {@link #normalized()} fills the gaps.
 */
public record TemplateConfig(
        @Valid Branding branding,
        @Valid Seller seller,
        @Valid DocumentText document,
        @Valid Numbering numbering,
        @Valid Tax tax,
        @Valid Columns columns,
        /** Industry fields captured on each invoice, for example Candidate and Joining date for recruitment. */
        @Size(max = 8) List<@Valid @NotNull CustomField> customFields,
        @Size(max = 10) List<@Valid @NotNull LabelledValue> paymentDetails,
        @Size(max = 10) List<@NotBlank @Size(max = 300) String> terms,
        @Size(max = 2000) String defaultNotes,
        @Valid Signatory signatory,
        @Size(max = 300) String footerNote,
        Boolean showAmountInWords,
        DateStyle dateStyle) {

    private static final String IMAGE = "^data:image/(png|jpeg|webp|svg\\+xml);base64,[A-Za-z0-9+/=]+$";
    private static final String COLOR = "^#[0-9A-Fa-f]{6}$";
    public static final String FIELD_KEY = "^[a-z][a-zA-Z0-9]{0,39}$";

    public enum TaxMode { NONE, SIMPLE, GST }
    public enum FieldType { TEXT, DATE, NUMBER }
    public enum DateStyle { ORDINAL, MEDIUM, NUMERIC }

    public record Branding(
            @Size(max = 400_000) @Pattern(regexp = IMAGE, message = "must be a PNG, JPEG, WebP or SVG image") String logo,
            @Pattern(regexp = COLOR, message = "must be a #RRGGBB colour") String primaryColor,
            @Pattern(regexp = COLOR, message = "must be a #RRGGBB colour") String accentColor) { }

    /** The issuing company. Registration numbers are label/value pairs so any country's IDs fit (GSTIN, PAN, VAT, EIN…). */
    public record Seller(
            @Size(max = 160) String legalName,
            @Size(max = 160) String tagline,
            @Size(max = 160) String subline,
            @Size(max = 500) String address,
            @Size(max = 64) String phone,
            @Email @Size(max = 254) String email,
            @Size(max = 120) String website,
            /** State or region of registration; for GST it decides CGST + SGST versus IGST. */
            @Size(max = 64) String region,
            @Size(max = 8) List<@Valid @NotNull LabelledValue> identifiers) { }

    public record LabelledValue(@NotBlank @Size(max = 40) String label, @NotBlank @Size(max = 160) String value) { }

    public record DocumentText(
            @Size(max = 40) String title,
            @Size(max = 40) String subtitle,
            @Size(max = 40) String copyLabel,
            /** Heading over the industry fields, for example "Recruitment engagement". */
            @Size(max = 60) String detailsTitle) { }

    /**
     * Invoice number pattern. Tokens: {SEQ} (required, once), {FY} (financial year, "26-27"), {YYYY}, {YY}, {MM}.
     * The serial restarts whenever the text around {SEQ} changes, so including {FY} restarts it every financial year.
     */
    public record Numbering(
            @Size(max = 40) String pattern,
            @Min(1) @Max(9) Integer padding,
            @Min(1) @Max(12) Integer fiscalYearStartMonth) { }

    public record Tax(TaxMode mode, @Size(max = 24) String label) { }

    public record Columns(Boolean showItemCode, @Size(max = 24) String itemCodeLabel, Boolean showHsnSac) { }

    public record CustomField(
            @NotBlank @Pattern(regexp = FIELD_KEY, message = "must start with a letter and use only letters and numbers") String key,
            @NotBlank @Size(max = 40) String label,
            @NotNull FieldType type,
            Boolean required) { }

    public record Signatory(
            @Size(max = 120) String name,
            @Size(max = 80) String title,
            @Size(max = 200_000) @Pattern(regexp = IMAGE, message = "must be a PNG, JPEG, WebP or SVG image") String signatureImage) { }

    /** The format used when a workspace has not designed one: matches the original INV-00001 numbering. */
    public static TemplateConfig standard() {
        return new TemplateConfig(null, null, null, null, null, null, null, null, null, null, null, null, null, null).normalized();
    }

    /** A copy with every section present and defaults applied, so renderers never handle missing sections. */
    public TemplateConfig normalized() {
        Branding b = branding == null ? new Branding(null, null, null) : branding;
        Seller s = seller == null ? new Seller(null, null, null, null, null, null, null, null, null) : seller;
        DocumentText d = document == null ? new DocumentText(null, null, null, null) : document;
        Numbering n = numbering == null ? new Numbering(null, null, null) : numbering;
        Tax t = tax == null ? new Tax(null, null) : tax;
        Columns c = columns == null ? new Columns(null, null, null) : columns;
        Signatory g = signatory == null ? new Signatory(null, null, null) : signatory;
        return new TemplateConfig(
                new Branding(b.logo(), or(b.primaryColor(), "#1D2B7A"), or(b.accentColor(), "#7CB342")),
                new Seller(s.legalName(), s.tagline(), s.subline(), s.address(), s.phone(), s.email(), s.website(), s.region(),
                        s.identifiers() == null ? List.of() : s.identifiers()),
                new DocumentText(or(d.title(), "Invoice"), d.subtitle(), d.copyLabel(), or(d.detailsTitle(), "Details")),
                new Numbering(or(n.pattern(), "INV-{SEQ}"), n.padding() == null ? 5 : n.padding(),
                        n.fiscalYearStartMonth() == null ? 4 : n.fiscalYearStartMonth()),
                new Tax(t.mode() == null ? TaxMode.SIMPLE : t.mode(), or(t.label(), t.mode() == TaxMode.GST ? "GST" : "Tax")),
                new Columns(c.showItemCode() != null && c.showItemCode(), or(c.itemCodeLabel(), "Code"), c.showHsnSac() != null && c.showHsnSac()),
                customFields == null ? List.of() : customFields,
                paymentDetails == null ? List.of() : paymentDetails,
                terms == null ? List.of() : terms,
                defaultNotes,
                g,
                footerNote,
                showAmountInWords == null || showAmountInWords,
                dateStyle == null ? DateStyle.MEDIUM : dateStyle);
    }

    private static String or(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
