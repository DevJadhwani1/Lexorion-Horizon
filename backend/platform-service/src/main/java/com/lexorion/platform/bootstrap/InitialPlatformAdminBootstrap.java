package com.lexorion.platform.bootstrap;

import com.lexorion.platform.platformaccess.dto.CreatePlatformAccessRequest;
import com.lexorion.core.platformaccess.entity.PlatformRole;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.platform.platformaccess.service.PlatformAccessService;
import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.dto.UserResponse;
import com.lexorion.core.user.service.UserService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.util.Comparator;
import java.util.Set;
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
   private final PlatformAccessService platformAccessService;
   private final Validator validator;

   public InitialPlatformAdminBootstrap(BootstrapProperties properties, PlatformAccessRepository platformAccessRepository, UserService userService, PlatformAccessService platformAccessService, Validator validator) {
      this.properties = properties;
      this.platformAccessRepository = platformAccessRepository;
      this.userService = userService;
      this.platformAccessService = platformAccessService;
      this.validator = validator;
   }

   @Transactional
   public void run(ApplicationArguments args) {
      if (this.properties.isEnabled()) {
         CreateUserRequest request = this.validatedRequest();
         if (!this.platformAccessRepository.existsByRole(PlatformRole.SUPER_ADMIN)) {
            UserResponse user = this.userService.create(request);
            this.platformAccessService.grant(new CreatePlatformAccessRequest(user.id(), PlatformRole.SUPER_ADMIN));
         }
      }
   }

   private CreateUserRequest validatedRequest() {
      CreateUserRequest request = new CreateUserRequest(UserService.normalizeEmail(this.properties.getEmail()), "Platform", "Administrator", this.properties.getPassword());
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
