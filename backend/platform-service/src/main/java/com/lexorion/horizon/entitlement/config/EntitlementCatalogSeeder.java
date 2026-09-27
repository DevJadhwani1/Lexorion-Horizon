package com.lexorion.horizon.entitlement.config;

import com.lexorion.horizon.entitlement.entity.*;
import com.lexorion.horizon.entitlement.EntitlementKey;
import com.lexorion.horizon.entitlement.repository.*;
import java.util.List;
import org.springframework.boot.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @Order(30)
public class EntitlementCatalogSeeder implements ApplicationRunner {
    private final PlanRepository plans; private final EntitlementDefinitionRepository definitions; private final PlanEntitlementRepository values;
    public EntitlementCatalogSeeder(PlanRepository plans, EntitlementDefinitionRepository definitions, PlanEntitlementRepository values) { this.plans = plans; this.definitions = definitions; this.values = values; }
    @Override @Transactional public void run(ApplicationArguments args) {
        definition("workforce.enabled", "Workforce", EntitlementValueType.BOOLEAN);
        definition("payroll.enabled", "Payroll", EntitlementValueType.BOOLEAN);
        definition("platform.employee_limit", "Employee limit", EntitlementValueType.INTEGER);
        definition("platform.workspace_limit", "Workspace limit", EntitlementValueType.INTEGER);
        definition("payroll.processing", "Payroll processing", EntitlementValueType.BOOLEAN);
        commercialPlan("starter", "Starter", 25, 1);
        commercialPlan("business", "Business", 100, 3);
    }
    private void commercialPlan(String key, String name, int employees, int workspaces) {
        if (plans.findByKey(key).filter(p -> p.getProduct() != null).isPresent()) {
            throw new IllegalStateException("Commercial plan key conflicts with legacy plan: " + key);
        }
        plan(key, name, List.of(bool("workforce.enabled"), bool("payroll.enabled"),
                integer("platform.employee_limit", employees), integer("platform.workspace_limit", workspaces),
                bool("payroll.processing")));
    }
    private EntitlementDefinition definition(String key, String name, EntitlementValueType type) {
        EntitlementKey.requireValid(key);
        EntitlementDefinition definition = definitions.findByKey(key).orElseGet(() -> { EntitlementDefinition d = new EntitlementDefinition(); d.setKey(key); d.setDisplayName(name); d.setValueType(type); return definitions.save(d); });
        definition.setDisplayName(name); definition.setValueType(type); definition.setStatus(CatalogStatus.ACTIVE); return definitions.save(definition);
    }
    private void plan(String key, String name, List<ValueSeed> seeds) {
        Plan plan = plans.findByKey(key).orElseGet(() -> { Plan p = new Plan(); p.setKey(key); p.setDisplayName(name); p.setProduct(null); p.setStatus(CatalogStatus.ACTIVE); return plans.save(p); });
        plan.setDisplayName(name); plan.setStatus(CatalogStatus.ACTIVE); plans.save(plan);
        for (ValueSeed seed : seeds) {
            EntitlementDefinition definition = definitions.findByKey(seed.key()).orElseThrow();
            PlanEntitlement value = values.findByPlanIdAndDefinitionId(plan.getId(), definition.getId()).orElseGet(PlanEntitlement::new);
            value.setPlan(plan); value.setDefinition(definition); value.setBooleanValue(seed.booleanValue()); value.setIntegerValue(seed.integerValue()); values.save(value);
        }
    }
    private static ValueSeed bool(String key) { return new ValueSeed(key, true, null); }
    private static ValueSeed integer(String key, int value) { return new ValueSeed(key, null, value); }
    private record ValueSeed(String key, Boolean booleanValue, Integer integerValue) { }
}
