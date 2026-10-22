package com.lexorion.core.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AxonEventPublisherTest {
    private static final String KEY = "axon_ik_testprefix_testsecretvalue";
    private HttpServer server;

    @AfterEach void stop() {
        if (server != null) server.stop(0);
    }

    @Test void loginEventFollowsTheAxonContractAndCarriesNoSecrets() {
        UUID id = UUID.randomUUID(), user = UUID.randomUUID();
        Instant at = Instant.parse("2026-10-21T06:30:00Z");
        Map<String, Object> failure = AxonEventPublisher.loginEvent(id, at, false, "someone@example.test", null, "corr-1");
        assertThat(failure).containsEntry("event_id", id.toString()).containsEntry("schema_version", "1.0")
                .containsEntry("event_type", "user_login_failure").containsEntry("timestamp", "2026-10-21T06:30:00Z")
                .containsEntry("actor", Map.of("username", "someone@example.test"));
        assertThat(failure.toString().toLowerCase()).doesNotContain("password", "token", "secret");
        Map<String, Object> success = AxonEventPublisher.loginEvent(id, at, true, "a@example.test", user, null);
        assertThat(success).containsEntry("event_type", "user_login_success")
                .containsEntry("actor", Map.of("username", "a@example.test", "id", user.toString()));
    }

    @Test void disabledUnlessEnabledAndFullyConfigured() {
        assertThat(publisher(false, "http://127.0.0.1:1", KEY).isEnabled()).isFalse();
        assertThat(publisher(true, "", KEY).isEnabled()).isFalse();
        assertThat(publisher(true, "http://127.0.0.1:1", "").isEnabled()).isFalse();
        publisher(false, "http://127.0.0.1:1", KEY).publishLogin(UUID.randomUUID(), Instant.now(), false, "x@example.test", null);
    }

    @Test void deliversToTheIngestionEndpointWithTheBearerKey() throws Exception {
        BlockingQueue<String[]> received = new ArrayBlockingQueue<>(1);
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            received.offer(new String[]{exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
                    exchange.getRequestHeaders().getFirst("Authorization"), exchange.getRequestHeaders().getFirst("Content-Type"), body,
                    exchange.getRequestHeaders().getFirst("Content-Length"), exchange.getRequestHeaders().getFirst("Transfer-Encoding")});
            exchange.sendResponseHeaders(201, -1);
            exchange.close();
        });
        server.start();
        UUID id = UUID.randomUUID();
        AxonEventPublisher axon = publisher(true, "http://127.0.0.1:" + server.getAddress().getPort(), KEY);
        axon.publishLogin(id, Instant.now(), false, "attacker-target@example.test", null);
        String[] request = received.poll(5, TimeUnit.SECONDS);
        axon.destroy();
        assertThat(request).isNotNull();
        assertThat(request[0]).isEqualTo("POST");
        assertThat(request[1]).isEqualTo("/api/v1/events/");
        assertThat(request[2]).isEqualTo("Bearer " + KEY);
        assertThat(request[3]).startsWith("application/json");
        assertThat(request[4]).contains("\"event_id\":\"" + id + "\"", "\"event_type\":\"user_login_failure\"",
                "\"schema_version\":\"1.0\"").doesNotContain("password");
        // AXON (Django/Gunicorn) drops chunked bodies: the request must carry an exact Content-Length.
        assertThat(request[5]).isEqualTo(String.valueOf(request[4].getBytes(StandardCharsets.UTF_8).length));
        assertThat(request[6]).isNull();
    }

    @Test void unreachableAxonNeverBlocksOrThrows() throws Exception {
        int closedPort;
        try (ServerSocket socket = new ServerSocket(0)) {
            closedPort = socket.getLocalPort();
        }
        AxonEventPublisher axon = publisher(true, "http://127.0.0.1:" + closedPort, KEY);
        long started = System.nanoTime();
        for (int i = 0; i < 5; i++) axon.publishLogin(UUID.randomUUID(), Instant.now(), false, "x@example.test", null);
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofMillis(500));
        axon.destroy();
    }

    @Test void slowAxonIsBoundedAndExcessEventsAreDropped() throws Exception {
        AtomicInteger hits = new AtomicInteger();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            hits.incrementAndGet();
            try { Thread.sleep(2_000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
            exchange.close();
        });
        server.setExecutor(java.util.concurrent.Executors.newCachedThreadPool());
        server.start();
        AxonEventPublisher axon = new AxonEventPublisher(true, "http://127.0.0.1:" + server.getAddress().getPort(), KEY,
                Duration.ofMillis(200), Duration.ofMillis(300), 2);
        long started = System.nanoTime();
        for (int i = 0; i < 20; i++) axon.publishLogin(UUID.randomUUID(), Instant.now(), false, "x@example.test", null);
        assertThat(Duration.ofNanos(System.nanoTime() - started)).isLessThan(Duration.ofMillis(500));
        Thread.sleep(1_500);
        axon.destroy();
        // one in flight + queue of 2: everything else was dropped, not queued without bound
        assertThat(hits.get()).isBetween(1, 3);
    }

    private static AxonEventPublisher publisher(boolean enabled, String baseUrl, String key) {
        return new AxonEventPublisher(enabled, baseUrl, key, Duration.ofMillis(500), Duration.ofSeconds(1), 10);
    }
}
