package com.lexorion.platform.domain.service;

import com.lexorion.platform.domain.exception.InvalidHostnameException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class RequestHostnameExtractor {
   private static final Pattern IPV4 = Pattern.compile("^(?:\\d{1,3}\\.){3}\\d{1,3}$");
   private final HostnameNormalizer hostnameNormalizer;

   public RequestHostnameExtractor(HostnameNormalizer hostnameNormalizer) {
      this.hostnameNormalizer = hostnameNormalizer;
   }

   public Optional<String> extract(HttpServletRequest request) {
      String authority = request.getHeader("Host");
      if (authority == null || authority.isBlank()) {
         authority = request.getServerName();
      }

      if (authority != null && !authority.isBlank()) {
         String hostname = removePort(authority.trim());
         return !hostname.equalsIgnoreCase("localhost") && !IPV4.matcher(hostname).matches() && !isBracketedIpLiteral(hostname) ? Optional.of(this.hostnameNormalizer.normalize(hostname)) : Optional.empty();
      } else {
         return Optional.empty();
      }
   }

   private static String removePort(String authority) {
      if (!authority.startsWith("[")) {
         int firstColon = authority.indexOf(58);
         if (firstColon < 0) {
            return authority;
         } else if (firstColon == authority.lastIndexOf(58) && authority.substring(firstColon + 1).matches("\\d+")) {
            return authority.substring(0, firstColon);
         } else {
            throw invalid();
         }
      } else {
         int closingBracket = authority.indexOf(93);
         if (closingBracket >= 0 && (closingBracket + 1 >= authority.length() || authority.substring(closingBracket + 1).matches(":\\d+"))) {
            return authority.substring(0, closingBracket + 1);
         } else {
            throw invalid();
         }
      }
   }

   private static boolean isBracketedIpLiteral(String hostname) {
      return hostname.startsWith("[") && hostname.endsWith("]");
   }

   private static InvalidHostnameException invalid() {
      return new InvalidHostnameException("Request Host header is invalid");
   }
}
