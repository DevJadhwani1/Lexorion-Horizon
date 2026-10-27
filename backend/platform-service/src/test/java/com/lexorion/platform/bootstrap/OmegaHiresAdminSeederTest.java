package com.lexorion.platform.bootstrap;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.lexorion.core.organization.entity.Organization;
import com.lexorion.core.organization.repository.OrganizationRepository;
import com.lexorion.core.platformaccess.dto.CreatePlatformAccessRequest;
import com.lexorion.core.platformaccess.entity.PlatformAccess;
import com.lexorion.core.platformaccess.entity.PlatformAccessStatus;
import com.lexorion.core.platformaccess.entity.PlatformRole;
import com.lexorion.core.platformaccess.repository.PlatformAccessRepository;
import com.lexorion.core.platformaccess.service.PlatformAccessService;
import com.lexorion.core.user.dto.CreateUserRequest;
import com.lexorion.core.user.dto.UserResponse;
import com.lexorion.core.user.entity.User;
import com.lexorion.core.user.entity.UserStatus;
import com.lexorion.core.user.repository.UserRepository;
import com.lexorion.core.user.service.UserService;
import com.lexorion.horizon.entitlement.repository.OrganizationPlanAssignmentRepository;
import com.lexorion.horizon.entitlement.service.PlanAssignmentService;
import com.lexorion.horizon.membership.dto.CreateMembershipRequest;
import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import com.lexorion.horizon.membership.entity.OrganizationRole;
import com.lexorion.horizon.membership.repository.OrganizationMembershipRepository;
import com.lexorion.horizon.membership.service.MembershipService;
import com.lexorion.horizon.product.entity.Product;
import com.lexorion.horizon.product.repository.ProductRepository;
import com.lexorion.horizon.workspace.repository.OrganizationWorkspaceRepository;
import com.lexorion.horizon.workspace.service.HorizonProvisioningService;
import com.lexorion.platform.organization.service.OrganizationService;
import jakarta.validation.Validation;
import java.util.Collections;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;

@ExtendWith(MockitoExtension.class)
class OmegaHiresAdminSeederTest {
   @Mock UserRepository users;
   @Mock UserService userService;
   @Mock PlatformAccessRepository platformAccessRepository;
   @Mock PlatformAccessService platformAccessService;
   @Mock OrganizationRepository organizationRepository;
   @Mock OrganizationService organizationService;
   @Mock OrganizationMembershipRepository membershipRepository;
   @Mock MembershipService membershipService;
   @Mock HorizonProvisioningService horizonProvisioningService;
   @Mock PlanAssignmentService planAssignmentService;
   @Mock OrganizationPlanAssignmentRepository planAssignmentRepository;
   @Mock OrganizationWorkspaceRepository workspaceRepository;
   @Mock ProductRepository productRepository;

   OmegaHiresSeedProperties properties;
   OmegaHiresAdminSeeder seeder;

   @BeforeEach void setup() {
      properties = new OmegaHiresSeedProperties();
      seeder = new OmegaHiresAdminSeeder(properties, users, userService, platformAccessRepository,
            platformAccessService, organizationRepository, organizationService, membershipRepository,
            membershipService, horizonProvisioningService, planAssignmentService,
            planAssignmentRepository, workspaceRepository, productRepository,
            Validation.buildDefaultValidatorFactory().getValidator());
   }

   @Test void disabledLeavesStoreAlone() {
      seeder.run(new DefaultApplicationArguments());
      verifyNoInteractions(users, userService, platformAccessService, membershipService);
   }

   @Test void missingPasswordFailsSafelyForNewAccount() {
      properties.setEnabled(true);
      properties.setPassword(null);
      when(users.findByEmailIgnoreCase("admin@omegahires.com")).thenReturn(Optional.empty());

      assertThatThrownBy(() -> seeder.run(new DefaultApplicationArguments()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("password is required");

      verify(userService, never()).create(any());
   }

   @Test void shortPasswordFailsSafely() {
      properties.setEnabled(true);
      properties.setPassword("short");
      when(users.findByEmailIgnoreCase("admin@omegahires.com")).thenReturn(Optional.empty());

      assertThatThrownBy(() -> seeder.run(new DefaultApplicationArguments()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("between 12 and 72 UTF-8 bytes");

      verify(userService, never()).create(any());
   }

   @Test void createsAccountAndReconcilesAdminRoleAndPlatformAccess() {
      properties.setEnabled(true);
      properties.setPassword("SecureAdminPass123!");
      UUID userId = UUID.randomUUID();
      UUID orgId = UUID.randomUUID();

      User created = mock(User.class);
      Organization org = mock(Organization.class);
      when(created.getId()).thenReturn(userId);
      when(org.getId()).thenReturn(orgId);
      when(org.getSlug()).thenReturn("omegahires");
      when(org.getStatus()).thenReturn(com.lexorion.core.organization.entity.OrganizationStatus.ACTIVE);

      when(users.findByEmailIgnoreCase("admin@omegahires.com")).thenReturn(Optional.empty());
      when(userService.create(any(CreateUserRequest.class))).thenReturn(
            new UserResponse(userId, "admin@omegahires.com", "Admin", "User", UserStatus.ACTIVE, null, null));
      when(users.findById(userId)).thenReturn(Optional.of(created));

      when(organizationRepository.findBySlug("omegahires")).thenReturn(Optional.of(org));
      when(planAssignmentRepository.findForOrganization(orgId)).thenReturn(Optional.empty());
      when(workspaceRepository.existsByOrganizationIdAndKey(orgId, "omegahires")).thenReturn(true);
      when(membershipRepository.findByOrganizationIdAndUserId(orgId, userId)).thenReturn(Optional.empty());
      when(platformAccessRepository.findByUserId(userId)).thenReturn(Optional.empty());

      seeder.run(new DefaultApplicationArguments());

      verify(userService).create(any(CreateUserRequest.class));
      verify(horizonProvisioningService).enroll(orgId);
      verify(planAssignmentService).assignPlanToOrganization(orgId, "starter");
      verify(membershipService).addMember(orgId, new CreateMembershipRequest(userId, OrganizationRole.ADMIN));
      verify(platformAccessService).grant(new CreatePlatformAccessRequest(userId, PlatformRole.ADMIN));
   }

   @Test void existingAccountPreservesPasswordAndReconcilesRoles() {
      properties.setEnabled(true);
      properties.setPassword("AnyPasswordDoesNotMatter");
      UUID userId = UUID.randomUUID();
      UUID orgId = UUID.randomUUID();

      User existing = mock(User.class);
      Organization org = mock(Organization.class);
      OrganizationMembership membership = mock(OrganizationMembership.class);
      PlatformAccess access = mock(PlatformAccess.class);

      when(existing.getId()).thenReturn(userId);
      when(existing.getEmail()).thenReturn("admin@omegahires.com");
      when(org.getId()).thenReturn(orgId);
      when(org.getStatus()).thenReturn(com.lexorion.core.organization.entity.OrganizationStatus.ACTIVE);
      when(membership.getStatus()).thenReturn(MembershipStatus.ACTIVE);
      when(membership.getRole()).thenReturn(OrganizationRole.ADMIN);
      when(access.getStatus()).thenReturn(PlatformAccessStatus.ACTIVE);
      when(access.getRole()).thenReturn(PlatformRole.ADMIN);

      when(users.findByEmailIgnoreCase("admin@omegahires.com")).thenReturn(Optional.of(existing));
      when(organizationRepository.findBySlug("omegahires")).thenReturn(Optional.of(org));
      when(planAssignmentRepository.findForOrganization(orgId)).thenReturn(Optional.of(mock(com.lexorion.horizon.entitlement.entity.OrganizationPlanAssignment.class)));
      when(workspaceRepository.existsByOrganizationIdAndKey(orgId, "omegahires")).thenReturn(true);
      when(membershipRepository.findByOrganizationIdAndUserId(orgId, userId)).thenReturn(Optional.of(membership));
      when(platformAccessRepository.findByUserId(userId)).thenReturn(Optional.of(access));

      seeder.run(new DefaultApplicationArguments());

      // Password is NEVER touched on existing account
      verify(userService, never()).create(any());
      verify(membershipService, never()).addMember(any(), any());
      verify(membershipService, never()).updateRole(any(), any());
      verify(platformAccessService, never()).grant(any());
   }

   @Test void idempotentRerunsDoNotCreateDuplicates() {
      properties.setEnabled(true);
      UUID userId = UUID.randomUUID();
      UUID orgId = UUID.randomUUID();

      User user = mock(User.class);
      Organization org = mock(Organization.class);
      OrganizationMembership membership = mock(OrganizationMembership.class);
      PlatformAccess access = mock(PlatformAccess.class);

      when(user.getId()).thenReturn(userId);
      when(user.getEmail()).thenReturn("admin@omegahires.com");
      when(org.getId()).thenReturn(orgId);
      when(org.getStatus()).thenReturn(com.lexorion.core.organization.entity.OrganizationStatus.ACTIVE);
      when(membership.getStatus()).thenReturn(MembershipStatus.ACTIVE);
      when(membership.getRole()).thenReturn(OrganizationRole.ADMIN);
      when(access.getStatus()).thenReturn(PlatformAccessStatus.ACTIVE);
      when(access.getRole()).thenReturn(PlatformRole.ADMIN);

      when(users.findByEmailIgnoreCase("admin@omegahires.com")).thenReturn(Optional.of(user));
      when(organizationRepository.findBySlug("omegahires")).thenReturn(Optional.of(org));
      when(planAssignmentRepository.findForOrganization(orgId)).thenReturn(Optional.of(mock(com.lexorion.horizon.entitlement.entity.OrganizationPlanAssignment.class)));
      when(workspaceRepository.existsByOrganizationIdAndKey(orgId, "omegahires")).thenReturn(true);
      when(membershipRepository.findByOrganizationIdAndUserId(orgId, userId)).thenReturn(Optional.of(membership));
      when(platformAccessRepository.findByUserId(userId)).thenReturn(Optional.of(access));

      // Run twice
      seeder.run(new DefaultApplicationArguments());
      seeder.run(new DefaultApplicationArguments());

      verify(userService, never()).create(any());
      verify(organizationService, never()).create(any());
      verify(membershipService, never()).addMember(any(), any());
      verify(platformAccessService, never()).grant(any());
   }
}
