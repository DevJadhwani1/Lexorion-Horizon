package com.lexorion.payroll;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.lexorion.payroll.domain.*;
import com.lexorion.payroll.entitlement.PayrollProcessingEntitlementGate;
import com.lexorion.payroll.repository.*;
import com.lexorion.payroll.tenant.*;
import com.lexorion.payroll.workforce.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Payroll setup, masked statutory identifiers, EPF/ESI estimates and employer contributions. Identifiers are synthetic. */
@SpringBootTest @AutoConfigureMockMvc
class PayrollSetupIntegrationTest {
    static final UUID A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    static final UUID ALPHA = UUID.fromString("11111111-1111-1111-1111-111111111111"), BETA = UUID.fromString("22222222-2222-2222-2222-222222222222");
    // Format-valid test values, not real identities.
    static final String PAN = "ABCDE1234F", ACCOUNT = "000123456789", UAN = "100000000001", IP = "3100000001";

    @Autowired MockMvc mvc;
    @Autowired StatutoryProfileRepository statutory; @Autowired StatutoryRuleVersionRepository rules;
    @Autowired PayrollLedgerEntryRepository ledger; @Autowired PayRunEmployeeRepository runEmployees; @Autowired PayRunRepository runs;
    @Autowired CalculationLineRepository lines; @Autowired CalculationRepository calculations; @Autowired ComponentAssignmentRepository assignments;
    @Autowired CompensationProfileRepository profiles; @Autowired SalaryTemplateRepository templates; @Autowired ComponentDefinitionRepository definitions;
    @Autowired PayrollEmployeeRepository employees; @Autowired PayrollWorkspaceRepository workspaces;
    @MockitoBean PayrollAuthorityClient authority; @MockitoBean WorkforceEmployeeVerifier workforce; @MockitoBean PayrollProcessingEntitlementGate entitlement;

    @BeforeEach void setup() {
        clean();
        rule("EPF", "2014-09-01", "2026-09-16", "15000", "12", "12", "8.33", "15000");
        rule("EPF", "2026-09-17", null, "25000", "12", "12", "8.33", "25000");
        rule("ESI", "2019-07-01", null, "21000", "0.75", "3.25", null, null);
        when(authority.validate(anyString(), anyString(), any(), nullable(String.class))).thenAnswer(i -> context(i.getArgument(0), i.getArgument(1), i.getArgument(3)));
        when(workforce.verify(anyString(), any())).thenAnswer(i -> new WorkforceEmployeeVerifier.Verification(i.getArgument(0), true, WorkforceEmploymentStatus.ACTIVE));
        doNothing().when(entitlement).requireProcessing(any());
    }

    // Other test classes share this database and delete employees, so statutory rows must not outlive this class's tests.
    @AfterEach void clean() {
        statutory.deleteAll(); rules.deleteAll(); ledger.deleteAll(); runEmployees.deleteAll(); runs.deleteAll(); lines.deleteAll(); calculations.deleteAll();
        assignments.deleteAll(); profiles.deleteAll(); templates.deleteAll(); definitions.deleteAll(); employees.deleteAll(); workspaces.deleteAll();
    }

    @Test void newEnrollmentStartsWithNothingCompleteAndOnlyExistingRulesBlockPayroll() throws Exception {
        employee("a", "alpha", "EMP-1", "INR");
        request(get("/api/payroll/employees/EMP-1/setup"), "a", "alpha", "owner").andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.statutoryProfile").value(nullValue()))
                .andExpect(jsonPath("$.salaryConfigured").value(false))
                .andExpect(jsonPath("$.sections[?(@.key=='enrollment')].status").value("COMPLETE"))
                .andExpect(jsonPath("$.sections[?(@.key=='payment')].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.sections[?(@.key=='epf')].status").value("NOT_STARTED"))
                .andExpect(jsonPath("$.readiness.readyForPayroll").value(false))
                .andExpect(jsonPath("$.readiness.setupComplete").value(false))
                .andExpect(jsonPath("$.readiness.blockers[0]").value(containsString("No active salary")));
        salary("a", "alpha", "EMP-1", "BASIC", "EARNING", "30000");
        // Statutory sections stay advisory: an employee with a salary is still eligible for pay runs.
        request(get("/api/payroll/employees/EMP-1/setup"), "a", "alpha", "owner")
                .andExpect(jsonPath("$.readiness.readyForPayroll").value(true))
                .andExpect(jsonPath("$.readiness.setupComplete").value(false))
                .andExpect(jsonPath("$.readiness.warnings", hasItem("Payment method: not started")));
    }

    @Test void sensitiveIdentifiersAreValidatedStoredNormalizedAndOnlyReturnedMasked() throws Exception {
        employee("a", "alpha", "EMP-1", "INR");
        String body = "{\"paymentMethod\":\"BANK_TRANSFER\",\"bankAccountHolder\":\"Test Person\",\"bankAccountNumber\":\"0001 2345 6789\",\"bankIfsc\":\"hdfc0001234\","
                + "\"pan\":\"abcde1234f\",\"taxRegime\":\"NEW\",\"pfApplicability\":\"APPLICABLE\",\"uan\":\"" + UAN + "\",\"esiApplicability\":\"NOT_APPLICABLE\","
                + "\"ptApplicability\":\"APPLICABLE\",\"ptState\":\"mh\",\"lwfApplicability\":\"NOT_APPLICABLE\"}";
        String response = save("a", "alpha", "EMP-1", body).andExpect(status().isOk())
                .andExpect(jsonPath("$.statutoryProfile.bankAccountNumberMasked").value("••••6789"))
                .andExpect(jsonPath("$.statutoryProfile.panMasked").value("••••234F"))
                .andExpect(jsonPath("$.statutoryProfile.uanMasked").value("••••0001"))
                .andExpect(jsonPath("$.statutoryProfile.bankIfsc").value("HDFC0001234"))
                .andExpect(jsonPath("$.statutoryProfile.ptState").value("MH"))
                .andExpect(jsonPath("$.sections[?(@.key=='payment')].status").value("PENDING_VERIFICATION"))
                .andExpect(jsonPath("$.sections[?(@.key=='tax')].status").value("PENDING_VERIFICATION"))
                .andExpect(jsonPath("$.sections[?(@.key=='esi')].status").value("NOT_APPLICABLE"))
                .andExpect(jsonPath("$.sections[?(@.key=='pt')].status").value("COMPLETE"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(response).doesNotContain(PAN, ACCOUNT, UAN, "\"pan\"", "bankAccountNumber\"");
        StatutoryProfile stored = statutory.findAll().getFirst();
        assertThat(stored.getPan()).isEqualTo(PAN);
        assertThat(stored.getBankAccountNumber()).isEqualTo(ACCOUNT);

        // Verifying, then changing the account, resets its verification. Omitted fields are untouched.
        save("a", "alpha", "EMP-1", "{\"bankVerified\":true,\"panVerified\":true,\"pfVerified\":true}")
                .andExpect(jsonPath("$.sections[?(@.key=='payment')].status").value("COMPLETE"))
                .andExpect(jsonPath("$.sections[?(@.key=='epf')].status").value("COMPLETE"));
        save("a", "alpha", "EMP-1", "{\"bankAccountNumber\":\"000123450000\"}")
                .andExpect(jsonPath("$.statutoryProfile.bankVerified").value(false))
                .andExpect(jsonPath("$.statutoryProfile.panVerified").value(true))
                .andExpect(jsonPath("$.statutoryProfile.bankAccountNumberMasked").value("••••0000"));

        // Invalid values are rejected without echoing them and without changing what was saved.
        save("a", "alpha", "EMP-1", "{\"pan\":\"NOTAPAN99\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("PAN must be")))
                .andExpect(content().string(not(containsString("NOTAPAN99"))));
        save("a", "alpha", "EMP-1", "{\"bankAccountNumber\":\"ABC123456\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Indian bank account numbers have 9 to 18 digits"));
        save("a", "alpha", "EMP-1", "{\"ptState\":\"ZZ\"}").andExpect(status().isBadRequest());
        assertThat(statutory.findAll().getFirst().getPan()).isEqualTo(PAN);

        // A blank value clears an identifier, and with it the verification.
        save("a", "alpha", "EMP-1", "{\"uan\":\"\"}")
                .andExpect(jsonPath("$.statutoryProfile.uanMasked").value(nullValue()))
                .andExpect(jsonPath("$.sections[?(@.key=='epf')].status").value("IN_PROGRESS"));
    }

    @Test void duplicateIdentifiersAreRejectedWithinAWorkspaceOnlyAndAccessIsIsolated() throws Exception {
        employee("a", "alpha", "EMP-1", "INR"); employee("a", "alpha", "EMP-2", "INR"); employee("b", "beta", "EMP-1", "INR");
        save("a", "alpha", "EMP-1", "{\"pan\":\"" + PAN + "\",\"uan\":\"" + UAN + "\",\"esiIpNumber\":\"" + IP + "\"}").andExpect(status().isOk());
        save("a", "alpha", "EMP-1", "{\"pan\":\"" + PAN + "\"}").andExpect(status().isOk()); // re-saving the same value is not a duplicate
        save("a", "alpha", "EMP-2", "{\"pan\":\"" + PAN + "\"}").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("This PAN is already recorded for employee EMP-1"));
        save("a", "alpha", "EMP-2", "{\"uan\":\"" + UAN + "\"}").andExpect(status().isConflict());
        save("a", "alpha", "EMP-2", "{\"esiIpNumber\":\"" + IP + "\"}").andExpect(status().isConflict());
        save("b", "beta", "EMP-1", "{\"pan\":\"" + PAN + "\"}").andExpect(status().isOk());

        request(get("/api/payroll/employees/EMP-2/setup"), "b", "beta", "owner").andExpect(status().isNotFound());
        request(get("/api/payroll/employees/EMP-1/setup"), "a", "alpha", "manager").andExpect(status().isForbidden());
        request(get("/api/payroll/employees/EMP-1/setup"), "a", "alpha", "member").andExpect(status().isForbidden());
        request(get("/api/payroll/employees/EMP-1/setup"), "a", "beta", "owner").andExpect(status().isForbidden());
        mvc.perform(get("/api/payroll/employees/EMP-1/setup")).andExpect(status().isUnauthorized());
        save("a", "alpha", "EMP-1", "{\"workspaceId\":\"" + B + "\"}").andExpect(status().isBadRequest());
        assertThat(statutory.count()).isEqualTo(2);
    }

    @Test void enrollmentDetailsAreOptionalAndValidated() throws Exception {
        employee("a", "alpha", "EMP-1", "INR");
        request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"payGroup\":\"Head office\",\"workState\":\"ka\",\"workLocation\":\"Bengaluru\"}"), "a", "alpha", "owner")
                .andExpect(status().isOk()).andExpect(jsonPath("$.workState").value("KA")).andExpect(jsonPath("$.payGroup").value("Head office"));
        request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"workState\":\"XX\"}"), "a", "alpha", "owner").andExpect(status().isBadRequest());
        request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"payGroup\":\"\"}"), "a", "alpha", "owner")
                .andExpect(jsonPath("$.payGroup").value(nullValue())).andExpect(jsonPath("$.workLocation").value("Bengaluru"));
    }

    @Test void epfEstimateUsesTheRuleVersionInForceAndCapsPensionAtTheCeiling() throws Exception {
        employee("a", "alpha", "EMP-1", "INR");
        estimate("EMP-1", "2026-10-01", "30000", "40000").andExpect(status().isOk())
                .andExpect(jsonPath("$.lines[?(@.scheme=='EPF')].status", everyItem(is("NEEDS_DECISION"))))
                .andExpect(jsonPath("$.employeeDeductionTotal").value(0.0));
        save("a", "alpha", "EMP-1", "{\"pfApplicability\":\"APPLICABLE\",\"esiApplicability\":\"APPLICABLE\"}").andExpect(status().isOk());

        // From 17 Sep 2026: ceiling ₹25,000. 12% = 3,000; EPS 8.33% of 25,000 = 2,082.50 → 2,083; employer PF 3,000 − 2,083 = 917.
        estimate("EMP-1", "2026-10-01", "30000", "40000")
                .andExpect(jsonPath("$.pfWages").value(30000.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employee PF contribution')].amount").value(3000.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employer pension (EPS)')].amount").value(2083.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employer PF contribution')].amount").value(917.0))
                .andExpect(jsonPath("$.lines[?(@.scheme=='ESI')].status").value("ABOVE_CEILING"))
                .andExpect(jsonPath("$.lines[?(@.scheme=='PT')].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.lines[?(@.scheme=='TDS')].status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.employeeDeductionTotal").value(3000.0))
                .andExpect(jsonPath("$.employerContributionTotal").value(3000.0))
                .andExpect(jsonPath("$.sources[0].effectiveFrom").value("2026-09-17"))
                .andExpect(jsonPath("$.sources[0].reviewStatus").value("REQUIRES_EMPLOYER_REVIEW"));
        // Before 17 Sep 2026: ceiling ₹15,000. 12% = 1,800; EPS 8.33% of 15,000 = 1,249.50 → 1,250; employer PF 550.
        estimate("EMP-1", "2026-09-16", "30000", "40000")
                .andExpect(jsonPath("$.lines[?(@.label=='Employee PF contribution')].amount").value(1800.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employer pension (EPS)')].amount").value(1250.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employer PF contribution')].amount").value(550.0));
        // A joint option to contribute on higher wages lifts the PF cap but never the EPS cap.
        save("a", "alpha", "EMP-1", "{\"pfHigherWagesOptIn\":true}").andExpect(status().isOk());
        estimate("EMP-1", "2026-10-01", "30000", "40000")
                .andExpect(jsonPath("$.lines[?(@.label=='Employee PF contribution')].amount").value(3600.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employer pension (EPS)')].amount").value(2083.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employer PF contribution')].amount").value(1517.0));
    }

    @Test void esiEstimateRoundsUpAndPfWagesIncludeAllowancesAboveHalfOfPay() throws Exception {
        employee("a", "alpha", "EMP-1", "INR");
        save("a", "alpha", "EMP-1", "{\"pfApplicability\":\"APPLICABLE\",\"esiApplicability\":\"APPLICABLE\"}").andExpect(status().isOk());
        // Allowances of 12,100 exceed half of 20,100 by 2,050, so PF wages are 8,000 + 2,050 = 10,050.
        estimate("EMP-1", "2026-10-01", "8000", "20100")
                .andExpect(jsonPath("$.pfWages").value(10050.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employee PF contribution')].amount").value(1206.0))
                // 0.75% of 20,100 = 150.75 → 151; 3.25% = 653.25 → 654.
                .andExpect(jsonPath("$.lines[?(@.label=='Employee ESI contribution')].amount").value(151.0))
                .andExpect(jsonPath("$.lines[?(@.label=='Employer ESI contribution')].amount").value(654.0))
                .andExpect(jsonPath("$.warnings[0]").value(containsString("PF wages include")));
        estimate("EMP-1", "2026-10-01", "9000", "8000").andExpect(status().isBadRequest());
        employee("a", "alpha", "EMP-USD", "USD");
        save("a", "alpha", "EMP-USD", "{\"pfApplicability\":\"APPLICABLE\"}").andExpect(status().isOk());
        estimate("EMP-USD", "2026-10-01", "8000", "20000").andExpect(jsonPath("$.lines[?(@.scheme=='EPF')].status").value("UNAVAILABLE"));
    }

    @Test void employerContributionsAreEmployerCostOnlyAndNeverReduceNetPayOrUnbalanceTheLedger() throws Exception {
        employee("a", "alpha", "EMP-1", "INR");
        component("a", "alpha", "BASIC", "EARNING", "FIXED_AMOUNT");
        component("a", "alpha", "PF_EE", "DEDUCTION", "FIXED_AMOUNT");
        component("a", "alpha", "PF_ER", "EMPLOYER_CONTRIBUTION", "FIXED_AMOUNT");
        component("a", "alpha", "ESI_ER", "EMPLOYER_CONTRIBUTION", "PERCENTAGE");
        request(post("/api/payroll/employees/EMP-1/compensation").contentType(MediaType.APPLICATION_JSON).content("{\"profileKey\":\"P\",\"currency\":\"INR\",\"effectiveFrom\":\"2026-01-01\",\"status\":\"ACTIVE\",\"components\":["
                + "{\"componentKey\":\"BASIC\",\"value\":20000},{\"componentKey\":\"PF_EE\",\"value\":1800},{\"componentKey\":\"PF_ER\",\"value\":1800},{\"componentKey\":\"ESI_ER\",\"value\":3.25}]}"), "a", "alpha", "owner")
                .andExpect(status().isCreated());
        request(post("/api/payroll/employees/EMP-1/calculations").contentType(MediaType.APPLICATION_JSON).content("{\"calculationDate\":\"2026-01-31\"}"), "a", "alpha", "owner")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.grossAmount").value(20000.0)).andExpect(jsonPath("$.deductionAmount").value(1800.0))
                .andExpect(jsonPath("$.netAmount").value(18200.0)).andExpect(jsonPath("$.employerContributionAmount").value(2450.0));

        request(post("/api/payroll/pay-runs").contentType(MediaType.APPLICATION_JSON).content("{\"payRunKey\":\"JAN\",\"periodStart\":\"2026-02-01\",\"periodEnd\":\"2026-02-28\",\"calculationDate\":\"2026-02-28\",\"currency\":\"INR\"}"), "a", "alpha", "owner").andExpect(status().isCreated());
        request(post("/api/payroll/pay-runs/JAN/employees").contentType(MediaType.APPLICATION_JSON).content("{\"employeeCode\":\"EMP-1\"}"), "a", "alpha", "owner").andExpect(status().isCreated());
        request(post("/api/payroll/pay-runs/JAN/process"), "a", "alpha", "owner").andExpect(status().isOk())
                .andExpect(jsonPath("$.netTotal").value(18200.0)).andExpect(jsonPath("$.employerContributionTotal").value(2450.0));
        request(post("/api/payroll/pay-runs/JAN/finalize"), "a", "alpha", "owner").andExpect(status().isOk());
        request(get("/api/payroll/pay-runs/JAN/employees"), "a", "alpha", "owner").andExpect(jsonPath("$[0].employerContributionAmount").value(2450.0));
        request(get("/api/payroll/employees/EMP-1/payslips/JAN"), "a", "alpha", "owner").andExpect(status().isOk())
                .andExpect(jsonPath("$.deductions.length()").value(1)).andExpect(jsonPath("$.deductions[0].componentKey").value("PF_EE"))
                .andExpect(jsonPath("$.employerContributions.length()").value(2))
                .andExpect(jsonPath("$.employerContributionAmount").value(2450.0)).andExpect(jsonPath("$.netAmount").value(18200.0));
        var entries = ledger.findAll();
        assertThat(entries).noneMatch(e -> "PF_ER".equals(e.getComponentKey()) || "ESI_ER".equals(e.getComponentKey()));
        assertThat(entries.stream().map(PayrollLedgerEntry::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add)).isEqualByComparingTo("0");
    }

    private void rule(String scheme, String from, String to, String ceiling, String employee, String employer, String pension, String pensionCeiling) {
        StatutoryRuleVersion rule = new StatutoryRuleVersion();
        rule.setId(UUID.randomUUID()); rule.setScheme(StatutoryScheme.valueOf(scheme)); rule.setJurisdiction("IN");
        rule.setEffectiveFrom(LocalDate.parse(from)); rule.setEffectiveTo(to == null ? null : LocalDate.parse(to));
        rule.setWageCeiling(new BigDecimal(ceiling)); rule.setEmployeeRate(new BigDecimal(employee)); rule.setEmployerRate(new BigDecimal(employer));
        rule.setPensionRate(pension == null ? null : new BigDecimal(pension)); rule.setPensionWageCeiling(pensionCeiling == null ? null : new BigDecimal(pensionCeiling));
        rule.setSourceReference("Test rule"); rule.setReviewStatus("REQUIRES_EMPLOYER_REVIEW");
        rules.saveAndFlush(rule);
    }
    private void employee(String w, String org, String code, String currency) throws Exception {
        request(post("/api/payroll/employees").contentType(MediaType.APPLICATION_JSON).content("{\"employeeCode\":\"" + code + "\",\"status\":\"ACTIVE\",\"currency\":\"" + currency + "\",\"payFrequency\":\"MONTHLY\",\"effectiveFrom\":\"2026-01-01\"}"), w, org, "owner").andExpect(status().isCreated());
    }
    private void component(String w, String org, String key, String category, String type) throws Exception {
        request(post("/api/payroll/components").contentType(MediaType.APPLICATION_JSON).content("{\"componentKey\":\"" + key + "\",\"displayName\":\"" + key + "\",\"category\":\"" + category + "\",\"amountType\":\"" + type + "\",\"occurrenceType\":\"RECURRING\",\"taxability\":\"TAXABLE\",\"status\":\"ACTIVE\"}"), w, org, "owner").andExpect(status().isCreated());
    }
    private void salary(String w, String org, String code, String key, String category, String value) throws Exception {
        component(w, org, key, category, "FIXED_AMOUNT");
        request(post("/api/payroll/employees/" + code + "/compensation").contentType(MediaType.APPLICATION_JSON).content("{\"profileKey\":\"P\",\"currency\":\"INR\",\"effectiveFrom\":\"2026-01-01\",\"status\":\"ACTIVE\",\"components\":[{\"componentKey\":\"" + key + "\",\"value\":" + value + "}]}"), w, org, "owner").andExpect(status().isCreated());
    }
    private ResultActions save(String w, String org, String code, String body) throws Exception {
        return request(put("/api/payroll/employees/" + code + "/statutory-profile").contentType(MediaType.APPLICATION_JSON).content(body), w, org, "owner");
    }
    private ResultActions estimate(String code, String asOf, String basic, String gross) throws Exception {
        return request(post("/api/payroll/employees/" + code + "/statutory-estimate").contentType(MediaType.APPLICATION_JSON).content("{\"asOf\":\"" + asOf + "\",\"basicWages\":" + basic + ",\"grossWages\":" + gross + "}"), "a", "alpha", "owner");
    }
    private ResultActions request(MockHttpServletRequestBuilder r, String w, String org, String token) throws Exception {
        return mvc.perform(r.header("Host", "horizon.lexorion.in").header("Authorization", "Bearer " + token).header("X-Lexorion-Workspace", w).header("X-Lexorion-Organization", org));
    }
    private TrustedPayrollContext context(String w, String token, String org) {
        if ((!w.equals("a") && !w.equals("b")) || !org.equals(w.equals("a") ? "alpha" : "beta")) throw new IllegalArgumentException();
        return new TrustedPayrollContext(w.equals("a") ? A : B, w, w.equals("a") ? ALPHA : BETA, org,
                token.contains("manager") ? "MANAGER" : token.contains("member") ? "EMPLOYEE" : "ADMIN", UUID.nameUUIDFromBytes((w + ":" + token).getBytes(StandardCharsets.UTF_8)));
    }
}
