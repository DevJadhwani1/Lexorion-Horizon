package com.lexorion.payroll.migration;
import static org.assertj.core.api.Assertions.assertThat;
import org.flywaydb.core.Flyway;import org.junit.jupiter.api.Test;import org.testcontainers.containers.PostgreSQLContainer;import org.testcontainers.junit.jupiter.Container;import org.testcontainers.junit.jupiter.Testcontainers;
@Testcontainers(disabledWithoutDocker=true) class PostgresMigrationTest{@Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>("postgres:16-alpine");@Test void migrationsBuildThePayrollSchemaOnPostgres(){var result=Flyway.configure().dataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()).locations("classpath:db/migration").load().migrate();assertThat(result.migrationsExecuted).isEqualTo(5);}}
