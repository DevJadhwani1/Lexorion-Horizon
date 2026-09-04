package com.lexorion.platform.tenantadmin.service;

import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.entity.OrganizationMembership;
import com.lexorion.platform.membership.entity.OrganizationRole;
import com.lexorion.platform.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.organization.repository.OrganizationRepository;
import com.lexorion.platform.organizationsettings.dto.UpdateOrganizationProfileRequest;
import com.lexorion.platform.organizationsettings.dto.UpdateOrganizationSettingsRequest;
import com.lexorion.platform.organizationsettings.entity.OrganizationSettings;
import com.lexorion.platform.organizationsettings.exception.InvalidOrganizationSettingsException;
import com.lexorion.platform.organizationsettings.repository.OrganizationSettingsRepository;
import com.lexorion.platform.tenantaccess.context.TenantAccessContext;
import com.lexorion.platform.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.platform.tenantadmin.dto.CurrentOrganizationResponse;
import com.lexorion.platform.tenantadmin.dto.TenantMemberResponse;
import com.lexorion.platform.tenantadmin.exception.TenantAdministrationConflictException;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.Currency;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TenantAdministrationService {
   private final TenantAccessContextHolder tenantContextHolder;
   private final OrganizationRepository organizationRepository;
   private final OrganizationMembershipRepository membershipRepository;
   private final OrganizationSettingsRepository settingsRepository;
   private static final Set<String> ISO_COUNTRIES = new HashSet(Set.of(Locale.getISOCountries()));
   private static final Set<String> AVAILABLE_LOCALES = (Set)Arrays.stream(Locale.getAvailableLocales()).map(Locale::toLanguageTag).collect(Collectors.toUnmodifiableSet());

   public TenantAdministrationService(TenantAccessContextHolder tenantContextHolder, OrganizationRepository organizationRepository, OrganizationMembershipRepository membershipRepository, OrganizationSettingsRepository settingsRepository) {
      this.tenantContextHolder = tenantContextHolder;
      this.organizationRepository = organizationRepository;
      this.membershipRepository = membershipRepository;
      this.settingsRepository = settingsRepository;
   }

   @Transactional(
      readOnly = true
   )
   public CurrentOrganizationResponse currentOrganization() {
      TenantAccessContext context = this.requireTenantAdministrator();
      Organization organization = this.findOrganization(context.organizationId());
      return this.response(organization);
   }

   public CurrentOrganizationResponse updateProfile(UpdateOrganizationProfileRequest request) {
      TenantAccessContext context = this.requireTenantAdministrator();
      Organization organization = this.lockMutableOrganization(context.organizationId());
      if (request.name() != null) {
         organization.setName(requireText(request.name(), "name"));
      }

      if (request.legalName() != null) {
         organization.setLegalName(trimToNull(request.legalName()));
      }

      if (request.description() != null) {
         organization.setDescription(trimToNull(request.description()));
      }

      if (request.industry() != null) {
         organization.setIndustry(trimToNull(request.industry()));
      }

      if (request.companySize() != null) {
         organization.setCompanySize(request.companySize());
      }

      if (request.website() != null) {
         organization.setWebsite(validateWebsite(request.website()));
      }

      if (request.primaryEmail() != null) {
         organization.setPrimaryEmail(request.primaryEmail().trim().toLowerCase(Locale.ROOT));
      }

      if (request.primaryPhone() != null) {
         organization.setPrimaryPhone(trimToNull(request.primaryPhone()));
      }

      if (request.addressLine1() != null) {
         organization.setAddressLine1(trimToNull(request.addressLine1()));
      }

      if (request.addressLine2() != null) {
         organization.setAddressLine2(trimToNull(request.addressLine2()));
      }

      if (request.addressCountry() != null) {
         organization.setAddressCountry(validateCountry(request.addressCountry()));
      }

      if (request.stateProvince() != null) {
         organization.setStateProvince(trimToNull(request.stateProvince()));
      }

      if (request.city() != null) {
         organization.setCity(trimToNull(request.city()));
      }

      if (request.postalCode() != null) {
         organization.setPostalCode(trimToNull(request.postalCode()));
      }

      this.organizationRepository.saveAndFlush(organization);
      return this.response(organization);
   }

   public CurrentOrganizationResponse updateSettings(UpdateOrganizationSettingsRequest request) {
      TenantAccessContext context = this.requireTenantAdministrator();
      Organization organization = this.lockMutableOrganization(context.organizationId());
      OrganizationSettings settings = (OrganizationSettings)this.settingsRepository.findByOrganizationId(organization.getId()).orElseGet(() -> newSettings(organization));
      if (request.timeZone() != null) {
         settings.setTimeZone(validateTimeZone(request.timeZone()));
      }

      if (request.locale() != null) {
         settings.setLocale(validateLocale(request.locale()));
      }

      if (request.country() != null) {
         settings.setDefaultCountry(validateCountry(request.country()));
      }

      if (request.currency() != null) {
         settings.setDefaultCurrency(validateCurrency(request.currency()));
      }

      if (request.workingDays() != null) {
         if (request.workingDays().isEmpty()) {
            throw invalid("workingDays must not be empty");
         }

         settings.setWorkingDays(EnumSet.copyOf(request.workingDays()));
      }

      if (request.brandingDisplayName() != null) {
         settings.setBrandingDisplayName(trimToNull(request.brandingDisplayName()));
      }

      if (request.logoReference() != null) {
         if (request.logoReference().contains("..")) {
            throw invalid("logoReference is invalid");
         }

         settings.setLogoReference(trimToNull(request.logoReference()));
      }

      if (request.primaryColor() != null) {
         settings.setPrimaryColor(request.primaryColor().toUpperCase(Locale.ROOT));
      }

      if (request.secondaryColor() != null) {
         settings.setSecondaryColor(request.secondaryColor().toUpperCase(Locale.ROOT));
      }

      this.settingsRepository.saveAndFlush(settings);
      return CurrentOrganizationResponse.from(organization, settings);
   }

   @Transactional(
      readOnly = true
   )
   public List<TenantMemberResponse> listMembers() {
      TenantAccessContext context = this.requireTenantAdministrator();
      return this.membershipRepository.findTenantMembers(context.organizationId()).stream().map(TenantMemberResponse::from).toList();
   }

   public TenantMemberResponse changeRole(UUID membershipId, OrganizationRole newRole) {
      TenantAccessContext actor = this.requireTenantAdministrator();
      this.requireMutableOrganization(actor.organizationId());
      OrganizationMembership target = this.findScopedMember(membershipId, actor.organizationId());
      this.authorizeRoleChange(actor, target, newRole);
      if (target.getRole() == OrganizationRole.OWNER && newRole != OrganizationRole.OWNER) {
         this.requireAnotherActiveOwner(actor.organizationId(), target.getId());
      }

      target.setRole(newRole);
      return TenantMemberResponse.from((OrganizationMembership)this.membershipRepository.saveAndFlush(target));
   }

   public void removeMember(UUID membershipId) {
      TenantAccessContext actor = this.requireTenantAdministrator();
      this.requireMutableOrganization(actor.organizationId());
      OrganizationMembership target = this.findScopedMember(membershipId, actor.organizationId());
      this.authorizeRemoval(actor, target);
      if (target.getRole() == OrganizationRole.OWNER && target.getStatus() == MembershipStatus.ACTIVE) {
         this.requireAnotherActiveOwner(actor.organizationId(), target.getId());
      }

      this.membershipRepository.delete(target);
   }

   private TenantAccessContext requireTenantAdministrator() {
      TenantAccessContext context = (TenantAccessContext)this.tenantContextHolder.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
      if (context.membershipRole() != OrganizationRole.OWNER && context.membershipRole() != OrganizationRole.ADMIN) {
         throw new AccessDeniedException("Organization administration requires OWNER or ADMIN");
      } else {
         return context;
      }
   }

   private void authorizeRoleChange(TenantAccessContext actor, OrganizationMembership target, OrganizationRole newRole) {
      if (actor.membershipRole() == OrganizationRole.ADMIN && (target.getRole() == OrganizationRole.OWNER || target.getRole() == OrganizationRole.ADMIN || newRole == OrganizationRole.OWNER || newRole == OrganizationRole.ADMIN)) {
         throw new AccessDeniedException("ADMIN may only manage MANAGER and MEMBER roles");
      }
   }

   private void authorizeRemoval(TenantAccessContext actor, OrganizationMembership target) {
      if (actor.membershipRole() == OrganizationRole.ADMIN && (target.getRole() == OrganizationRole.OWNER || target.getRole() == OrganizationRole.ADMIN)) {
         throw new AccessDeniedException("ADMIN may only remove MANAGER and MEMBER memberships");
      }
   }

   private void requireAnotherActiveOwner(UUID organizationId, UUID targetMembershipId) {
      boolean anotherOwner = this.membershipRepository.lockActiveOwners(organizationId).stream().anyMatch((owner) -> !owner.getId().equals(targetMembershipId));
      if (!anotherOwner) {
         throw new TenantAdministrationConflictException("The final active OWNER cannot be removed or demoted");
      }
   }

   private Organization findOrganization(UUID organizationId) {
      return (Organization)this.organizationRepository.findById(organizationId).orElseThrow(() -> ResourceNotFoundException.of("Organization", organizationId));
   }

   private void requireMutableOrganization(UUID organizationId) {
      this.lockMutableOrganization(organizationId);
   }

   private OrganizationMembership findScopedMember(UUID membershipId, UUID organizationId) {
      return (OrganizationMembership)this.membershipRepository.findTenantMember(membershipId, organizationId).orElseThrow(() -> ResourceNotFoundException.of("Membership", membershipId));
   }

   private Organization lockMutableOrganization(UUID organizationId) {
      Organization organization = (Organization)this.organizationRepository.findByIdForUpdate(organizationId).orElseThrow(() -> ResourceNotFoundException.of("Organization", organizationId));
      if (!organization.getStatus().allowsTenantManagement()) {
         throw new TenantAdministrationConflictException("Tenant administration mutations require a TRIAL or ACTIVE organization");
      } else {
         return organization;
      }
   }

   private CurrentOrganizationResponse response(Organization organization) {
      return CurrentOrganizationResponse.from(organization, this.settingsRepository.findByOrganizationId(organization.getId()).orElse(null));
   }

   private static OrganizationSettings newSettings(Organization organization) {
      OrganizationSettings settings = new OrganizationSettings();
      settings.setOrganization(organization);
      return settings;
   }

   private static String requireText(String value, String field) {
      String trimmed = value.trim();
      if (trimmed.isEmpty()) {
         throw invalid(field + " must not be blank");
      } else {
         return trimmed;
      }
   }

   private static String trimToNull(String value) {
      String trimmed = value.trim();
      return trimmed.isEmpty() ? null : trimmed;
   }

   private static String validateWebsite(String value) {
      String normalized = trimToNull(value);
      if (normalized == null) {
         return null;
      } else {
         try {
            URI uri = new URI(normalized);
            if (("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) && uri.getHost() != null) {
               return uri.toString();
            } else {
               throw invalid("website must be an HTTP(S) URL");
            }
         } catch (URISyntaxException var3) {
            throw invalid("website must be an HTTP(S) URL");
         }
      }
   }

   private static String validateTimeZone(String value) {
      try {
         return ZoneId.of(value.trim()).getId();
      } catch (DateTimeException var2) {
         throw invalid("timeZone must be a valid IANA identifier");
      }
   }

   private static String validateLocale(String value) {
      String normalized = value.trim().replace('_', '-');
      Locale locale = Locale.forLanguageTag(normalized);
      if (!locale.getLanguage().isEmpty() && !"und".equals(locale.toLanguageTag()) && AVAILABLE_LOCALES.contains(locale.toLanguageTag())) {
         return locale.toLanguageTag();
      } else {
         throw invalid("locale must be a valid BCP 47 language tag");
      }
   }

   private static String validateCountry(String value) {
      String normalized = value.trim().toUpperCase(Locale.ROOT);
      if (!ISO_COUNTRIES.contains(normalized)) {
         throw invalid("country must be an ISO 3166-1 alpha-2 code");
      } else {
         return normalized;
      }
   }

   private static String validateCurrency(String value) {
      String normalized = value.trim().toUpperCase(Locale.ROOT);

      try {
         return Currency.getInstance(normalized).getCurrencyCode();
      } catch (IllegalArgumentException var3) {
         throw invalid("currency must be an ISO 4217 code");
      }
   }

   private static InvalidOrganizationSettingsException invalid(String message) {
      return new InvalidOrganizationSettingsException(message);
   }
}
