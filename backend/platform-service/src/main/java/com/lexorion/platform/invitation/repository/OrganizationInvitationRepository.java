package com.lexorion.platform.invitation.repository;

import com.lexorion.platform.invitation.entity.InvitationStatus;
import com.lexorion.platform.invitation.entity.OrganizationInvitation;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationInvitationRepository extends JpaRepository<OrganizationInvitation, UUID> {
   @Query("select invitation from OrganizationInvitation invitation\njoin fetch invitation.invitedBy\nwhere invitation.organization.id = :organizationId\norder by invitation.createdAt desc, invitation.id\n")
   List<OrganizationInvitation> findTenantInvitations(@Param("organizationId") UUID organizationId);

   Optional<OrganizationInvitation> findByOrganizationIdAndNormalizedEmailAndStatus(UUID organizationId, String normalizedEmail, InvitationStatus status);

   @Query("select invitation from OrganizationInvitation invitation\nwhere invitation.id = :invitationId and invitation.organization.id = :organizationId\n")
   Optional<OrganizationInvitation> findTenantInvitation(@Param("invitationId") UUID invitationId, @Param("organizationId") UUID organizationId);

   Optional<OrganizationInvitation> findByTokenHash(String tokenHash);

   @Lock(LockModeType.PESSIMISTIC_WRITE)
   @Query("select invitation from OrganizationInvitation invitation where invitation.tokenHash = :tokenHash")
   Optional<OrganizationInvitation> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);
}
