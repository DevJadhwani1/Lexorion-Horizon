package com.lexorion.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.security.autoconfigure.UserDetailsServiceAutoConfiguration;

@SpringBootApplication(
   scanBasePackages = {"com.lexorion.core", "com.lexorion.horizon", "com.lexorion.platform"},
   exclude = {UserDetailsServiceAutoConfiguration.class}
)
@org.springframework.boot.persistence.autoconfigure.EntityScan({"com.lexorion.core", "com.lexorion.horizon", "com.lexorion.platform"})
@org.springframework.data.jpa.repository.config.EnableJpaRepositories({"com.lexorion.core", "com.lexorion.horizon", "com.lexorion.platform"})
public class PlatformServiceApplication {
   public static void main(String[] args) {
      SpringApplication.run(PlatformServiceApplication.class, args);
   }
}
