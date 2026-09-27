package com.lexorion.platform;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class CoreArchitectureTest {
    @Test void entryContextIsExactlyTheV1Contract() {
        assertThat(com.lexorion.core.product.ProductAccessService.AccessContext.class.getRecordComponents())
                .extracting(java.lang.reflect.RecordComponent::getName)
                .containsExactly("userId", "organizationId", "productId", "productKey", "validUntil");
    }

    @Test void coreDoesNotDependOnHorizonOrDeploymentAdapters() throws Exception {
        try (var paths = Files.walk(Path.of("src/main/java/com/lexorion/core"))) {
            var sources = paths.filter(p -> p.toString().endsWith(".java")).toList();
            assertThat(sources).isNotEmpty();
            for (var source : sources) {
                String code = Files.readString(source);
                assertThat(java.util.regex.Pattern.compile("com\\.lexorion\\.(?!core(?:\\.|\\b))[A-Za-z_]").matcher(code).find())
                        .as("Core must not reference any current or future product package: %s", source).isFalse();
                assertThat(code).as(source.toString())
                        .doesNotContain("com.lexorion.horizon", "com.lexorion.axon", "com.lexorion.atlas", "com.lexorion.platform", "OrganizationRole",
                                "workforce.employee_limit", "payroll.processing", "OrganizationWorkspace", "PlanEntitlement",
                                "\"horizon\"", "\"workforce\"", "\"payroll\"", "\"finance\"", "workspace_id", "horizon_membership_roles");
            }
        }
    }
}
