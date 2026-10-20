package com.lexorion.horizon.invitation.service;

import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.service.UserService;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.horizon.invitation.dto.InvitationAcceptanceResponse;
import com.lexorion.horizon.invitation.exception.InvitationConflictException;
import com.lexorion.platform.security.AuthenticatedUser;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvitationRegistrationService {
    private final OrganizationInvitationService invitations;
    private final UserService users;
    private final UserRepository repository;
    private final Validator validator;
    public InvitationRegistrationService(OrganizationInvitationService invitations, UserService users, UserRepository repository, Validator validator) {
        this.invitations = invitations; this.users = users; this.repository = repository; this.validator = validator;
    }
    @Transactional
    public InvitationAcceptanceResponse register(String token, String firstName, String lastName, String password) {
        var invitation = invitations.pending(token);
        String email = invitation.getNormalizedEmail();
        if (repository.findByEmailIgnoreCase(email).isPresent())
            throw new InvitationConflictException("An account already exists. Sign in to accept this invitation.");
        var request = new CreateUserRequest(email, firstName, lastName, password);
        var violations = validator.validate(request);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        var user = users.create(request);
        // Core account and tenant membership commit atomically; the email comes only from the token.
        return invitations.accept(token, new AuthenticatedUser(user.id(), email, Map.of(), false));
    }
}
