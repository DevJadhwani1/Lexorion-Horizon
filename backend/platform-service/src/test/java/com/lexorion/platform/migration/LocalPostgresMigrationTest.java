package com.lexorion.platform.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DriverManager;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/** Optional real-PostgreSQL migration verification for environments without Docker. */
class LocalPostgresMigrationTest {
    @Test
    @EnabledIfEnvironmentVariable(named = "HORIZON_MIGRATION_CLEAN_JDBC_URL", matches = ".+")
    void cleanDatabaseMigratesFromV1ThroughV8() {
        Flyway flyway = configuration("HORIZON_MIGRATION_CLEAN_JDBC_URL").load();
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(8);
        try (var connection = connect("HORIZON_MIGRATION_CLEAN_JDBC_URL"); var statement = connection.createStatement()) {
            assertThat(count(statement, "select count(*) from flyway_schema_history where success")).isEqualTo(8);
            assertThat(count(statement, "select count(*) from pg_constraint where conname = 'uk_org_plan_assignment'")).isEqualTo(1);
            assertThat(count(statement, "select count(*) from pg_constraint where conrelid='organization_plan_assignments'::regclass and contype <> 'n'")).isEqualTo(5);
            assertThat(count(statement, "select count(*) from plans where product_id is null and plan_key in ('starter','business')")).isEqualTo(2);
            assertThat(count(statement, "select count(*) from organization_plan_assignments")).isZero();
        } catch (Exception ex) { throw new IllegalStateException(ex); }
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "HORIZON_MIGRATION_UPGRADE_JDBC_URL", matches = ".+")
    void v7UpgradePreservesLegacyRowsAndCreatesOneEffectiveOrganizationPlan() throws Exception {
        var configuration = configuration("HORIZON_MIGRATION_UPGRADE_JDBC_URL");
        Flyway flyway = configuration.load();
        assertThat(configuration.target("3").load().migrate().migrationsExecuted).isEqualTo(3);
        try (var connection = connect("HORIZON_MIGRATION_UPGRADE_JDBC_URL"); var sql = connection.createStatement()) {
            sql.execute("INSERT INTO products(id,created_at,updated_at,display_name,product_key,status) VALUES ('00000000-0000-0000-0000-000000000001',now(),now(),'Workforce','workforce','ACTIVE')");
            sql.execute("INSERT INTO plans(id,created_at,updated_at,display_name,plan_key,status,product_id) VALUES ('00000000-0000-0000-0000-000000000002',now(),now(),'Workforce Starter','starter','ACTIVE','00000000-0000-0000-0000-000000000001')");
            sql.execute("INSERT INTO organizations(id,created_at,updated_at,name,organization_code,primary_email,slug,status) VALUES ('00000000-0000-0000-0000-000000000004',now(),now(),'Legacy','LEGACY','legacy@example.test','legacy','ACTIVE')");
            sql.execute("INSERT INTO organization_workspaces(id,created_at,updated_at,display_name,workspace_key,status,organization_id,product_id) VALUES ('00000000-0000-0000-0000-000000000005',now(),now(),'Legacy','legacy','ACTIVE','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001')");
            sql.execute("INSERT INTO users(id,created_at,updated_at,email,first_name,last_name,password_hash,status) VALUES ('00000000-0000-0000-0000-000000000006',now(),now(),'legacy-user@example.test','Legacy','User','unchanged-hash','ACTIVE')");
            sql.execute("INSERT INTO organization_memberships(id,created_at,updated_at,organization_id,user_id,role,status,joined_at) VALUES ('00000000-0000-0000-0000-000000000007',now(),now(),'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000006','MANAGER','ACTIVE',now())");
            sql.execute("INSERT INTO entitlement_definitions(id,created_at,updated_at,display_name,entitlement_key,status,value_type) VALUES ('00000000-0000-0000-0000-000000000012',now(),now(),'Employee limit','workforce.employee_limit','ACTIVE','INTEGER')");
            sql.execute("INSERT INTO plan_entitlements(id,created_at,updated_at,integer_value,entitlement_definition_id,plan_id) VALUES ('00000000-0000-0000-0000-000000000013',now(),now(),25,'00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000002')");
            sql.execute("INSERT INTO organization_plan_assignments(id,created_at,updated_at,organization_id,plan_id,product_id,status) VALUES ('00000000-0000-0000-0000-000000000011',now(),now(),'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','ACTIVE')");
            assertThat(count(sql, "select count(*) from organizations")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from organization_memberships")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from plans")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from plan_entitlements")).isEqualTo(1);
        }
        assertThat(flyway.migrate().migrationsExecuted).isEqualTo(5);
        try (var connection = connect("HORIZON_MIGRATION_UPGRADE_JDBC_URL"); var sql = connection.createStatement()) {
            assertThat(count(sql, "select count(*) from organization_product_plan_assignments_legacy")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from organization_product_plan_assignments_legacy where id='00000000-0000-0000-0000-000000000011' and plan_id='00000000-0000-0000-0000-000000000002' and product_id='00000000-0000-0000-0000-000000000001' and status='ACTIVE'")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from plans where id='00000000-0000-0000-0000-000000000002' and plan_key like 'legacy-starter-%' and product_id='00000000-0000-0000-0000-000000000001'")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from organization_plan_assignments where organization_id='00000000-0000-0000-0000-000000000004' and status='ACTIVE'")).isEqualTo(1);
            assertThat(firstString(sql, "select p.plan_key from organization_plan_assignments a join plans p on p.id=a.plan_id where a.organization_id='00000000-0000-0000-0000-000000000004'")).isEqualTo("starter");
            assertThat(count(sql, "select count(*) from organizations")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from organization_memberships")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from plan_entitlements")).isEqualTo(1);
            assertThat(count(sql, "select count(*) from horizon_membership_roles where membership_id='00000000-0000-0000-0000-000000000007' and role='MANAGER'")).isEqualTo(1);
            try {
                sql.execute("insert into organization_plan_assignments(id,created_at,updated_at,organization_id,plan_id,status) values ('00000000-0000-0000-0000-000000000014',now(),now(),'00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','ACTIVE')");
                throw new AssertionError("V8 must reject a second organization plan assignment");
            } catch (java.sql.SQLException expected) {
                assertThat(expected.getSQLState()).isEqualTo("23505");
            }
        }
    }

    private static org.flywaydb.core.api.configuration.FluentConfiguration configuration(String variable) {
        return Flyway.configure().dataSource(System.getenv(variable), System.getenv().getOrDefault("HORIZON_MIGRATION_DB_USER", "postgres"),
                System.getenv().getOrDefault("HORIZON_MIGRATION_DB_PASSWORD", "")).locations("classpath:db/migration");
    }

    private static java.sql.Connection connect(String variable) throws Exception {
        return DriverManager.getConnection(System.getenv(variable), System.getenv().getOrDefault("HORIZON_MIGRATION_DB_USER", "postgres"),
                System.getenv().getOrDefault("HORIZON_MIGRATION_DB_PASSWORD", ""));
    }

    private static int count(java.sql.Statement statement, String query) throws Exception {
        try (var result = statement.executeQuery(query)) { result.next(); return result.getInt(1); }
    }

    private static String firstString(java.sql.Statement statement, String query) throws Exception {
        try (var result = statement.executeQuery(query)) { result.next(); return result.getString(1); }
    }
}
