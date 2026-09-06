package com.lexorion.platform.migration;
import static org.assertj.core.api.Assertions.assertThat;
import org.flywaydb.core.Flyway;import org.junit.jupiter.api.Test;import org.testcontainers.containers.PostgreSQLContainer;import org.testcontainers.junit.jupiter.Container;import org.testcontainers.junit.jupiter.Testcontainers;
@Testcontainers(disabledWithoutDocker=true)
class PostgresMigrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>("postgres:16-alpine");
    @Test void migrationsPreserveLegacyPlansAndAllowCrossProductPlans() throws Exception {
        var config = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()).locations("classpath:db/migration");
        assertThat(config.target("3").load().migrate().migrationsExecuted).isEqualTo(3);
        try (var connection = java.sql.DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword()); var sql = connection.createStatement()) {
            sql.execute("INSERT INTO products(id,created_at,updated_at,display_name,product_key,status) VALUES ('00000000-0000-0000-0000-000000000001',now(),now(),'Workforce','workforce','ACTIVE')");
            sql.execute("INSERT INTO plans(id,created_at,updated_at,display_name,plan_key,status,product_id) VALUES ('00000000-0000-0000-0000-000000000002',now(),now(),'Workforce Starter','workforce-starter','ACTIVE','00000000-0000-0000-0000-000000000001')");
            sql.execute("INSERT INTO organizations(id,created_at,updated_at,name,organization_code,primary_email,slug,status) VALUES ('00000000-0000-0000-0000-000000000004',now(),now(),'Legacy','LEGACY','legacy@example.test','legacy','ACTIVE')");
            sql.execute("INSERT INTO organization_workspaces(id,created_at,updated_at,display_name,workspace_key,status,organization_id,product_id) VALUES ('00000000-0000-0000-0000-000000000005',now(),now(),'Legacy','legacy','ACTIVE','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001')");
            assertThat(config.target("latest").load().migrate().migrationsExecuted).isEqualTo(3);
            try (var result = sql.executeQuery("SELECT w.organization_id, p.product_id FROM organization_workspaces w JOIN workspace_products p ON p.workspace_id=w.id WHERE w.id='00000000-0000-0000-0000-000000000005'")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("00000000-0000-0000-0000-000000000004");
                assertThat(result.getString(2)).isEqualTo("00000000-0000-0000-0000-000000000001");
                assertThat(result.next()).isFalse();
            }
            try (var result = sql.executeQuery("SELECT product_key, status FROM core_product_access WHERE organization_id='00000000-0000-0000-0000-000000000004'")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(1)).isEqualTo("horizon");
                assertThat(result.getString(2)).isEqualTo("ACTIVE");
                assertThat(result.next()).isFalse();
            }
            try (var result = sql.executeQuery("SELECT product_id FROM plans WHERE plan_key='workforce-starter'")) {
                assertThat(result.next()).isTrue(); assertThat(result.getString(1)).isEqualTo("00000000-0000-0000-0000-000000000001");
            }
            sql.execute("INSERT INTO plans(id,created_at,updated_at,display_name,plan_key,status) VALUES ('00000000-0000-0000-0000-000000000003',now(),now(),'Starter','starter','ACTIVE')");
        }
    }
}
