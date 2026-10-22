package com.lexorion.core.integration;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/**
 * Sends authentication outcomes to an AXON runtime security monitor (POST /api/v1/events/, event contract
 * schema 1.0) with an environment-scoped ingestion key.
 *
 * Off unless lexorion.axon.enabled=true and both the base URL and the key are set. Delivery is
 * fire-and-forget on one daemon thread with a bounded queue: a slow, failing or unreachable AXON never
 * delays or fails a login. There are no retries; when the queue is full the event is dropped and logged.
 * Only the event id, correlation id and HTTP status are logged — never the key or the payload.
 * Payloads never contain passwords or tokens.
 */
@Component
public class AxonEventPublisher implements DisposableBean {
    private static final Logger log = LoggerFactory.getLogger(AxonEventPublisher.class);
    static final String EVENTS_PATH = "/api/v1/events/";

    private final boolean enabled;
    private final RestClient client;
    private final ThreadPoolExecutor executor;

    public AxonEventPublisher(@Value("${lexorion.axon.enabled:false}") boolean enabled,
                              @Value("${lexorion.axon.base-url:}") String baseUrl,
                              @Value("${lexorion.axon.ingestion-key:}") String ingestionKey,
                              @Value("${lexorion.axon.connect-timeout:2s}") Duration connectTimeout,
                              @Value("${lexorion.axon.read-timeout:3s}") Duration readTimeout,
                              @Value("${lexorion.axon.queue-capacity:100}") int queueCapacity) {
        boolean configured = !isBlank(baseUrl) && !isBlank(ingestionKey);
        if (enabled && !configured) log.warn("AXON event publishing requested but base URL or ingestion key is missing; publishing disabled");
        this.enabled = enabled && configured;
        if (!this.enabled) {
            this.client = null;
            this.executor = null;
            return;
        }
        SimpleClientHttpRequestFactory requests = new SimpleClientHttpRequestFactory();
        requests.setConnectTimeout(connectTimeout);
        requests.setReadTimeout(readTimeout);
        // Buffered so the request carries Content-Length: AXON (Django under Gunicorn) reads a chunked
        // request body as empty and rejects the event.
        this.client = RestClient.builder().baseUrl(baseUrl.strip()).requestFactory(new BufferingClientHttpRequestFactory(requests))
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + ingestionKey.strip()).build();
        this.executor = new ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(Math.max(1, queueCapacity)), task -> {
            Thread thread = new Thread(task, "axon-event-publisher");
            thread.setDaemon(true);
            return thread;
        });
        log.info("AXON event publishing enabled (target {})", baseUrl.strip());
    }

    public boolean isEnabled() {
        return enabled;
    }

    /** Publish one login outcome. `auditEventId` is the Horizon audit event id and becomes AXON's event_id. */
    public void publishLogin(UUID auditEventId, Instant occurredAt, boolean success, String username, UUID userId) {
        if (!enabled || auditEventId == null) return;
        String correlationId = MDC.get("correlationId");
        Map<String, Object> payload = loginEvent(auditEventId, occurredAt, success, username, userId, correlationId);
        try {
            executor.execute(() -> send(auditEventId, correlationId, payload));
        } catch (RejectedExecutionException e) {
            log.warn("AXON event dropped (queue full) event_id={} correlation_id={}", auditEventId, correlationId);
        }
    }

    static Map<String, Object> loginEvent(UUID auditEventId, Instant occurredAt, boolean success, String username, UUID userId,
                                          String correlationId) {
        Map<String, Object> actor = new LinkedHashMap<>();
        if (!isBlank(username)) actor.put("username", username);
        if (userId != null) actor.put("id", userId.toString());
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("audit_operation", "AUTH_LOGIN");
        if (correlationId != null) metadata.put("correlation_id", correlationId);
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("event_id", auditEventId.toString());
        event.put("schema_version", "1.0");
        event.put("event_type", success ? "user_login_success" : "user_login_failure");
        event.put("timestamp", (occurredAt == null ? Instant.now() : occurredAt).toString());
        event.put("source", Map.of("service", "platform-service"));
        if (!actor.isEmpty()) event.put("actor", actor);
        event.put("outcome", Map.of("status", success ? "success" : "failure", "success", success));
        event.put("security", Map.of("category", "authentication"));
        event.put("metadata", metadata);
        return event;
    }

    private void send(UUID eventId, String correlationId, Map<String, Object> payload) {
        try {
            var response = client.post().uri(EVENTS_PATH).contentType(MediaType.APPLICATION_JSON).body(payload)
                    .retrieve().toBodilessEntity();
            log.info("AXON event delivered event_id={} correlation_id={} status={}", eventId, correlationId,
                    response.getStatusCode().value());
        } catch (RestClientResponseException e) {
            log.warn("AXON event rejected event_id={} correlation_id={} status={}", eventId, correlationId, e.getStatusCode().value());
        } catch (Exception e) {
            log.warn("AXON event not delivered event_id={} correlation_id={} reason={}", eventId, correlationId,
                    e.getClass().getSimpleName());
        }
    }

    @Override
    public void destroy() {
        if (executor != null) executor.shutdownNow();
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
