package com.lexorion.core.api;

import com.lexorion.core.audit.*;
import com.lexorion.core.auth.repository.RefreshTokenRepository;
import com.lexorion.core.auth.service.AuthenticationService;
import com.lexorion.core.organization.*;
import com.lexorion.core.organization.entity.*;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.organization.service.CoreOrganizationService;
import com.lexorion.core.platformaccess.dto.*;
import com.lexorion.core.platformaccess.service.PlatformAccessService;
import com.lexorion.core.product.*;
import com.lexorion.core.security.SecurityProperties;
import com.lexorion.core.user.dto.*;
import com.lexorion.core.user.service.UserService;
import com.lexorion.core.user.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.security.Principal;
import java.time.Clock;
import java.time.Instant;
import java.util.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/core")
@PreAuthorize("@coreAuthorization.isOperator(authentication)")
@Transactional(readOnly = true)
public class CoreAdministrationController {
    private final OrganizationRepository organizations;
    private final CoreOrganizationService organizationService;
    private final CoreMembershipRepository memberships;
    private final UserRepository users;
    private final UserService userService;
    private final CoreProductRepository products;
    private final ProductAccessRepository grants;
    private final PlatformAccessService operators;
    private final RefreshTokenRepository tokens;
    private final AuthenticationService authentication;
    private final AuditEventRepository events;
    private final AuditRecorder audit;
    private final SecurityProperties security;
    private final Clock clock;
    public CoreAdministrationController(OrganizationRepository organizations, CoreOrganizationService organizationService,
            CoreMembershipRepository memberships, UserRepository users, UserService userService, CoreProductRepository products,
            ProductAccessRepository grants, PlatformAccessService operators, RefreshTokenRepository tokens,
            AuthenticationService authentication, AuditEventRepository events, AuditRecorder audit, SecurityProperties security, Clock clock) {
        this.organizations = organizations; this.organizationService = organizationService; this.memberships = memberships;
        this.users = users; this.userService = userService; this.products = products; this.grants = grants;
        this.operators = operators; this.tokens = tokens; this.authentication = authentication; this.events = events;
        this.audit = audit; this.security = security; this.clock = clock;
    }
    @GetMapping("/overview") public Map<String, Long> overview() {
        return Map.of("organizations", organizations.count(), "users", users.count(), "products", products.count(), "productGrants", grants.count());
    }
    @GetMapping("/organizations") public List<OrganizationView> organizations() {
        return organizations.findAll(Sort.by("name")).stream().map(OrganizationView::from).toList();
    }
    @PostMapping("/organizations") @Transactional
    public OrganizationView createOrganization(Principal actor, @RequestBody @Valid CoreOrganizationService.CreateOrganization request) {
        var org = organizationService.create(request); record(actor, "ORGANIZATION_CREATE", "ORGANIZATION", org.getId()); return OrganizationView.from(org);
    }
    @PatchMapping("/organizations/{id}/status") @Transactional
    public OrganizationView lifecycle(Principal actor, @PathVariable UUID id, @RequestBody @Valid LifecycleRequest request) {
        var org = organizationService.transition(id, request.status()); record(actor, "ORGANIZATION_LIFECYCLE", "ORGANIZATION", id); return OrganizationView.from(org);
    }
    @GetMapping("/organizations/{id}/memberships") public List<MembershipView> memberships(@PathVariable UUID id) {
        return memberships.findByOrganizationId(id).stream().map(MembershipView::from).toList();
    }
    @PutMapping("/organizations/{id}/memberships/{userId}") @Transactional
    public MembershipView associate(Principal actor, @PathVariable UUID id, @PathVariable UUID userId, @RequestBody @Valid MembershipRequest request) {
        var membership = organizationService.associate(id, userId, request.status()); record(actor, "MEMBERSHIP_UPDATE", "MEMBERSHIP", membership.getId()); return MembershipView.from(membership);
    }
    @GetMapping("/users") public List<UserResponse> users() { return userService.list(); }
    @PostMapping("/users") @Transactional public UserResponse createUser(Principal actor, @RequestBody @Valid CreateUserRequest request) {
        var user = userService.create(request); record(actor, "USER_CREATE", "USER", user.id()); return user;
    }
    @PatchMapping("/users/{id}") @Transactional public UserResponse updateUser(Principal actor, @PathVariable UUID id, @RequestBody @Valid UpdateUserRequest request) {
        var user = userService.update(id, request); record(actor, "USER_UPDATE", "USER", id); return user;
    }
    @PostMapping("/products") @Transactional public CoreController.ProductSummary register(Principal actor, @RequestBody @Valid ProductRequest request) {
        if (products.existsById(request.key())) throw new com.lexorion.core.exception.DuplicateResourceException("Product key is already registered");
        var product = products.saveAndFlush(new CoreProduct(request.key(), request.displayName(), request.active()));
        record(actor, "PRODUCT_REGISTER", "PRODUCT", product.getId()); return productView(product);
    }
    @PatchMapping("/products/{key}") @Transactional public CoreController.ProductSummary updateProduct(Principal actor, @PathVariable String key, @RequestBody @Valid ProductUpdate request) {
        var product = products.findById(key).orElseThrow(() -> new com.lexorion.core.exception.ResourceNotFoundException("Product not found"));
        product.configure(request.displayName(), request.active()); products.saveAndFlush(product);
        record(actor, "PRODUCT_UPDATE", "PRODUCT", product.getId()); return productView(product);
    }
    @GetMapping("/product-access") public List<GrantView> grants() { return grants.findAll().stream().map(GrantView::from).toList(); }
    @GetMapping("/operators") public List<PlatformAccessResponse> operators() { return operators.list(); }
    @PostMapping("/operators") @Transactional public PlatformAccessResponse grantOperator(Principal actor, @RequestBody @Valid CreatePlatformAccessRequest request) {
        var result = operators.grant(request); record(actor, "OPERATOR_GRANT", "USER", request.userId()); return result;
    }
    @PatchMapping("/operators/{userId}/status") @Transactional public PlatformAccessResponse operatorStatus(Principal actor, @PathVariable UUID userId, @RequestBody @Valid UpdatePlatformAccessStatusRequest request) {
        var result = operators.updateStatus(userId, request); record(actor, "OPERATOR_STATUS", "USER", userId); return result;
    }
    @GetMapping("/sessions") public List<SessionView> sessions() {
        // Return session metadata only. Never serialize refresh token hashes or family secrets.
        var sessions = new LinkedHashMap<UUID, SessionView>();
        for (var token : tokens.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))) {
            var current = new SessionView(token.getSessionId(), token.getUser().getId(), token.getUser().getEmail(), token.getCreatedAt(), token.getExpiresAt(), !token.isRevoked() && token.getExpiresAt().isAfter(clock.instant()));
            sessions.merge(token.getSessionId(), current, (a, c) -> c.active() && !a.active() ? c : a);
        }
        return List.copyOf(sessions.values());
    }
    @PostMapping("/users/{userId}/sessions/revoke") @Transactional @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void revokeSessions(Principal actor, @PathVariable UUID userId) { authentication.revokeAll(userId); record(actor, "OPERATOR_SESSIONS_REVOKE", "USER", userId); }
    @GetMapping("/security") public Map<String, Object> security() {
        return Map.of("issuer", security.jwt().issuer(), "accessTokenTtl", security.jwt().accessTokenTtl().toString(),
                "refreshTokenTtl", security.refreshTokenTtl().toString(), "refreshTokenRotation", true,
                "refreshTokenReuseDetection", true, "accessTokenAlgorithm", "HS256");
    }
    @GetMapping("/audit") public List<AuditView> audit(@RequestParam(defaultValue = "0") int page) {
        if (page < 0) throw new IllegalArgumentException("Page must be non-negative");
        return events.findAll(PageRequest.of(page, 100, Sort.by(Sort.Direction.DESC, "occurredAt"))).stream()
                .map(e -> new AuditView(e.getId(), e.getOccurredAt(), e.getActorUserId(), e.getOperation(), e.getResourceType(), e.getResourceId(), e.getResult(), e.getCorrelationId())).toList();
    }
    private void record(Principal actor, String operation, String type, UUID id) { audit.record(UUID.fromString(actor.getName()), operation, type, id.toString(), "SUCCESS"); }
    private CoreController.ProductSummary productView(CoreProduct p) { return new CoreController.ProductSummary(p.getId(), p.getKey(), p.getDisplayName(), p.isActive()); }
    public record OrganizationView(UUID id, String name, String organizationCode, String slug, String primaryEmail, OrganizationStatus status) {
        static OrganizationView from(Organization o) { return new OrganizationView(o.getId(), o.getName(), o.getOrganizationCode(), o.getSlug(), o.getPrimaryEmail(), o.getStatus()); }
    }
    public record MembershipView(UUID id, UUID userId, UUID organizationId, String status) {
        static MembershipView from(CoreOrganizationMembership m) { return new MembershipView(m.getId(), m.getUserId(), m.getOrganizationId(), m.getStatus()); }
    }
    public record LifecycleRequest(@NotNull OrganizationStatus status) {}
    public record MembershipRequest(@NotNull @Pattern(regexp = "ACTIVE|INACTIVE|SUSPENDED") String status) {}
    public record ProductRequest(@NotBlank @Pattern(regexp = "[a-z0-9][a-z0-9-]{0,62}") String key, @NotBlank @Size(max = 150) String displayName, boolean active) {}
    public record ProductUpdate(@NotBlank @Size(max = 150) String displayName, boolean active) {}
    public record GrantView(UUID id, UUID organizationId, String productKey, ProductAccessGrant.Status status, Instant validFrom, Instant validUntil) {
        static GrantView from(ProductAccessGrant g) { return new GrantView(g.getId(), g.getOrganizationId(), g.getProductKey(), g.getStatus(), g.getValidFrom(), g.getValidUntil()); }
    }
    public record SessionView(UUID sessionId, UUID userId, String email, Instant createdAt, Instant expiresAt, boolean active) {}
    public record AuditView(UUID id, Instant occurredAt, UUID actorUserId, String operation, String resourceType, String resourceId, String result, String correlationId) {}
}
