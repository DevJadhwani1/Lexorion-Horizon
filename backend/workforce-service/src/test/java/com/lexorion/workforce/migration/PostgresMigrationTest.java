package com.lexorion.workforce.migration;

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
                .locations("classpath:db/migration").target("1").load().migrate();
        assertThat(before.migrationsExecuted).isEqualTo(1);
        try (var connection = DriverManager.getConnection(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
             var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO workforce_workspaces (id, created_at, updated_at, workspace_key) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NOW(), NOW(), 'main')");
            String second = "INSERT INTO workforce_workspaces (id, created_at, updated_at, workspace_key) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW(), NOW(), 'main')";
            assertThatThrownBy(() -> statement.executeUpdate(second)).isInstanceOf(SQLException.class);
            var after = Flyway.configure().dataSource(POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword())
                    .locations("classpath:db/migration").load().migrate();
            assertThat(after.migrationsExecuted).isEqualTo(4);
            assertThat(statement.executeUpdate(second)).isEqualTo(1);
            try (var rows = statement.executeQuery("SELECT count(*) FROM workforce_workspaces WHERE workspace_key = 'main'")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getInt(1)).isEqualTo(2);
            }
        }
    }
}
