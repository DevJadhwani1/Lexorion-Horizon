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
            sql.execute("INSERT INTO plans(id,created_at,updated_at,display_name,plan_key,status,product_id) VALUES ('00000000-0000-0000-0000-000000000002',now(),now(),'Workforce Starter','starter','ACTIVE','00000000-0000-0000-0000-000000000001')");
            sql.execute("INSERT INTO organizations(id,created_at,updated_at,name,organization_code,primary_email,slug,status) VALUES ('00000000-0000-0000-0000-000000000004',now(),now(),'Legacy','LEGACY','legacy@example.test','legacy','ACTIVE')");
            sql.execute("INSERT INTO organization_workspaces(id,created_at,updated_at,display_name,workspace_key,status,organization_id,product_id) VALUES ('00000000-0000-0000-0000-000000000005',now(),now(),'Legacy','legacy','ACTIVE','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001')");
            sql.execute("INSERT INTO users(id,created_at,updated_at,email,first_name,last_name,password_hash,status) VALUES ('00000000-0000-0000-0000-000000000006',now(),now(),'legacy-user@example.test','Legacy','User','unchanged-hash','ACTIVE')");
            sql.execute("INSERT INTO organization_memberships(id,created_at,updated_at,organization_id,user_id,role,status,joined_at) VALUES ('00000000-0000-0000-0000-000000000007',now(),now(),'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006','MANAGER','ACTIVE',now())");
            sql.execute("INSERT INTO organization_plan_assignments(id,created_at,updated_at,organization_id,plan_id,product_id,status) VALUES ('00000000-0000-0000-0000-000000000011',now(),now(),'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','ACTIVE')");
            assertThat(config.target("latest").load().migrate().migrationsExecuted).isEqualTo(5);
            try (var result = sql.executeQuery("SELECT m.user_id, m.status, r.role FROM organization_memberships m JOIN horizon_membership_roles r ON r.membership_id=m.id WHERE m.id='00000000-0000-0000-0000-000000000007'")) {
                assertThat(result.next()).isTrue(); assertThat(result.getString(1)).isEqualTo("00000000-0000-0000-0000-000000000006");
                assertThat(result.getString(2)).isEqualTo("ACTIVE"); assertThat(result.getString(3)).isEqualTo("MANAGER");
                assertThat(result.next()).isFalse();
            }
            // New Core associations need no Horizon role or extension row.
            sql.execute("INSERT INTO users(id,created_at,updated_at,email,first_name,last_name,password_hash,status) VALUES ('00000000-0000-0000-0000-000000000008',now(),now(),'core-user@example.test','Core','User','hash','ACTIVE')");
            sql.execute("INSERT INTO organization_memberships(id,created_at,updated_at,organization_id,user_id,status,joined_at) VALUES ('00000000-0000-0000-0000-000000000009',now(),now(),'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000008','ACTIVE',now())");
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
            try (var result = sql.executeQuery("SELECT plan_key, product_id FROM plans WHERE id='00000000-0000-0000-0000-000000000002'")) {
                assertThat(result.next()).isTrue(); assertThat(result.getString(1)).startsWith("legacy-starter-");
                assertThat(result.getString(2)).isEqualTo("00000000-0000-0000-0000-000000000001");
            }
            try (var result = sql.executeQuery("SELECT plan_id, status FROM organization_plan_assignments WHERE organization_id='00000000-0000-0000-0000-000000000004'")) {
                assertThat(result.next()).isTrue();
                assertThat(result.getString(2)).isEqualTo("ACTIVE");
                String planId = result.getString(1);
                assertThat(result.next()).isFalse();
                try (var check = connection.createStatement(); var plan = check.executeQuery("SELECT plan_key, product_id FROM plans WHERE id='" + planId + "'")) {
                    assertThat(plan.next()).isTrue(); assertThat(plan.getString(1)).isEqualTo("starter"); assertThat(plan.getString(2)).isNull();
                }
            }
            try (var result = sql.executeQuery("SELECT plan_id, product_id FROM organization_product_plan_assignments_legacy WHERE organization_id='00000000-0000-0000-0000-000000000004'")) {
                assertThat(result.next()).isTrue(); assertThat(result.getString(1)).isEqualTo("00000000-0000-0000-0000-000000000002");
                assertThat(result.getString(2)).isEqualTo("00000000-0000-0000-0000-000000000001"); assertThat(result.next()).isFalse();
            }
        }
    }
}
