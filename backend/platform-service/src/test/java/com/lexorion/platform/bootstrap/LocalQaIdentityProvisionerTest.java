package com.lexorion.platform.bootstrap;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.user.dto.UserResponse;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.membership.service.MembershipService;
import jakarta.validation.Validation;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.mock.env.MockEnvironment;

@ExtendWith(MockitoExtension.class)
class LocalQaIdentityProvisionerTest {
   @Mock UserRepository users;
   @Mock UserService userService;
   @Mock OrganizationRepository organizations;
   @Mock OrganizationMembershipRepository memberships;
   @Mock MembershipService membershipService;
   LocalQaIdentityProperties properties;
   LocalQaIdentityProvisioner provisioner;

   @BeforeEach void setup() {
      properties = new LocalQaIdentityProperties();
      provisioner = new LocalQaIdentityProvisioner(properties, new StandardEnvironment(), users, userService, organizations, memberships, membershipService,
            Validation.buildDefaultValidatorFactory().getValidator());
   }

   @Test void disabledLeavesTheIdentityStoreAlone() {
      provisioner.run(new DefaultApplicationArguments());
      verifyNoInteractions(users, userService, membershipService);
   }

   @Test void productionEnvironmentRefusesBeforeTouchingUsers() {
      properties.setEnabled(true);
      properties.setAcknowledgment("local-only");
      properties.setEnvironment("production");
      properties.setEmail("qa-lifecycle@lexorion.test");
      properties.setPassword("local-test-password");
      assertThatThrownBy(() -> provisioner.run(new DefaultApplicationArguments())).hasMessageContaining("production");
      verifyNoInteractions(users, userService);
   }

   @Test void productionProfileRefuses() {
      properties.setEnabled(true);
      properties.setAcknowledgment("local-only");
      properties.setEmail("qa-lifecycle@lexorion.test");
      properties.setPassword("local-test-password");
      MockEnvironment production = new MockEnvironment();
      production.setActiveProfiles("prod");
      provisioner = new LocalQaIdentityProvisioner(properties, production, users, userService, organizations, memberships, membershipService,
            Validation.buildDefaultValidatorFactory().getValidator());
      assertThatThrownBy(() -> provisioner.run(new DefaultApplicationArguments())).hasMessageContaining("production");
      verifyNoInteractions(userService);
   }

   @Test void existingUserIsNotRecreated() {
      properties.setEnabled(true);
      properties.setAcknowledgment("local-only");
      properties.setEmail("qa-lifecycle@lexorion.test");
      properties.setPassword("local-test-password");
      User existing = org.mockito.Mockito.mock(User.class);
      Organization organization = org.mockito.Mockito.mock(Organization.class);
      when(existing.getId()).thenReturn(UUID.randomUUID());
      when(organization.getId()).thenReturn(UUID.randomUUID());
      when(users.findByEmailIgnoreCase("qa-lifecycle@lexorion.test")).thenReturn(Optional.of(existing));
      when(organizations.findBySlug("lexorion-client")).thenReturn(Optional.of(organization));
      when(memberships.existsByOrganizationIdAndUserId(any(), any())).thenReturn(true);
      provisioner.run(new DefaultApplicationArguments());
      verify(userService, never()).create(any());
      verify(membershipService, never()).addMember(any(), any());
   }

   @Test void missingUserIsCreatedWithTheApplicationEncoderPath() {
      properties.setEnabled(true);
      properties.setAcknowledgment("local-only");
      properties.setEmail("qa-lifecycle@lexorion.test");
      properties.setPassword("local-test-password");
      UUID userId = UUID.randomUUID();
      UUID organizationId = UUID.randomUUID();
      User created = org.mockito.Mockito.mock(User.class);
      Organization organization = org.mockito.Mockito.mock(Organization.class);
      when(created.getId()).thenReturn(userId);
      when(organization.getId()).thenReturn(organizationId);
      when(users.findByEmailIgnoreCase("qa-lifecycle@lexorion.test")).thenReturn(Optional.empty(), Optional.of(created));
      when(userService.create(any())).thenReturn(new UserResponse(userId, "qa-lifecycle@lexorion.test", "QA", "Lifecycle", com.lexorion.core.user.entity.UserStatus.ACTIVE, null, null));
      when(users.findById(userId)).thenReturn(Optional.of(created));
      when(organizations.findBySlug("lexorion-client")).thenReturn(Optional.of(organization));
      when(memberships.existsByOrganizationIdAndUserId(organizationId, userId)).thenReturn(false);
      provisioner.run(new DefaultApplicationArguments());
      verify(userService).create(any());
      verify(membershipService).addMember(any(), any());
   }
}
