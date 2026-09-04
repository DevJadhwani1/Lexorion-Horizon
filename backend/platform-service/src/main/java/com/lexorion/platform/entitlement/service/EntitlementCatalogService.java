package com.lexorion.platform.entitlement.service;
import com.lexorion.platform.entitlement.dto.*;
import com.lexorion.platform.entitlement.entity.CatalogStatus;
import com.lexorion.platform.entitlement.repository.*;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service public class EntitlementCatalogService {
    private final PlanRepository plans; private final EntitlementDefinitionRepository definitions;
    public EntitlementCatalogService(PlanRepository plans, EntitlementDefinitionRepository definitions) { this.plans = plans; this.definitions = definitions; }
    @Transactional(readOnly = true) public List<PlanCatalogResponse> plans() { return plans.findByStatusOrderByDisplayNameAsc(CatalogStatus.ACTIVE).stream().map(PlanCatalogResponse::from).toList(); }
    @Transactional(readOnly = true) public List<EntitlementCatalogResponse> definitions() { return definitions.findByStatusOrderByKeyAsc(CatalogStatus.ACTIVE).stream().map(EntitlementCatalogResponse::from).toList(); }
}
