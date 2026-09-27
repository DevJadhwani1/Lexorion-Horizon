package com.lexorion.core.security;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component("coreAuthorization")
public class CoreAuthorization {
    private final CoreIdentityService identities;
    public CoreAuthorization(CoreIdentityService identities) { this.identities = identities; }
    public boolean isOperator(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return false;
        try { return identities.load(UUID.fromString(authentication.getName())).coreOperator(); }
        catch (IllegalArgumentException | org.springframework.security.core.AuthenticationException denied) { return false; }
    }
}
