package com.lexorion.core.organization.service;

import com.lexorion.core.organization.*;
import com.lexorion.core.organization.entity.*;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.exception.*;
import jakarta.validation.constraints.*;
import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CoreOrganizationService {
    private final OrganizationRepository organizations;
    private final UserRepository users;
    private final CoreMembershipRepository memberships;
    private final TenantSlugService slugs;
    private final Clock clock;
    private final OrganizationLifecycleService lifecycle;
    public CoreOrganizationService(OrganizationRepository organizations, UserRepository users, CoreMembershipRepository memberships,
            TenantSlugService slugs, Clock clock, OrganizationLifecycleService lifecycle) {
        this.organizations = organizations; this.users = users; this.memberships = memberships;
        this.slugs = slugs; this.clock = clock; this.lifecycle = lifecycle;
    }
    public Organization create(CreateOrganization request) {
        String slug = slugs.normalizeOrGenerate(request.slug(), request.name());
        if (organizations.existsByOrganizationCode(request.organizationCode()) || organizations.existsBySlug(slug))
            throw new DuplicateResourceException("Organization code or slug is already in use");
        if (request.initialUserId() != null && !users.existsById(request.initialUserId())) throw ResourceNotFoundException.of("User", request.initialUserId());
        var org = new Organization(); org.setName(request.name()); org.setOrganizationCode(request.organizationCode());
        org.setSlug(slug); org.setPrimaryEmail(request.primaryEmail()); org.setStatus(OrganizationStatus.PENDING);
        organizations.saveAndFlush(org);
        if (request.initialUserId() != null) associate(org.getId(), request.initialUserId(), "ACTIVE");
        return org;
    }
    public Organization transition(UUID organizationId, OrganizationStatus status) {
        var org = organizations.findByIdForUpdate(organizationId).orElseThrow(() -> ResourceNotFoundException.of("Organization", organizationId));
        lifecycle.transition(org, status, clock.instant());
        return organizations.saveAndFlush(org);
    }
    public CoreOrganizationMembership associate(UUID organizationId, UUID userId, String status) {
        organizations.findByIdForUpdate(organizationId).orElseThrow(() -> ResourceNotFoundException.of("Organization", organizationId));
        if (!users.existsById(userId)) throw ResourceNotFoundException.of("User", userId);
        if (!java.util.Set.of("ACTIVE", "INACTIVE", "SUSPENDED").contains(status)) throw new IllegalArgumentException("Invalid membership status");
        var association = memberships.findByUserIdAndOrganizationId(userId, organizationId).orElseGet(CoreOrganizationMembership::new);
        association.setUserId(userId); association.setOrganizationId(organizationId); association.setStatus(status);
        if (association.getJoinedAt() == null) association.setJoinedAt(clock.instant());
        return memberships.saveAndFlush(association);
    }
    public record CreateOrganization(@NotBlank @Size(max = 150) String name,
            @NotBlank @Size(max = 50) String organizationCode, @Size(max = 63) String slug,
            @NotBlank @Email @Size(max = 255) String primaryEmail, UUID initialUserId) {}
}
