package com.lexorion.finance.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@Configuration
@EnableJpaAuditing
public class JpaConfig {
    /** Business dates (due dates, overdue checks, "this month") are evaluated against this clock. */
    @Bean
    Clock financeClock() {
        return Clock.systemDefaultZone();
    }
}
