package com.lexorion.horizon.tenantadmin.service;

import com.lexorion.core.audit.AuditRecorder;
import com.lexorion.core.exception.ResourceNotFoundException;
import com.lexorion.horizon.entitlement.exception.EntitlementDeniedException;
import com.lexorion.horizon.entitlement.service.EntitlementService;
import com.lexorion.horizon.invitation.entity.InvitationStatus;
import com.lexorion.horizon.invitation.repository.OrganizationInvitationRepository;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.horizon.organizationsettings.dto.UpdateOrganizationProfileRequest;
import com.lexorion.horizon.organizationsettings.dto.UpdateOrganizationSettingsRequest;
import com.lexorion.horizon.organizationsettings.entity.OrganizationSettings;
import com.lexorion.horizon.organizationsettings.exception.InvalidOrganizationSettingsException;
import com.lexorion.horizon.organizationsettings.repository.OrganizationSettingsRepository;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContext;
import com.lexorion.horizon.tenantaccess.context.TenantAccessContextHolder;
import com.lexorion.horizon.tenantadmin.dto.CurrentOrganizationResponse;
import com.lexorion.horizon.tenantadmin.dto.TenantMemberResponse;
import com.lexorion.horizon.tenantadmin.exception.TenantAdministrationConflictException;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.entity.WorkspaceStatus;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.Instant;
import java.util.ArrayList;
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
   private final OrganizationWorkspaceRepository workspaceRepository;
   private final OrganizationInvitationRepository invitationRepository;
   private final EntitlementService entitlements;
   private final AuditRecorder audit;
   private static final Set<String> ISO_COUNTRIES = new HashSet<>(Set.of(Locale.getISOCountries()));
   private static final Set<String> AVAILABLE_LOCALES = Arrays.stream(Locale.getAvailableLocales()).map(Locale::toLanguageTag).collect(Collectors.toUnmodifiableSet());

   public TenantAdministrationService(TenantAccessContextHolder tenantContextHolder, OrganizationRepository organizationRepository, OrganizationMembershipRepository membershipRepository, OrganizationSettingsRepository settingsRepository, OrganizationWorkspaceRepository workspaceRepository, OrganizationInvitationRepository invitationRepository, EntitlementService entitlements, AuditRecorder audit) {
      this.tenantContextHolder = tenantContextHolder;
      this.organizationRepository = organizationRepository;
      this.membershipRepository = membershipRepository;
      this.settingsRepository = settingsRepository;
      this.workspaceRepository = workspaceRepository;
      this.invitationRepository = invitationRepository;
      this.entitlements = entitlements;
      this.audit = audit;
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

      if (request.has("name")) {
         organization.setName(requireText(request.name(), "name"));
      }

      if (request.has("legalName")) {
         organization.setLegalName(trimToNull(request.legalName()));
      }

      if (request.has("description")) {
         organization.setDescription(trimToNull(request.description()));
      }

      if (request.has("industry")) {
         organization.setIndustry(trimToNull(request.industry()));
      }

      if (request.has("companySize")) {
         organization.setCompanySize(validateCompanySize(request.companySize()));
      }

      if (request.has("website")) {
         organization.setWebsite(validateWebsite(request.website()));
      }

      if (request.has("primaryEmail")) {
         organization.setPrimaryEmail(validateEmail(request.primaryEmail()));
      }

      if (request.has("primaryPhone")) {
         organization.setPrimaryPhone(com.lexorion.platform.validation.PhoneNumbers.normalizeOptional(request.primaryPhone(), "Primary phone"));
      }

      if (request.has("addressLine1")) {
         organization.setAddressLine1(trimToNull(request.addressLine1()));
      }

      if (request.has("addressLine2")) {
         organization.setAddressLine2(trimToNull(request.addressLine2()));
      }

      if (request.has("addressCountry")) {
         String country = trimToNull(request.addressCountry());
         organization.setAddressCountry(country != null ? validateCountry(country) : null);
      }

      if (request.has("stateProvince")) {
         organization.setStateProvince(trimToNull(request.stateProvince()));
      }

      if (request.has("city")) {
         organization.setCity(trimToNull(request.city()));
      }

      if (request.has("postalCode")) {
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

      if (request.dateFormat() != null) {
         settings.setDateFormat(validateDateFormat(request.dateFormat()));
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

   /** Records that this organization will continue with its current administrator and no pending invite. */
   public CurrentOrganizationResponse confirmSoloAccess() {
      TenantAccessContext context = this.requireTenantAdministrator();
      Organization organization = this.lockMutableOrganization(context.organizationId());
      OrganizationSettings settings = this.settings(organization);
      settings.setOnboardingAccessDecision("SOLO");
      settings.setOnboardingAccessDecidedAt(Instant.now());
      this.settingsRepository.saveAndFlush(settings);
      this.audit.record(context.userId(), organization.getId(), null, "onboarding.access.solo", "ORGANIZATION", organization.getId().toString(), "SUCCESS");
      return CurrentOrganizationResponse.from(organization, settings);
   }

   /**
    * Finishes onboarding only when the organization profile, entitled workspace products, and access
    * decision are all satisfied. Selecting a workspace is not one of those prerequisites.
    */
   public CurrentOrganizationResponse finishOnboarding() {
      TenantAccessContext context = this.requireTenantAdministrator();
      Organization organization = this.lockMutableOrganization(context.organizationId());
      List<String> missing = this.onboardingGaps(organization);
      if (!missing.isEmpty()) {
         throw new TenantAdministrationConflictException(String.join(" ", missing));
      }
      OrganizationSettings settings = this.settings(organization);
      settings.setOnboardingFinishedAt(Instant.now());
      this.settingsRepository.saveAndFlush(settings);
      this.audit.record(context.userId(), organization.getId(), null, "onboarding.finish", "ORGANIZATION", organization.getId().toString(), "SUCCESS");
      return CurrentOrganizationResponse.from(organization, settings);
   }

   private List<String> onboardingGaps(Organization organization) {
      List<String> missing = new ArrayList<>();
      if (!profileReady(organization)) {
         missing.add("Add a phone number, legal name, industry, website, or street address. Country and currency defaults do not complete organization setup.");
      }
      Set<String> requiredProducts = this.requiredProducts(organization.getId(), missing);
      List<OrganizationWorkspace> active = this.workspaceRepository.findTenantWorkspaces(organization.getId()).stream().filter((workspace) -> workspace.getStatus() == WorkspaceStatus.ACTIVE).toList();
      if (active.isEmpty()) {
         missing.add("Create an active workspace before finishing setup.");
      } else if (!requiredProducts.isEmpty() && active.stream().noneMatch((workspace) -> covers(workspace, requiredProducts))) {
         missing.add("Attach " + String.join(", ", requiredProducts) + " to an active workspace. Those products are included in the organization plan.");
      } else if (requiredProducts.isEmpty() && missing.stream().noneMatch((item) -> item.startsWith("Assign an active")) && active.stream().allMatch((workspace) -> workspace.availableProducts().isEmpty())) {
         missing.add("Attach at least one product to an active workspace.");
      }
      if (!this.accessReady(organization)) {
         missing.add("Invite a member, keep a pending invitation, or continue as the only administrator. Accepted, revoked, and expired invitations do not count.");
      }
      return missing;
   }

   private Set<String> requiredProducts(UUID organizationId, List<String> missing) {
      try {
         return this.entitlements.enabledProductKeysForOrganization(organizationId);
      } catch (EntitlementDeniedException ex) {
         missing.add("Assign an active Starter, Business, or Enterprise plan before finishing setup.");
         return Set.of();
      }
   }

   private boolean accessReady(Organization organization) {
      long activeMembers = this.membershipRepository.findByOrganizationIdOrderByCreatedAtAsc(organization.getId()).stream().filter((member) -> member.getStatus() == MembershipStatus.ACTIVE).count();
      if (activeMembers > 1) {
         return true;
      }
      boolean pending = this.invitationRepository.findTenantInvitations(organization.getId()).stream().anyMatch((invitation) -> invitation.getStatus() == InvitationStatus.PENDING && invitation.getExpiresAt().isAfter(Instant.now()));
      if (pending) {
         return true;
      }
      return this.settingsRepository.findByOrganizationId(organization.getId()).map((settings) -> "SOLO".equals(settings.getOnboardingAccessDecision())).orElse(false);
   }

   private static boolean covers(OrganizationWorkspace workspace, Set<String> requiredProducts) {
      Set<String> attached = workspace.availableProducts().stream().map((product) -> product.getKey()).collect(Collectors.toSet());
      return attached.containsAll(requiredProducts);
   }

   static boolean profileReady(Organization organization) {
      return text(organization.getName()) && text(organization.getPrimaryEmail()) && (text(organization.getPrimaryPhone()) || text(organization.getLegalName()) || text(organization.getIndustry()) || text(organization.getWebsite()) || text(organization.getAddressLine1()));
   }

   private static boolean text(String value) {
      return value != null && !value.trim().isEmpty();
   }

   private OrganizationSettings settings(Organization organization) {
      return (OrganizationSettings)this.settingsRepository.findByOrganizationId(organization.getId()).orElseGet(() -> newSettings(organization));
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
      if (target.getRole() == OrganizationRole.ADMIN && newRole != OrganizationRole.ADMIN) {
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
      if (target.getRole() == OrganizationRole.ADMIN && target.getStatus() == MembershipStatus.ACTIVE) {
         this.requireAnotherActiveOwner(actor.organizationId(), target.getId());
      }

      this.membershipRepository.delete(target);
   }

   private TenantAccessContext requireTenantAdministrator() {
      TenantAccessContext context = (TenantAccessContext)this.tenantContextHolder.get().orElseThrow(() -> new AccessDeniedException("Active tenant membership is required"));
      if (context.membershipRole() != OrganizationRole.ADMIN) {
         throw new AccessDeniedException("Organization administration requires ADMIN");
      } else {
         return context;
      }
   }

   private void authorizeRoleChange(TenantAccessContext actor, OrganizationMembership target, OrganizationRole newRole) {
      // ADMIN is the highest organization authority. Final-admin protection is enforced separately.
   }

   private void authorizeRemoval(TenantAccessContext actor, OrganizationMembership target) {
      // ADMIN may manage organization memberships. Final-admin protection is enforced separately.
   }

   private void requireAnotherActiveOwner(UUID organizationId, UUID targetMembershipId) {
      boolean anotherOwner = this.membershipRepository.lockActiveOwners(organizationId).stream().anyMatch((owner) -> !owner.getId().equals(targetMembershipId));
      if (!anotherOwner) {
         throw new TenantAdministrationConflictException("The final active ADMIN cannot be removed or demoted");
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

   private static final java.util.regex.Pattern EMAIL_PATTERN = java.util.regex.Pattern.compile(
      "^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$"
   );

   private static final Set<String> VALID_COMPANY_SIZES = Set.of(
      "MICRO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE"
   );

   private static String validateEmail(String value) {
      String trimmed = requireText(value, "primaryEmail");
      if (!EMAIL_PATTERN.matcher(trimmed).matches()) {
         throw invalid("primaryEmail must be a valid email address");
      }
      return trimmed.toLowerCase(Locale.ROOT);
   }

   private static String validateCompanySize(String value) {
      String trimmed = trimToNull(value);
      if (trimmed == null) {
         return null;
      }
      String upper = trimmed.toUpperCase(Locale.ROOT);
      if (!VALID_COMPANY_SIZES.contains(upper)) {
         throw invalid("companySize must be one of MICRO, SMALL, MEDIUM, LARGE, ENTERPRISE");
      }
      return upper;
   }

   private static String requireText(String value, String field) {
      if (value == null) {
         throw invalid(field + " must not be blank");
      }
      String trimmed = value.trim();
      if (trimmed.isEmpty()) {
         throw invalid(field + " must not be blank");
      } else {
         return trimmed;
      }
   }

   private static String trimToNull(String value) {
      if (value == null) {
         return null;
      }
      String trimmed = value.trim();
      return trimmed.isEmpty() ? null : trimmed;
   }

   private static String validateWebsite(String value) {
      String normalized = trimToNull(value);
      if (normalized == null) {
         return null;
      }
      String lower = normalized.toLowerCase();
      if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("file:") || lower.startsWith("ftp:")) {
         throw invalid("website contains an unsupported protocol");
      }
      String urlToParse = normalized;
      if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
         urlToParse = "https://" + normalized;
      }
      try {
         URI uri = new URI(urlToParse);
         if (("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) && uri.getHost() != null) {
            return normalized;
         } else {
            throw invalid("website must be an HTTP(S) URL or valid domain");
         }
      } catch (URISyntaxException var3) {
         throw invalid("website must be an HTTP(S) URL or valid domain");
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

   private static final Set<String> SUPPORTED_DATE_FORMATS = Set.of(
      "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "DD MMM YYYY"
   );

   private static String validateDateFormat(String value) {
      String normalized = value.trim();
      if (!SUPPORTED_DATE_FORMATS.contains(normalized)) {
         throw invalid("dateFormat must be one of: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD MMM YYYY");
      } else {
         return normalized;
      }
   }

   private static InvalidOrganizationSettingsException invalid(String message) {
      return new InvalidOrganizationSettingsException(message);
   }
}
