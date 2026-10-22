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
                        "Finance billing workspace: billing clients, invoice templates, invoices and received payments. ADMIN "
                        + "users manage workspace-scoped billing data. Each workspace designs its own invoice templates: "
                        + "branding, seller details, numbering pattern (for example OH/{FY}/{SEQ}), tax presentation (none, "
                        + "single tax or Indian GST split by place of supply), industry fields, payment details and terms. "
                        + "Invoices are addressed by a stable reference (REF-00001); the template's number is assigned when "
                        + "an invoice is issued, and the template and buyer details are frozen onto it so later edits never "
                        + "change an issued bill. Invoices follow DRAFT to ISSUED to PARTIALLY_PAID to PAID; DRAFT invoices "
                        + "are editable and ISSUED invoices without payments can be voided. Payments are immutable and cannot "
                        + "exceed the balance due. Internal UUIDs are never public. No payment gateway, tax filing, ledger "
                        + "posting or e-invoicing is implemented."))
                .components(new Components().addSecuritySchemes("bearer",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearer"));
    }
}
