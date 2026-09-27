package com.lexorion.core.organization.service;

import com.lexorion.core.organization.entity.*;
import com.lexorion.core.organization.exception.InvalidLifecycleTransitionException;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class OrganizationLifecycleService {
    public void transition(Organization organization, OrganizationStatus target, Instant now) {
        var current = organization.getStatus();
        boolean allowed = switch (current) {
            case PENDING -> target == OrganizationStatus.TRIAL || target == OrganizationStatus.ACTIVE || target == OrganizationStatus.CANCELLED;
            case TRIAL, ACTIVE -> target == OrganizationStatus.SUSPENDED || target == OrganizationStatus.CANCELLED || (current == OrganizationStatus.TRIAL && target == OrganizationStatus.ACTIVE);
            case SUSPENDED -> target == OrganizationStatus.ACTIVE || target == OrganizationStatus.CANCELLED;
            case CANCELLED, TERMINATED -> false;
        };
        if (!allowed) throw new InvalidLifecycleTransitionException("Organization lifecycle cannot transition from " + current + " to " + target);
        organization.setStatus(target);
        switch (target) {
            case ACTIVE -> { if (organization.getActivatedAt() == null) organization.setActivatedAt(now); }
            case SUSPENDED -> organization.setSuspendedAt(now);
            case CANCELLED -> organization.setCancelledAt(now);
            case TRIAL -> organization.setTrialStartedAt(now);
            default -> { }
        }
    }
}
