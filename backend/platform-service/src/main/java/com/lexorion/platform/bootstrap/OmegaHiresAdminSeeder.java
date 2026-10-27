package com.lexorion.platform.bootstrap;

import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.platformaccess.dto.CreatePlatformAccessRequest;
import com.lexorion.core.platformaccess.dto.UpdatePlatformAccessStatusRequest;
import com.lexorion.core.platformaccess.dto.UpdatePlatformRoleRequest;
import com.lexorion.core.platformaccess.entity.PlatformAccess;
import com.lexorion.core.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.platformaccess.service.PlatformAccessService;
import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
import com.lexorion.horizon.entitlement.repository.OrganizationPlanAssignmentRepository;
import com.lexorion.horizon.entitlement.service.PlanAssignmentService;
import com.lexorion.horizon.membership.dto.CreateMembershipRequest;
import com.lexorion.horizon.membership.dto.UpdateMembershipRoleRequest;
import com.lexorion.horizon.membership.dto.UpdateMembershipStatusRequest;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.membership.service.MembershipService;
import com.lexorion.horizon.product.entity.Product;
import com.lexorion.horizon.product.repository.ProductRepository;
import com.lexorion.horizon.workspace.entity.OrganizationWorkspace;
import com.lexorion.horizon.workspace.entity.WorkspaceStatus;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import com.lexorion.horizon.workspace.service.HorizonProvisioningService;
import com.lexorion.platform.organization.dto.CreateOrganizationRequest;
import com.lexorion.platform.organization.dto.UpdateOrganizationStatusRequest;
import com.lexorion.platform.organization.service.OrganizationService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(35)
@EnableConfigurationProperties(OmegaHiresSeedProperties.class)
public class OmegaHiresAdminSeeder implements ApplicationRunner {
   private static final Logger log = LoggerFactory.getLogger(OmegaHiresAdminSeeder.class);

   private final OmegaHiresSeedProperties properties;
   private final UserRepository userRepository;
   private final UserService userService;
   private final PlatformAccessRepository platformAccessRepository;
   private final PlatformAccessService platformAccessService;
   private final OrganizationRepository organizationRepository;
   private final OrganizationService organizationService;
   private final OrganizationMembershipRepository membershipRepository;
   private final MembershipService membershipService;
   private final HorizonProvisioningService horizonProvisioningService;
   private final PlanAssignmentService planAssignmentService;
   private final OrganizationPlanAssignmentRepository planAssignmentRepository;
   private final OrganizationWorkspaceRepository workspaceRepository;
   private final ProductRepository productRepository;
   private final Validator validator;

   public OmegaHiresAdminSeeder(OmegaHiresSeedProperties properties, UserRepository userRepository,
         UserService userService, PlatformAccessRepository platformAccessRepository,
         PlatformAccessService platformAccessService, OrganizationRepository organizationRepository,
         OrganizationService organizationService, OrganizationMembershipRepository membershipRepository,
         MembershipService membershipService, HorizonProvisioningService horizonProvisioningService,
         PlanAssignmentService planAssignmentService, OrganizationPlanAssignmentRepository planAssignmentRepository,
         OrganizationWorkspaceRepository workspaceRepository, ProductRepository productRepository,
         Validator validator) {
      this.properties = properties;
      this.userRepository = userRepository;
      this.userService = userService;
      this.platformAccessRepository = platformAccessRepository;
      this.platformAccessService = platformAccessService;
      this.organizationRepository = organizationRepository;
      this.organizationService = organizationService;
      this.membershipRepository = membershipRepository;
      this.membershipService = membershipService;
      this.horizonProvisioningService = horizonProvisioningService;
      this.planAssignmentService = planAssignmentService;
      this.planAssignmentRepository = planAssignmentRepository;
      this.workspaceRepository = workspaceRepository;
      this.productRepository = productRepository;
      this.validator = validator;
   }

   @Override
   @Transactional
   public void run(ApplicationArguments args) {
      if (!this.properties.isEnabled()) {
         return;
      }

      String normalizedEmail = UserService.normalizeEmail(this.properties.getEmail());
      Optional<User> existingUser = this.userRepository.findByEmailIgnoreCase(normalizedEmail);
      User user;

      if (existingUser.isPresent()) {
         user = existingUser.get();
         log.info("OmegaHires administrator account {} already exists (id={}, status={}). Preserving existing password.",
               user.getEmail(), user.getId(), user.getStatus());
      } else {
         CreateUserRequest request = validatedUserRequest(normalizedEmail);
         UUID createdId = this.userService.create(request).id();
         user = this.userRepository.findById(createdId).orElseThrow();
         log.info("Created OmegaHires administrator account {} (id={}).", user.getEmail(), user.getId());
      }

      // Reconcile Organization
      final User finalUser = user;
      Organization organization = this.organizationRepository.findBySlug(this.properties.getOrganizationSlug())
            .orElseGet(() -> {
               UUID orgId = this.organizationService.create(new CreateOrganizationRequest(
                     this.properties.getOrganizationName(), null, this.properties.getOrganizationCode(),
                     this.properties.getOrganizationSlug(), normalizedEmail, null, finalUser.getId(),
                     "starter", OrganizationStatus.ACTIVE)).id();
               return this.organizationRepository.findById(orgId).orElseThrow();
            });

      if (organization.getStatus() != OrganizationStatus.ACTIVE) {
         this.organizationService.updateStatus(organization.getId(),
               new UpdateOrganizationStatusRequest(OrganizationStatus.ACTIVE));
      }

      this.horizonProvisioningService.enroll(organization.getId());

      if (this.planAssignmentRepository.findForOrganization(organization.getId()).isEmpty()) {
         this.planAssignmentService.assignPlanToOrganization(organization.getId(), "starter");
      }

      // Reconcile Organization Workspace
      if (!this.workspaceRepository.existsByOrganizationIdAndKey(organization.getId(), "omegahires")) {
         Product finance = this.productRepository.findByKey("finance").orElse(null);
         Product workforce = this.productRepository.findByKey("workforce").orElse(null);
         Product payroll = this.productRepository.findByKey("payroll").orElse(null);
         if (workforce != null) {
            OrganizationWorkspace workspace = new OrganizationWorkspace();
            workspace.setOrganization(organization);
            workspace.setKey("omegahires");
            workspace.setDisplayName("OmegaHires");
            workspace.setStatus(WorkspaceStatus.ACTIVE);
            workspace.setProduct(finance != null ? finance : workforce);
            var products = new LinkedHashSet<Product>();
            if (finance != null) products.add(finance);
            if (workforce != null) products.add(workforce);
            if (payroll != null) products.add(payroll);
            workspace.setProducts(products);
            this.workspaceRepository.save(workspace);
            log.info("Created workspace omegahires with products for organization {}.", organization.getSlug());
         }
      }

      // Reconcile Organization Membership with ADMIN role
      Optional<OrganizationMembership> existingMembership = this.membershipRepository
            .findByOrganizationIdAndUserId(organization.getId(), user.getId());
      if (existingMembership.isEmpty()) {
         this.membershipService.addMember(organization.getId(),
               new CreateMembershipRequest(user.getId(), OrganizationRole.ADMIN));
         log.info("Granted ADMIN role in organization {} to user {}.", organization.getSlug(), user.getEmail());
      } else {
         OrganizationMembership membership = existingMembership.get();
         if (membership.getStatus() != MembershipStatus.ACTIVE) {
            this.membershipService.updateStatus(membership.getId(),
                  new UpdateMembershipStatusRequest(MembershipStatus.ACTIVE));
         }
         if (membership.getRole() != OrganizationRole.ADMIN) {
            this.membershipService.updateRole(membership.getId(),
                  new UpdateMembershipRoleRequest(OrganizationRole.ADMIN));
            log.info("Updated role to ADMIN for user {} in organization {}.", user.getEmail(), organization.getSlug());
         }
      }

      // Reconcile Platform Access
      if (this.properties.isGrantPlatformAccess()) {
         Optional<PlatformAccess> existingAccess = this.platformAccessRepository.findByUserId(user.getId());
         if (existingAccess.isEmpty()) {
            this.platformAccessService.grant(new CreatePlatformAccessRequest(user.getId(), this.properties.getPlatformRole()));
            log.info("Granted platform role {} to user {}.", this.properties.getPlatformRole(), user.getEmail());
         } else {
            PlatformAccess access = existingAccess.get();
            if (access.getStatus() != PlatformAccessStatus.ACTIVE) {
               this.platformAccessService.updateStatus(user.getId(),
                     new UpdatePlatformAccessStatusRequest(PlatformAccessStatus.ACTIVE));
            }
            if (access.getRole() != this.properties.getPlatformRole()) {
               this.platformAccessService.updateRole(user.getId(),
                     new UpdatePlatformRoleRequest(this.properties.getPlatformRole()));
            }
         }
      }
      log.info("OmegaHires administrator reconciliation complete for {}.", user.getEmail());
   }

   private CreateUserRequest validatedUserRequest(String normalizedEmail) {
      if (this.properties.getPassword() == null || this.properties.getPassword().isBlank()) {
         throw new IllegalStateException("OmegaHires seed password is required when creating a new administrator account");
      }
      CreateUserRequest request = new CreateUserRequest(normalizedEmail, this.properties.getFirstName(),
            this.properties.getLastName(), this.properties.getPassword());
      byte[] passwordBytes = request.password().getBytes(StandardCharsets.UTF_8);
      if (passwordBytes.length < 12 || passwordBytes.length > 72) {
         throw new IllegalStateException("OmegaHires seed password must be between 12 and 72 UTF-8 bytes");
      }
      Set<ConstraintViolation<CreateUserRequest>> violations = this.validator.validate(request);
      if (!violations.isEmpty()) {
         String details = violations.stream().sorted(Comparator.comparing(v -> v.getPropertyPath().toString()))
               .map(v -> v.getPropertyPath() + " " + v.getMessage()).reduce((left, right) -> left + ", " + right)
               .orElse("invalid request");
         throw new IllegalStateException("OmegaHires administrator seed configuration is invalid: " + details);
      }
      return request;
   }
}
