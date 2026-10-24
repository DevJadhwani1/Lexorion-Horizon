package com.lexorion.platform.bootstrap;

import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
import com.lexorion.horizon.membership.dto.CreateMembershipRequest;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.membership.service.MembershipService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.util.Comparator;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Provisions one reserved local test user and an administrator membership. An existing user keeps the password
 * already stored. This is not a reset, and it does not run for a production profile or environment.
 */
@Component
@Order(40)
@EnableConfigurationProperties(LocalQaIdentityProperties.class)
public class LocalQaIdentityProvisioner implements ApplicationRunner {
   private static final Logger log = LoggerFactory.getLogger(LocalQaIdentityProvisioner.class);
   private final LocalQaIdentityProperties properties;
   private final Environment environment;
   private final UserRepository userRepository;
   private final UserService userService;
   private final OrganizationRepository organizationRepository;
   private final OrganizationMembershipRepository membershipRepository;
   private final MembershipService membershipService;
   private final Validator validator;

   public LocalQaIdentityProvisioner(LocalQaIdentityProperties properties, Environment environment, UserRepository userRepository,
         UserService userService, OrganizationRepository organizationRepository, OrganizationMembershipRepository membershipRepository,
         MembershipService membershipService, Validator validator) {
      this.properties = properties;
      this.environment = environment;
      this.userRepository = userRepository;
      this.userService = userService;
      this.organizationRepository = organizationRepository;
      this.membershipRepository = membershipRepository;
      this.membershipService = membershipService;
      this.validator = validator;
   }

   @Override
   @Transactional
   public void run(ApplicationArguments args) {
      if (!this.properties.isEnabled()) {
         return;
      }
      assertLocalOnly();
      String email = UserService.normalizeEmail(this.properties.getEmail());
      User user = this.userRepository.findByEmailIgnoreCase(email).orElseGet(() -> {
         UUID userId = this.userService.create(validatedUser(email)).id();
         return this.userRepository.findById(userId).orElseThrow();
      });
      var organization = this.organizationRepository.findBySlug(this.properties.getOrganizationSlug())
            .orElseThrow(() -> new IllegalStateException("Local QA identity organization was not found"));
      if (!this.membershipRepository.existsByOrganizationIdAndUserId(organization.getId(), user.getId())) {
         this.membershipService.addMember(organization.getId(), new CreateMembershipRequest(user.getId(), OrganizationRole.ADMIN));
      }
      log.info("Local QA identity is present");
   }

   private void assertLocalOnly() {
      if (!"local-only".equals(this.properties.getAcknowledgment())) {
         throw new IllegalStateException("Local QA identity requires LEXORION_QA_IDENTITY_ACK=local-only");
      }
      String deployment = this.properties.getEnvironment() == null ? "" : this.properties.getEnvironment().trim().toLowerCase(Locale.ROOT);
      if ("prod".equals(deployment) || "production".equals(deployment) || this.environment.acceptsProfiles(Profiles.of("prod", "production"))) {
         throw new IllegalStateException("Local QA identity cannot be enabled in production");
      }
      String email = this.properties.getEmail() == null ? "" : this.properties.getEmail().trim().toLowerCase(Locale.ROOT);
      if (!email.endsWith("@lexorion.test")) {
         throw new IllegalStateException("Local QA identity email must use the reserved lexorion.test domain");
      }
   }

   private CreateUserRequest validatedUser(String email) {
      CreateUserRequest request = new CreateUserRequest(email, this.properties.getFirstName(), this.properties.getLastName(), this.properties.getPassword());
      byte[] password = request.password() == null ? new byte[0] : request.password().getBytes(StandardCharsets.UTF_8);
      if (password.length < 12 || password.length > 72) {
         throw new IllegalStateException("Local QA identity password must be between 12 and 72 UTF-8 bytes");
      }
      Set<ConstraintViolation<CreateUserRequest>> violations = this.validator.validate(request);
      if (!violations.isEmpty()) {
         String details = violations.stream().sorted(Comparator.comparing(v -> v.getPropertyPath().toString()))
               .map(v -> v.getPropertyPath() + " " + v.getMessage()).reduce((left, right) -> left + "; " + right).orElse("invalid request");
         throw new IllegalStateException("Local QA identity configuration is invalid: " + details);
      }
      return request;
   }
}
