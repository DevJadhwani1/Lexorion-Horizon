package com.lexorion.platform.organizationsettings.repository;

import com.lexorion.platform.organizationsettings.entity.OrganizationSettings;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationSettingsRepository extends JpaRepository<OrganizationSettings, UUID> {
   Optional<OrganizationSettings> findByOrganizationId(UUID organizationId);
}
