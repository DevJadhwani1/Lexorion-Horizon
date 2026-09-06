package com.lexorion.horizon.entitlement.service;
import com.lexorion.horizon.entitlement.dto.*;
import com.lexorion.horizon.entitlement.entity.CatalogStatus;
import com.lexorion.horizon.entitlement.repository.*;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service public class EntitlementCatalogService {
    private final PlanRepository plans; private final EntitlementDefinitionRepository definitions; private final PlanEntitlementRepository values;
    public EntitlementCatalogService(PlanRepository plans, EntitlementDefinitionRepository definitions, PlanEntitlementRepository values) { this.plans = plans; this.definitions = definitions; this.values = values; }
    @Transactional(readOnly = true) public List<PlanCatalogResponse> plans() { return plans.findByStatusOrderByDisplayNameAsc(CatalogStatus.ACTIVE).stream()
        .filter(plan -> plan.getProduct() == null)
        .map(plan -> PlanCatalogResponse.from(plan, values.findForPlan(plan.getId()).stream()
            .filter(value -> value.getDefinition().getStatus() == CatalogStatus.ACTIVE)
            .map(value -> new EffectiveEntitlementResponse.Value(value.getDefinition().getKey(), value.getDefinition().getValueType().name(), value.getBooleanValue(), value.getIntegerValue())).toList())).toList(); }
    @Transactional(readOnly = true) public List<EntitlementCatalogResponse> definitions() { return definitions.findByStatusOrderByKeyAsc(CatalogStatus.ACTIVE).stream().map(EntitlementCatalogResponse::from).toList(); }
}
