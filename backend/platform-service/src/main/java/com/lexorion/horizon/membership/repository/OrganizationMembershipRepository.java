package com.lexorion.horizon.membership.repository;

import com.lexorion.horizon.membership.entity.MembershipStatus;
import com.lexorion.horizon.membership.entity.OrganizationMembership;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationMembershipRepository extends JpaRepository<OrganizationMembership, UUID> {
   boolean existsByOrganizationIdAndUserId(UUID organizationId, UUID userId);

   List<OrganizationMembership> findByOrganizationIdOrderByCreatedAtAsc(UUID organizationId);

   List<OrganizationMembership> findByUserIdOrderByCreatedAtAsc(UUID userId);

   List<OrganizationMembership> findByUserIdAndStatus(UUID userId, MembershipStatus status);

   Optional<OrganizationMembership> findByUserIdAndOrganizationIdAndStatus(UUID userId, UUID organizationId, MembershipStatus status);

   @Query("select membership\nfrom OrganizationMembership membership\njoin fetch membership.user\nwhere membership.organization.id = :organizationId\norder by lower(membership.user.firstName), lower(membership.user.lastName), membership.id\n")
   List<OrganizationMembership> findTenantMembers(@Param("organizationId") UUID organizationId);

   @Query("select membership\nfrom OrganizationMembership membership\njoin fetch membership.user\nwhere membership.id = :membershipId and membership.organization.id = :organizationId\n")
   Optional<OrganizationMembership> findTenantMember(@Param("membershipId") UUID membershipId, @Param("organizationId") UUID organizationId);

   @Lock(LockModeType.PESSIMISTIC_WRITE)
   @Query("select membership\nfrom OrganizationMembership membership\nwhere membership.organization.id = :organizationId\n  and membership.role = com.lexorion.horizon.membership.entity.OrganizationRole.ADMIN\n  and membership.status = com.lexorion.horizon.membership.entity.MembershipStatus.ACTIVE\n")
   List<OrganizationMembership> lockActiveOwners(@Param("organizationId") UUID organizationId);

   @Query("select membership\nfrom OrganizationMembership membership\njoin fetch membership.organization organization\nwhere membership.user.id = :userId and membership.status = :status\norder by lower(organization.name), organization.id\n")
   List<OrganizationMembership> findForUserByStatusOrdered(@Param("userId") UUID userId, @Param("status") MembershipStatus status);
}
