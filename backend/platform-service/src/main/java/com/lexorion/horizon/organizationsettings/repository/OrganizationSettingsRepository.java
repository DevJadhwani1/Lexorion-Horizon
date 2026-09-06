package com.lexorion.horizon.organizationsettings.repository;

import com.lexorion.horizon.organizationsettings.entity.OrganizationSettings;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationSettingsRepository extends JpaRepository<OrganizationSettings, UUID> {
   Optional<OrganizationSettings> findByOrganizationId(UUID organizationId);
}
