package com.lexorion.platform.bootstrap;

import com.lexorion.core.organization.entity.OrganizationStatus;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
import com.lexorion.horizon.membership.dto.CreateMembershipRequest;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.membership.service.MembershipService;
import com.lexorion.platform.organization.dto.CreateOrganizationRequest;
import com.lexorion.platform.organization.dto.UpdateOrganizationStatusRequest;
import com.lexorion.platform.organization.service.OrganizationService;
import com.lexorion.horizon.entitlement.repository.OrganizationPlanAssignmentRepository;
import com.lexorion.horizon.entitlement.service.PlanAssignmentService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.Set;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

@Component
@Order(30)
@EnableConfigurationProperties(ClientSeedProperties.class)
public class ClientUserSeeder implements ApplicationRunner {
   private final ClientSeedProperties properties;
   private final UserRepository userRepository;
   private final UserService userService;
   private final OrganizationRepository organizationRepository;
   private final OrganizationService organizationService;
   private final OrganizationMembershipRepository membershipRepository;
   private final MembershipService membershipService;
   private final PlanAssignmentService planAssignmentService;
   private final OrganizationPlanAssignmentRepository planAssignmentRepository;
   private final Validator validator;

   public ClientUserSeeder(ClientSeedProperties properties, UserRepository userRepository, UserService userService,
         OrganizationRepository organizationRepository, OrganizationService organizationService,
         OrganizationMembershipRepository membershipRepository, MembershipService membershipService,
         PlanAssignmentService planAssignmentService, OrganizationPlanAssignmentRepository planAssignmentRepository,
         Validator validator) {
      this.properties = properties;
      this.userRepository = userRepository;
      this.userService = userService;
      this.organizationRepository = organizationRepository;
      this.organizationService = organizationService;
      this.membershipRepository = membershipRepository;
      this.membershipService = membershipService;
      this.planAssignmentService = planAssignmentService;
      this.planAssignmentRepository = planAssignmentRepository;
      this.validator = validator;
   }

   @Override
   @Transactional
   public void run(ApplicationArguments args) {
      if (!this.properties.isEnabled()) {
         return;
      }

      User user = this.userRepository.findByEmailIgnoreCase(this.properties.getEmail()).orElseGet(() -> {
         UUID userId = this.userService.create(this.validatedUserRequest()).id();
         return this.userRepository.findById(userId).orElseThrow();
      });
      var organization = this.organizationRepository.findBySlug(this.properties.getOrganizationSlug())
            .orElseGet(() -> {
               UUID organizationId = this.organizationService.create(new CreateOrganizationRequest(
                     this.properties.getOrganizationName(), null, this.properties.getOrganizationCode(),
                     this.properties.getOrganizationSlug(), this.properties.getEmail(), null, user.getId(),
                     "starter", OrganizationStatus.ACTIVE)).id();
               return this.organizationRepository.findById(organizationId).orElseThrow();
            });

      if (this.planAssignmentRepository.findForOrganization(organization.getId()).isEmpty()) {
         this.planAssignmentService.assignPlanToOrganization(organization.getId(), "starter");
      }
      if (organization.getStatus() != OrganizationStatus.ACTIVE) {
         this.organizationService.updateStatus(organization.getId(),
               new UpdateOrganizationStatusRequest(OrganizationStatus.ACTIVE));
      }
      if (!this.membershipRepository.existsByOrganizationIdAndUserId(organization.getId(), user.getId())) {
         this.membershipService.addMember(organization.getId(),
               new CreateMembershipRequest(user.getId(), OrganizationRole.ADMIN));
      }
   }

   private CreateUserRequest validatedUserRequest() {
      CreateUserRequest request = new CreateUserRequest(UserService.normalizeEmail(this.properties.getEmail()),
            this.properties.getFirstName(), this.properties.getLastName(), this.properties.getPassword());
      if (request.password() == null || request.password().getBytes(StandardCharsets.UTF_8).length < 12
            || request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
         throw new IllegalStateException("Client seed password must be between 12 and 72 UTF-8 bytes");
      }
      Set<ConstraintViolation<CreateUserRequest>> violations = this.validator.validate(request);
      if (!violations.isEmpty()) {
         String details = violations.stream().sorted(Comparator.comparing(v -> v.getPropertyPath().toString()))
               .map(v -> v.getPropertyPath() + " " + v.getMessage()).reduce((left, right) -> left + ", " + right)
               .orElse("invalid request");
         throw new IllegalStateException("Client seed configuration is invalid: " + details);
      }
      return request;
   }
}
