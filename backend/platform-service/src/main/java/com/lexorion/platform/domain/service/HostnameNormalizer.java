package com.lexorion.platform.domain.service;

import com.lexorion.platform.domain.exception.InvalidHostnameException;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class HostnameNormalizer {
   private static final Pattern LABEL = Pattern.compile("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$");
   private static final Pattern IPV4 = Pattern.compile("^(?:\\d{1,3}\\.){3}\\d{1,3}$");

   public String normalize(String value) {
      if (value != null && !value.isBlank()) {
         String hostname = value.trim().toLowerCase(Locale.ROOT);
         if (hostname.endsWith("..")) {
            throw invalid();
         } else {
            if (hostname.endsWith(".")) {
               hostname = hostname.substring(0, hostname.length() - 1);
            }

            if (!hostname.isBlank() && !hostname.contains("://") && hostname.indexOf(47) < 0 && hostname.indexOf(63) < 0 && hostname.indexOf(35) < 0 && hostname.indexOf(58) < 0 && !hostname.equals("localhost") && !IPV4.matcher(hostname).matches() && hostname.length() <= 253) {
               String[] labels = hostname.split("\\.", -1);
               if (labels.length < 2) {
                  throw invalid();
               } else {
                  for(String label : labels) {
                     if (!LABEL.matcher(label).matches()) {
                        throw invalid();
                     }
                  }

                  return hostname;
               }
            } else {
               throw invalid();
            }
         }
      } else {
         throw invalid();
      }
   }

   private static InvalidHostnameException invalid() {
      return new InvalidHostnameException("Hostname must be a valid public DNS hostname without protocol, path, port, or IP address");
   }
}
