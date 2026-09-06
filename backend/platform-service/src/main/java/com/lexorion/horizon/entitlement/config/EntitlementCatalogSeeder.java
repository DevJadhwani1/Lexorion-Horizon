package com.lexorion.horizon.entitlement.config;

import com.lexorion.horizon.entitlement.entity.*;
import com.lexorion.horizon.entitlement.EntitlementKey;
import com.lexorion.horizon.entitlement.repository.*;
import com.lexorion.horizon.product.repository.ProductRepository;
import java.util.List;
import org.springframework.boot.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @Order(30)
public class EntitlementCatalogSeeder implements ApplicationRunner {
    @org.springframework.beans.factory.annotation.Value("${lexorion.test.legacy-catalog:false}") private boolean legacyTestCatalog;
    private final ProductRepository products; private final PlanRepository plans; private final EntitlementDefinitionRepository definitions; private final PlanEntitlementRepository values;
    public EntitlementCatalogSeeder(ProductRepository products, PlanRepository plans, EntitlementDefinitionRepository definitions, PlanEntitlementRepository values) { this.products = products; this.plans = plans; this.definitions = definitions; this.values = values; }
    @Override @Transactional public void run(ApplicationArguments args) {
        definition("workforce.enabled", "Workforce", EntitlementValueType.BOOLEAN);
        definition("payroll.enabled", "Payroll", EntitlementValueType.BOOLEAN);
        definition("platform.employee_limit", "Employee limit", EntitlementValueType.INTEGER);
        definition("platform.workspace_limit", "Workspace limit", EntitlementValueType.INTEGER);
        definition("workforce.attendance", "Attendance", EntitlementValueType.BOOLEAN);
        definition("workforce.leave", "Leave", EntitlementValueType.BOOLEAN);
        definition("workforce.employee_limit", "Employee limit", EntitlementValueType.INTEGER);
        definition("workforce.payroll_integration", "Payroll integration", EntitlementValueType.BOOLEAN);
        definition("payroll.processing", "Payroll processing", EntitlementValueType.BOOLEAN);
        definition("finance.invoicing", "Invoicing", EntitlementValueType.BOOLEAN);
        commercialPlan("starter", "Starter", 25, 1);
        commercialPlan("business", "Business", 100, 3);
        if (!legacyTestCatalog) return;
        plan("workforce-starter", "Workforce Starter", "workforce", List.of(bool("workforce.attendance"), bool("workforce.leave"), integer("workforce.employee_limit", 25)));
        plan("workforce-growth", "Workforce Growth", "workforce", List.of(bool("workforce.attendance"), bool("workforce.leave"), integer("workforce.employee_limit", 100), bool("workforce.payroll_integration")));
        plan("workforce-enterprise", "Workforce Enterprise", "workforce", List.of(bool("workforce.attendance"), bool("workforce.leave"), integer("workforce.employee_limit", 1000), bool("workforce.payroll_integration")));
        plan("payroll-starter", "Payroll Starter", "payroll", List.of(bool("payroll.processing")));
        plan("finance-starter", "Finance Starter", "finance", List.of(bool("finance.invoicing")));
    }
    private void commercialPlan(String key, String name, int employees, int workspaces) {
        if (plans.findByKey(key).filter(p -> p.getProduct() != null).isPresent()) {
            throw new IllegalStateException("Commercial plan key conflicts with legacy plan: " + key);
        }
        plan(key, name, null, List.of(bool("workforce.enabled"), bool("payroll.enabled"),
                integer("platform.employee_limit", employees), integer("platform.workspace_limit", workspaces),
                integer("workforce.employee_limit", employees), bool("payroll.processing")));
    }
    private EntitlementDefinition definition(String key, String name, EntitlementValueType type) {
        EntitlementKey.requireValid(key);
        return definitions.findByKey(key).orElseGet(() -> { EntitlementDefinition d = new EntitlementDefinition(); d.setKey(key); d.setDisplayName(name); d.setValueType(type); d.setStatus(CatalogStatus.ACTIVE); return definitions.save(d); });
    }
    private void plan(String key, String name, String productKey, List<ValueSeed> seeds) {
        Plan plan = plans.findByKey(key).orElseGet(() -> { Plan p = new Plan(); p.setKey(key); p.setDisplayName(name); if (productKey != null) p.setProduct(products.findByKey(productKey).orElseThrow()); p.setStatus(CatalogStatus.ACTIVE); return plans.save(p); });
        for (ValueSeed seed : seeds) { EntitlementDefinition definition = definitions.findByKey(seed.key()).orElseThrow(); if (!values.existsByPlanIdAndDefinitionId(plan.getId(), definition.getId())) { PlanEntitlement value = new PlanEntitlement(); value.setPlan(plan); value.setDefinition(definition); value.setBooleanValue(seed.booleanValue()); value.setIntegerValue(seed.integerValue()); values.save(value); } }
    }
    private static ValueSeed bool(String key) { return new ValueSeed(key, true, null); }
    private static ValueSeed integer(String key, int value) { return new ValueSeed(key, null, value); }
    private record ValueSeed(String key, Boolean booleanValue, Integer integerValue) { }
}
