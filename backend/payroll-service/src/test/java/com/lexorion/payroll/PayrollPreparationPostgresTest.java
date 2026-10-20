package com.lexorion.payroll;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.lexorion.payroll.api.PayrollException;
import com.lexorion.payroll.domain.PayRunStatus;
import com.lexorion.payroll.service.PayrollWorkspaceScope;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;

/** Runs the existing pay-run and preparation flows against migrated PostgreSQL as well as H2. */
@SuppressWarnings("deprecation")
@Testcontainers(disabledWithoutDocker = true)
class PayrollPreparationPostgresTest extends PayrollPayRunIntegrationTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
        properties.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
        properties.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        properties.add("spring.flyway.enabled", () -> "true");
    }
    @MockitoSpyBean PayrollWorkspaceScope lockingScope;

    @Test void waitingProcessorSeesTheOtherRunsCommitAfterAcquiringWorkspaceLock() throws Exception {
        seedEmployeeProfile("a", "alpha", "EMP-1", "USD", "2026-01-01", null, "100");
        monthly("FIRST", "2026-01-01", "2026-01-31", "2026-01-31", "EMP-1");
        monthly("SECOND", "2026-01-01", "2026-01-31", "2026-01-31", "EMP-1");
        UUID first, second;
        contexts.set(context("a", "owner", "alpha"));
        try { first = transactions.begin("FIRST"); second = transactions.begin("SECOND"); }
        finally { contexts.clear(); }
        CountDownLatch firstLocked = new CountDownLatch(1), secondReachedLock = new CountDownLatch(1);
        AtomicInteger calls = new AtomicInteger();
        doAnswer(invocation -> {
            int position = calls.incrementAndGet();
            if (position == 2) {
                workspaces.findById(A); // Establish a snapshot before waiting, just as scope.locked does.
                secondReachedLock.countDown();
            }
            Object result = invocation.callRealMethod();
            if (position == 1) {
                firstLocked.countDown();
                if (!secondReachedLock.await(10, TimeUnit.SECONDS)) throw new AssertionError("Second processor did not reach the lock");
            }
            return result;
        }).when(lockingScope).locked();
        try {
            var one = CompletableFuture.supplyAsync(() -> complete("FIRST", first));
            assertThat(firstLocked.await(10, TimeUnit.SECONDS)).isTrue();
            var two = CompletableFuture.supplyAsync(() -> complete("SECOND", second));
            assertThat(one.get(20, TimeUnit.SECONDS)).isEqualTo("CALCULATED");
            assertThat(two.get(20, TimeUnit.SECONDS)).contains("already has a calculated or finalized pay run");
            assertThat(calculations.count()).isEqualTo(1);
            assertThat(runs.findByWorkspaceIdAndPayRunKey(A, "SECOND").orElseThrow().getStatus()).isEqualTo(PayRunStatus.PROCESSING);
            assertThat(ledger.count()).isZero();
        } finally { reset(lockingScope); }
    }
    private String complete(String key, UUID attempt) {
        contexts.set(context("a", "owner", "alpha"));
        try { return transactions.complete(key, attempt).getStatus().name(); }
        catch (PayrollException expected) { return expected.getMessage(); }
        finally { contexts.clear(); }
    }
}
