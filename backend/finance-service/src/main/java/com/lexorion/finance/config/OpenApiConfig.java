package com.lexorion.finance.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {
    @Bean
    OpenAPI financeOpenApi() {
        return new OpenAPI()
                .info(new Info().title("Lexorion Finance API").version("1").description(
                        "Finance billing workspace: billing clients, invoices and received payments. ADMIN users manage "
                        + "workspace-scoped billing data. Invoices follow DRAFT to ISSUED to PARTIALLY_PAID to PAID; DRAFT "
                        + "invoices are editable and ISSUED invoices without payments can be voided. Invoice and receipt "
                        + "numbers are sequential per workspace and never reused. Payments are immutable and cannot exceed "
                        + "the balance due. Internal UUIDs are never public. No payment gateway, tax filing, ledger posting "
                        + "or e-invoicing is implemented."))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
