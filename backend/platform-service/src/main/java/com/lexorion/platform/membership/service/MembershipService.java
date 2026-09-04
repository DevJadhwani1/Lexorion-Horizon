package com.lexorion.platform.membership.service;

import com.lexorion.platform.exception.DuplicateResourceException;
import com.lexorion.platform.exception.ResourceNotFoundException;
import com.lexorion.platform.membership.dto.CreateMembershipRequest;
import com.lexorion.platform.membership.dto.MembershipResponse;
import com.lexorion.platform.membership.dto.UpdateMembershipRoleRequest;
import com.lexorion.platform.membership.dto.UpdateMembershipStatusRequest;
import com.lexorion.platform.membership.entity.MembershipStatus;
import com.lexorion.platform.membership.entity.OrganizationMembership;
import com.lexorion.platform.membership.repository.OrganizationMembershipRepository;
import com.lexorion.platform.organization.entity.Organization;
import com.lexorion.platform.organization.service.OrganizationService;
import com.lexorion.platform.user.entity.User;
import com.lexorion.platform.user.service.UserService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class MembershipService {
   private final OrganizationMembershipRepository membershipRepository;
   private final OrganizationService organizationService;
   private final UserService userService;

   public MembershipService(OrganizationMembershipRepository membershipRepository, OrganizationService organizationService, UserService userService) {
      this.membershipRepository = membershipRepository;
      this.organizationService = organizationService;
      this.userService = userService;
   }

   public MembershipResponse addMember(UUID organizationId, CreateMembershipRequest request) {
      Organization organization = this.organizationService.getEntity(organizationId);
      User user = this.userService.getEntity(request.userId());
      if (this.membershipRepository.existsByOrganizationIdAndUserId(organizationId, user.getId())) {
         String var10002 = String.valueOf(user.getId());
         throw new DuplicateResourceException("User " + var10002 + " is already a member of organization " + String.valueOf(organizationId));
      } else {
         OrganizationMembership membership = new OrganizationMembership();
         membership.setOrganization(organization);
         membership.setUser(user);
         membership.setRole(request.role());
         membership.setStatus(MembershipStatus.ACTIVE);
         membership.setJoinedAt(Instant.now());
         return MembershipResponse.from((OrganizationMembership)this.membershipRepository.save(membership));
      }
   }

   @Transactional(
      readOnly = true
   )
   public List<MembershipResponse> listByOrganization(UUID organizationId) {
      this.organizationService.getEntity(organizationId);
      return this.membershipRepository.findByOrganizationIdOrderByCreatedAtAsc(organizationId).stream().map(MembershipResponse::from).toList();
   }

   @Transactional(
      readOnly = true
   )
   public List<MembershipResponse> listByUser(UUID userId) {
      this.userService.getEntity(userId);
      return this.membershipRepository.findByUserIdOrderByCreatedAtAsc(userId).stream().map(MembershipResponse::from).toList();
   }

   public MembershipResponse updateRole(UUID membershipId, UpdateMembershipRoleRequest request) {
      OrganizationMembership membership = this.findOrThrow(membershipId);
      membership.setRole(request.role());
      return MembershipResponse.from((OrganizationMembership)this.membershipRepository.saveAndFlush(membership));
   }

   public MembershipResponse updateStatus(UUID membershipId, UpdateMembershipStatusRequest request) {
      OrganizationMembership membership = this.findOrThrow(membershipId);
      membership.setStatus(request.status());
      return MembershipResponse.from((OrganizationMembership)this.membershipRepository.saveAndFlush(membership));
   }

   private OrganizationMembership findOrThrow(UUID membershipId) {
      return (OrganizationMembership)this.membershipRepository.findById(membershipId).orElseThrow(() -> ResourceNotFoundException.of("Membership", membershipId));
   }
}
