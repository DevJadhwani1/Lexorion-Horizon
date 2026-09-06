package com.lexorion.core.security;
import java.time.Clock;
import java.util.HashMap;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
@Configuration
@EnableConfigurationProperties(SecurityProperties.class)
public class CoreSecurityConfiguration {
   @Bean
   Clock clock() {
      return Clock.systemUTC();
   }

   @Bean
   PasswordEncoder passwordEncoder() {
      Map<String, PasswordEncoder> encoders = new HashMap();
      encoders.put("bcrypt", new BCryptPasswordEncoder());
      DelegatingPasswordEncoder encoder = new DelegatingPasswordEncoder("bcrypt", encoders);
      encoder.setDefaultPasswordEncoderForMatches(new LegacyPbkdf2PasswordEncoder());
      return encoder;
   }

}
