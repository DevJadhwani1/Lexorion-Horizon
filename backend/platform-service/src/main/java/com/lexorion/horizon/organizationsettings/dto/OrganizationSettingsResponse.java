package com.lexorion.horizon.organizationsettings.dto;

import com.lexorion.horizon.organizationsettings.entity.OrganizationSettings;
import com.lexorion.horizon.organizationsettings.entity.WorkingDay;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Set;

public record OrganizationSettingsResponse(String timeZone, String locale, String country, String currency, String dateFormat, Set<WorkingDay> workingDays, String brandingDisplayName, String logoReference, String primaryColor, String secondaryColor, String onboardingAccessDecision, Instant onboardingAccessDecidedAt, Instant onboardingFinishedAt) {
   public static OrganizationSettingsResponse from(OrganizationSettings settings) {
      return settings == null
         ? new OrganizationSettingsResponse("UTC", "en-US", "US", "USD", "YYYY-MM-DD", EnumSet.of(WorkingDay.MONDAY, WorkingDay.TUESDAY, WorkingDay.WEDNESDAY, WorkingDay.THURSDAY, WorkingDay.FRIDAY), (String)null, (String)null, (String)null, (String)null, (String)null, (Instant)null, (Instant)null)
         : new OrganizationSettingsResponse(settings.getTimeZone(), settings.getLocale(), settings.getDefaultCountry(), settings.getDefaultCurrency(), settings.getDateFormat() != null ? settings.getDateFormat() : "YYYY-MM-DD", Set.copyOf(settings.getWorkingDays()), settings.getBrandingDisplayName(), settings.getLogoReference(), settings.getPrimaryColor(), settings.getSecondaryColor(), settings.getOnboardingAccessDecision(), settings.getOnboardingAccessDecidedAt(), settings.getOnboardingFinishedAt());
   }
}
