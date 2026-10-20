package com.lexorion.platform.bootstrap;

import com.lexorion.core.platformaccess.dto.CreatePlatformAccessRequest;
import com.lexorion.core.platformaccess.entity.PlatformRole;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.platformaccess.service.PlatformAccessService;
import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Comparator;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@EnableConfigurationProperties({BootstrapProperties.class})
public class InitialPlatformAdminBootstrap implements ApplicationRunner {
   private static final String FIRST_NAME = "Platform";
   private static final String LAST_NAME = "Administrator";
   private final BootstrapProperties properties;
   private final PlatformAccessRepository platformAccessRepository;
   private final UserService userService;
   private final UserRepository userRepository;
   private final PlatformAccessService platformAccessService;
   private final Validator validator;

   public InitialPlatformAdminBootstrap(BootstrapProperties properties, PlatformAccessRepository platformAccessRepository, UserService userService, UserRepository userRepository, PlatformAccessService platformAccessService, Validator validator) {
      this.properties = properties;
      this.platformAccessRepository = platformAccessRepository;
      this.userService = userService;
      this.userRepository = userRepository;
      this.platformAccessService = platformAccessService;
      this.validator = validator;
   }

   @Transactional
   public void run(ApplicationArguments args) {
      if (this.properties.isEnabled()) {
         // Bootstrap is provisioning, never an account repair or privilege restoration path.
         if (this.userRepository.count() != 0 || this.platformAccessRepository.count() != 0) {
            throw new IllegalStateException("Bootstrap requires an empty identity store. Disable LEXORION_BOOTSTRAP_ENABLED after initial provisioning; use authenticated administration to recover access.");
         }
         CreateUserRequest request = this.validatedRequest();
         UUID userId = this.userService.create(request).id();
         this.platformAccessService.grant(new CreatePlatformAccessRequest(userId, PlatformRole.SUPER_ADMIN));
      }
   }

   private CreateUserRequest validatedRequest() {
      CreateUserRequest request = new CreateUserRequest(UserService.normalizeEmail(this.properties.getEmail()), FIRST_NAME, LAST_NAME, this.properties.getPassword());
      if (request.password() == null || request.password().length() < 12 || request.password().getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) {
         throw new IllegalStateException("Initial platform administrator bootstrap configuration is invalid: password must be at least 12 characters and at most 72 UTF-8 bytes");
      }
      Set<ConstraintViolation<CreateUserRequest>> violations = this.validator.validate(request, new Class[0]);
      if (!violations.isEmpty()) {
         String details = (String)violations.stream().sorted(Comparator.comparing((v) -> v.getPropertyPath().toString())).map((v) -> {
            String var10000 = String.valueOf(v.getPropertyPath());
            return var10000 + " " + v.getMessage();
         }).collect(Collectors.joining(", "));
         throw new IllegalStateException("Initial platform administrator bootstrap configuration is invalid: " + details);
      } else {
         return request;
      }
   }
}
