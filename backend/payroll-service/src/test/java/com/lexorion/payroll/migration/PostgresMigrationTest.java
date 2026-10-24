package com.lexorion.payroll.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import java.sql.DriverManager;
import java.sql.SQLException;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SuppressWarnings("deprecation")
@Testcontainers(disabledWithoutDocker = true)
class PostgresMigrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Test void migrationPreservesWorkspacesAndAllowsTenantLocalKeys() throws Exception {
        var before = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                .locations("classpath:db/migration").target("5").load().migrate();
        assertThat(before.migrationsExecuted).isEqualTo(5);
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO payroll_workspaces (id, created_at, updated_at, workspace_key) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW(), NOW(), 'main')");
            String second = "INSERT INTO payroll_workspaces (id, created_at, updated_at, workspace_key) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW(), NOW(), 'main')";
            assertThatThrownBy(() -> statement.executeUpdate(second)).isInstanceOf(SQLException.class);
            statement.executeUpdate("INSERT INTO payroll_employees(id,workspace_id,employee_code,payroll_status,currency,pay_frequency,effective_from,created_at,updated_at) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','LEGACY','ACTIVE','USD','MONTHLY','2026-01-01',NOW(),NOW())");
            statement.executeUpdate("INSERT INTO compensation_profiles(id,payroll_employee_id,profile_key,currency,effective_from,profile_status,created_at,updated_at) VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd','cccccccc-cccc-cccc-cccc-cccccccccccc','LEGACY','USD','2026-01-01','ACTIVE',NOW(),NOW())");
            var after = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                    .locations("classpath:db/migration").load().migrate();
            assertThat(after.migrationsExecuted).isEqualTo(3);
            try (var rows = statement.executeQuery("SELECT column_name FROM information_schema.columns WHERE table_name='payroll_pay_runs' AND column_name IN ('processing_attempt','processing_started_at','failure_message')")) {
                int count=0; while(rows.next()) count++; assertThat(count).isEqualTo(3);
            }
            try (var rows = statement.executeQuery("SELECT pay_frequency FROM compensation_profiles WHERE profile_key='LEGACY'")) {
                assertThat(rows.next()).isTrue(); assertThat(rows.getString(1)).isEqualTo("MONTHLY");
            }
            assertThat(statement.executeUpdate(second)).isEqualTo(1);
            try (var rows = statement.executeQuery("SELECT count(*) FROM payroll_workspaces WHERE workspace_key = 'main'")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getInt(1)).isEqualTo(2);
            }
        }
    }
}
