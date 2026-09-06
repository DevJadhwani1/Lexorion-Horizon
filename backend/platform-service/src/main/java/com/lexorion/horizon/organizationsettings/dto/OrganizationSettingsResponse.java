package com.lexorion.horizon.organizationsettings.dto;

import com.lexorion.horizon.organizationsettings.entity.OrganizationSettings;
import com.lexorion.horizon.organizationsettings.entity.WorkingDay;
import java.util.EnumSet;
import java.util.Set;

public record OrganizationSettingsResponse(String timeZone, String locale, String country, String currency, Set<WorkingDay> workingDays, String brandingDisplayName, String logoReference, String primaryColor, String secondaryColor) {
   public static OrganizationSettingsResponse from(OrganizationSettings settings) {
      return settings == null ? new OrganizationSettingsResponse("UTC", "en-US", "US", "USD", EnumSet.of(WorkingDay.MONDAY, WorkingDay.TUESDAY, WorkingDay.WEDNESDAY, WorkingDay.THURSDAY, WorkingDay.FRIDAY), (String)null, (String)null, (String)null, (String)null) : new OrganizationSettingsResponse(settings.getTimeZone(), settings.getLocale(), settings.getDefaultCountry(), settings.getDefaultCurrency(), Set.copyOf(settings.getWorkingDays()), settings.getBrandingDisplayName(), settings.getLogoReference(), settings.getPrimaryColor(), settings.getSecondaryColor());
   }
}
