package com.lexorion.platform.organization.service;

import com.lexorion.platform.organization.exception.InvalidTenantSlugException;
import java.text.Normalizer;
import java.text.Normalizer.Form;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class TenantSlugService {
   private static final Pattern DNS_LABEL = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$");
   private static final Pattern WHITESPACE = Pattern.compile("\\s+");
   private static final Pattern REPEATED_HYPHENS = Pattern.compile("-+");
   private static final Pattern NON_ASCII_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
   private static final Pattern COMBINING_MARKS = Pattern.compile("\\p{M}+");

   public String normalizeOrGenerate(String requestedSlug, String organizationName) {
      return requestedSlug != null && !requestedSlug.isBlank() ? this.normalizeExplicit(requestedSlug) : this.generateFromName(organizationName);
   }

   public String normalizeExplicit(String value) {
      String normalized = REPEATED_HYPHENS.matcher(WHITESPACE.matcher(value.trim().toLowerCase(Locale.ROOT)).replaceAll("-")).replaceAll("-");
      this.validate(normalized);
      return normalized;
   }

   public String generateFromName(String name) {
      String ascii = COMBINING_MARKS.matcher(Normalizer.normalize(name, Form.NFKD)).replaceAll("").toLowerCase(Locale.ROOT);
      String generated = trimHyphens(REPEATED_HYPHENS.matcher(NON_ASCII_ALPHANUMERIC.matcher(ascii).replaceAll("-")).replaceAll("-"));
      if (generated.length() > 63) {
         generated = trimHyphens(generated.substring(0, 63));
      }

      this.validate(generated);
      return generated;
   }

   public void validate(String slug) {
      if (!DNS_LABEL.matcher(slug).matches()) {
         throw new InvalidTenantSlugException("Tenant slug must be 1-63 lowercase letters, numbers, or hyphens and cannot start or end with a hyphen");
      }
   }

   private static String trimHyphens(String value) {
      return value.replaceAll("^-+|-+$", "");
   }
}
