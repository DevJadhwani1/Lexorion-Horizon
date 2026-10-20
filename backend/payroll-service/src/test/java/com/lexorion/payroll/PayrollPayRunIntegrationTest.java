package com.lexorion.payroll;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.lexorion.payroll.domain.PayRunStatus;
import com.lexorion.payroll.entitlement.PayrollProcessingEntitlementGate;
import com.lexorion.payroll.repository.*;
import com.lexorion.payroll.tenant.*;
import com.lexorion.payroll.workforce.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;

@SpringBootTest @AutoConfigureMockMvc
class PayrollPayRunIntegrationTest {
 static final UUID A=UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),B=UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),ALPHA=UUID.fromString("11111111-1111-1111-1111-111111111111"),BETA=UUID.fromString("22222222-2222-2222-2222-222222222222");
 @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
 @Autowired MockMvc mvc;@org.springframework.test.context.bean.override.mockito.MockitoSpyBean PayrollLedgerEntryRepository ledger;@Autowired SalaryTemplateRepository templates;@Autowired PayRunEmployeeRepository runEmployees;@Autowired PayRunRepository runs;@Autowired CalculationLineRepository lines;@Autowired CalculationRepository calculations;@Autowired ComponentAssignmentRepository assignments;@Autowired CompensationProfileRepository profiles;@Autowired ComponentDefinitionRepository definitions;@Autowired PayrollEmployeeRepository employees;@Autowired PayrollWorkspaceRepository workspaces;
 @Autowired com.lexorion.payroll.service.PayRunTransactions transactions;
 @Autowired TrustedPayrollContextHolder contexts;
 @MockitoBean PayrollAuthorityClient authority;@MockitoBean WorkforceEmployeeVerifier workforce;@MockitoBean PayrollProcessingEntitlementGate entitlement;
 @BeforeEach void setup(){ledger.deleteAll();runEmployees.deleteAll();runs.deleteAll();lines.deleteAll();calculations.deleteAll();assignments.deleteAll();profiles.deleteAll();templates.deleteAll();definitions.deleteAll();employees.deleteAll();workspaces.deleteAll();when(authority.validate(anyString(),anyString(),any(),nullable(String.class))).thenAnswer(i->context(i.getArgument(0),i.getArgument(1),i.getArgument(3)));when(workforce.verify(anyString(),any())).thenAnswer(i->new WorkforceEmployeeVerifier.Verification(i.getArgument(0),true,WorkforceEmploymentStatus.ACTIVE));doNothing().when(entitlement).requireProcessing(any());}

 @Test void creationNormalizesIsolatesPaginatesAndAuthorizes()throws Exception{payRun("a","alpha","owner"," pay-002 ","2026-09-01","2026-09-30","2026-10-02","USD").andExpect(status().isCreated()).andExpect(jsonPath("$.payRunKey").value("PAY-002")).andExpect(jsonPath("$.status").value("DRAFT")).andExpect(jsonPath("$.id").doesNotExist());payRun("a","alpha","admin","PAY-001","2026-08-01","2026-08-31","2026-08-31","USD").andExpect(status().isCreated());payRun("a","alpha","owner","PAY-002","2026-09-01","2026-09-30","2026-09-30","USD").andExpect(status().isConflict());payRun("b","beta","owner","PAY-002","2026-09-01","2026-09-30","2026-09-30","USD").andExpect(status().isCreated());payRun("a","alpha","owner","BAD","2026-10-31","2026-10-01","2026-10-15","USD").andExpect(status().isBadRequest());request(get("/api/payroll/pay-runs?page=0&size=1&sort=payRunKey&direction=asc"),"a","alpha","owner").andExpect(status().isOk()).andExpect(jsonPath("$.content[0].payRunKey").value("PAY-001")).andExpect(jsonPath("$.totalElements").value(2));request(get("/api/payroll/pay-runs?sort=id"),"a","alpha","owner").andExpect(status().isBadRequest());payRun("a","alpha","manager","DENIED","2026-01-01","2026-01-31","2026-01-31","USD").andExpect(status().isForbidden());payRun("a","alpha","member","DENIED","2026-01-01","2026-01-31","2026-01-31","USD").andExpect(status().isForbidden());mvc.perform(post("/api/payroll/pay-runs").contentType(MediaType.APPLICATION_JSON).content(runJson("X","2026-01-01","2026-01-31","2026-01-31","USD"))).andExpect(status().isUnauthorized());}

 @Test void employeeInclusionIsExplicitScopedAndUnique()throws Exception{seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");seedEmployeeProfile("b","beta","EMP-1","USD","2026-01-01",null,"200");payRun("a","alpha","owner","RUN","2026-01-01","2026-01-31","2026-01-31","USD");add("a","alpha","owner","RUN","EMP-1").andExpect(status().isCreated()).andExpect(jsonPath("$.employeeCode").value("EMP-1"));add("a","alpha","admin","RUN","EMP-1").andExpect(status().isConflict());add("a","alpha","owner","RUN","UNKNOWN").andExpect(status().isNotFound());add("a","alpha","manager","RUN","EMP-1").andExpect(status().isForbidden());add("a","alpha","member","RUN","EMP-1").andExpect(status().isForbidden());request(get("/api/payroll/pay-runs/RUN/employees"),"a","alpha","owner").andExpect(jsonPath("$.length()").value(1));request(get("/api/payroll/pay-runs/RUN/employees"),"b","beta","owner").andExpect(status().isNotFound());}

 @Test void processingReuses10eProfileDateAndAggregatesTotals()throws Exception{seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01","2026-06-30","100");profile("a","alpha","EMP-1","NEW","2026-07-01",null,"200");seedEmployeeProfile("a","alpha","EMP-2","USD","2026-01-01",null,"300");payRun("a","alpha","owner","RUN","2026-05-01","2026-05-31","2026-05-31","USD");add("a","alpha","owner","RUN","EMP-2");add("a","alpha","owner","RUN","EMP-1");process("a","alpha","owner","RUN").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CALCULATED")).andExpect(jsonPath("$.grossTotal").value(400.0)).andExpect(jsonPath("$.deductionTotal").value(0.0)).andExpect(jsonPath("$.netTotal").value(400.0)).andExpect(jsonPath("$.employeeCount").value(2));request(get("/api/payroll/pay-runs/RUN/employees"),"a","alpha","admin").andExpect(jsonPath("$[0].employeeCode").value("EMP-1")).andExpect(jsonPath("$[0].grossAmount").value(100.0)).andExpect(jsonPath("$[0].calculationDate").value("2026-05-31"));assertThat(calculations.count()).isEqualTo(2);}

 @Test void emptyFailureCurrencyAndEntitlementFailClosed()throws Exception{payRun("a","alpha","owner","EMPTY","2026-01-01","2026-01-31","2026-01-31","USD");process("a","alpha","owner","EMPTY").andExpect(status().isConflict());assertThat(runs.findByWorkspaceIdAndPayRunKey(A,"EMPTY").orElseThrow().getStatus()).isEqualTo(PayRunStatus.DRAFT);employee("a","alpha","NO-PROFILE","USD");payRun("a","alpha","owner","FAIL","2026-01-01","2026-01-31","2026-01-31","USD");add("a","alpha","owner","FAIL","NO-PROFILE");process("a","alpha","owner","FAIL").andExpect(status().isNotFound());assertThat(runs.findByWorkspaceIdAndPayRunKey(A,"FAIL").orElseThrow().getStatus()).isEqualTo(PayRunStatus.FAILED);assertThat(calculations.count()).isZero();seedEmployeeProfile("a","alpha","EUR-EMP","EUR","2026-01-01",null,"100");payRun("a","alpha","owner","CURRENCY","2026-01-01","2026-01-31","2026-01-31","USD");add("a","alpha","owner","CURRENCY","EUR-EMP");process("a","alpha","owner","CURRENCY").andExpect(status().isConflict());assertThat(runs.findByWorkspaceIdAndPayRunKey(A,"CURRENCY").orElseThrow().getStatus()).isEqualTo(PayRunStatus.FAILED);assertThat(calculations.count()).isZero();doThrow(new com.lexorion.payroll.api.PayrollException(403,"missing entitlement")).when(entitlement).requireProcessing(any());process("a","alpha","owner","EMPTY").andExpect(status().isForbidden());}

 @Test void finalizationLifecycleAndHistoricalSnapshotsAreImmutable()throws Exception{seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01","2026-06-30","100");payRun("a","alpha","owner","DRAFT","2026-01-01","2026-01-31","2026-01-31","USD");finalizeRun("a","alpha","owner","DRAFT").andExpect(status().isConflict());payRun("a","alpha","owner","RUN","2026-01-01","2026-01-31","2026-01-31","USD");add("a","alpha","owner","RUN","EMP-1");process("a","alpha","owner","RUN");finalizeRun("a","alpha","admin","RUN").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("FINALIZED")).andExpect(jsonPath("$.finalizedAt").exists());request(patch("/api/payroll/components/BASE").contentType(MediaType.APPLICATION_JSON).content("{\"displayName\":\"Renamed\"}"),"a","alpha","owner").andExpect(status().isOk());request(delete("/api/payroll/components/BASE"),"a","alpha","owner").andExpect(status().isOk());request(patch("/api/payroll/components/BASE").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}"),"a","alpha","owner");profile("a","alpha","EMP-1","FUTURE","2026-07-01",null,"999");request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"currency\":\"EUR\"}"),"a","alpha","owner").andExpect(status().isOk());request(get("/api/payroll/pay-runs/RUN"),"a","alpha","owner").andExpect(jsonPath("$.grossTotal").value(100.0)).andExpect(jsonPath("$.netTotal").value(100.0));request(get("/api/payroll/pay-runs/RUN/employees"),"a","alpha","owner").andExpect(jsonPath("$[0].grossAmount").value(100.0)).andExpect(jsonPath("$[0].currency").value("USD"));request(get("/api/payroll/employees/EMP-1/calculations"),"a","alpha","owner").andExpect(jsonPath("$[0].lines[0].displayName").value("BASE"));add("a","alpha","owner","RUN","EMP-1").andExpect(status().isConflict());process("a","alpha","owner","RUN").andExpect(status().isConflict());finalizeRun("a","alpha","owner","RUN").andExpect(status().isConflict());request(patch("/api/payroll/pay-runs/RUN").contentType(MediaType.APPLICATION_JSON).content("{}"),"a","alpha","owner").andExpect(status().isMethodNotAllowed());}

 @Test void uuidInjectionAndSpoofedAuthorityCannotOverrideContext()throws Exception{String id=B.toString();request(post("/api/payroll/pay-runs").contentType(MediaType.APPLICATION_JSON).content(runJson("INJECT","2026-01-01","2026-01-31","2026-01-31","USD").replace("}",",\"payRunId\":\""+id+"\",\"workspaceId\":\""+id+"\",\"organizationId\":\""+id+"\",\"userId\":\""+id+"\",\"role\":\"ADMIN\"}")),"a","alpha","owner").andExpect(status().isBadRequest());mvc.perform(post("/api/payroll/pay-runs").header("Host","horizon.lexorion.in").header("Authorization","Bearer manager").header("X-Lexorion-Workspace","a").header("X-Lexorion-Organization","alpha").header("X-Workspace-ID",id).header("X-Organization-ID",id).header("X-User-ID",id).header("X-Role","ADMIN").contentType(MediaType.APPLICATION_JSON).content(runJson("FORGED","2026-01-01","2026-01-31","2026-01-31","USD"))).andExpect(status().isForbidden());}

 @Test void concurrentProcessFinalizeAndInclusionAreSerialized()throws Exception{seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");payRun("a","alpha","owner","ADD","2026-01-01","2026-01-31","2026-01-31","USD");CompletableFuture<Integer>a1=CompletableFuture.supplyAsync(()->requestStatus(addBuilder("ADD","EMP-1")));CompletableFuture<Integer>a2=CompletableFuture.supplyAsync(()->requestStatus(addBuilder("ADD","EMP-1")));assertThat(List.of(a1.join(),a2.join())).containsExactlyInAnyOrder(201,409);CompletableFuture<Integer>p1=CompletableFuture.supplyAsync(()->requestStatus(post("/api/payroll/pay-runs/ADD/process")));CompletableFuture<Integer>p2=CompletableFuture.supplyAsync(()->requestStatus(post("/api/payroll/pay-runs/ADD/process")));assertThat(List.of(p1.join(),p2.join())).containsExactlyInAnyOrder(200,409);CompletableFuture<Integer>f1=CompletableFuture.supplyAsync(()->requestStatus(post("/api/payroll/pay-runs/ADD/finalize")));CompletableFuture<Integer>f2=CompletableFuture.supplyAsync(()->requestStatus(post("/api/payroll/pay-runs/ADD/finalize")));assertThat(List.of(f1.join(),f2.join())).containsExactlyInAnyOrder(200,409);assertThat(calculations.count()).isEqualTo(1);}

 @Test void openApiIs10fAndDocumentsPayRuns()throws Exception{mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andExpect(jsonPath("$.info.version").value("10F")).andExpect(jsonPath("$.info.description").value(org.hamcrest.Matchers.containsString("payroll.processing"))).andExpect(jsonPath("$.paths['/api/payroll/pay-runs'].post").exists()).andExpect(jsonPath("$.paths['/api/payroll/pay-runs/{payRunKey}/process'].post").exists()).andExpect(jsonPath("$.paths['/api/payroll/pay-runs/{payRunKey}/finalize'].post").exists());}


 @Test void recurringCompensationUsesPeriodNotLaterCalculationDateAndCannotPaySamePeriodTwice() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01","2026-01-31","100");
  profile("a","alpha","EMP-1","FEB","2026-02-01",null,"200");
  monthly("JAN","2026-01-01","2026-01-31","2026-02-05","EMP-1");
  process("a","alpha","owner","JAN").andExpect(status().isOk()).andExpect(jsonPath("$.grossTotal").value(100.0));
  monthly("FEB","2026-02-01","2026-02-28","2026-03-05","EMP-1");
  process("a","alpha","owner","FEB").andExpect(status().isOk()).andExpect(jsonPath("$.grossTotal").value(200.0));
  monthly("DUP","2026-01-01","2026-01-31","2026-02-06","EMP-1");
  process("a","alpha","owner","DUP").andExpect(status().isConflict());
  process("a","alpha","owner","JAN").andExpect(status().isConflict());
  assertThat(calculations.count()).isEqualTo(2);
 }
 @Test void oneTimeAssignmentOnlyContributesInItsFirstPeriodAndPreviewsDoNotConsumeIt() throws Exception {
  request(post("/api/payroll/components").contentType(MediaType.APPLICATION_JSON).content("{\"componentKey\":\"BASE\",\"displayName\":\"Bonus\",\"category\":\"EARNING\",\"amountType\":\"FIXED_AMOUNT\",\"occurrenceType\":\"ONE_TIME\",\"taxability\":\"TAXABLE\",\"status\":\"ACTIVE\"}"),"a","alpha","owner").andExpect(status().isCreated());
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");
  for (int i=0;i<2;i++) request(post("/api/payroll/employees/EMP-1/calculations").contentType(MediaType.APPLICATION_JSON).content("{\"calculationDate\":\"2026-01-31\"}"),"a","alpha","owner").andExpect(status().isCreated()).andExpect(jsonPath("$.grossAmount").value(100.0));
  monthly("JAN","2026-01-01","2026-01-31","2026-02-05","EMP-1");
  process("a","alpha","owner","JAN").andExpect(jsonPath("$.grossTotal").value(100.0));
  finalizeRun("a","alpha","owner","JAN").andExpect(status().isOk());
  monthly("FEB","2026-02-01","2026-02-28","2026-02-28","EMP-1");
  process("a","alpha","owner","FEB").andExpect(status().isOk()).andExpect(jsonPath("$.grossTotal").value(0.0));
  request(post("/api/payroll/pay-runs/JAN/recover"),"a","alpha","owner").andExpect(status().isConflict());
  assertThat(ledger.count()).isEqualTo(2);
 }
 @Test void incompatibleFrequencyAndPartialOrOutsideProfilePeriodsFailClosed() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01","2026-01-15","100");
  monthly("SHORT","2026-01-01","2026-01-15","2026-01-15","EMP-1");
  process("a","alpha","owner","SHORT").andExpect(status().isConflict());
  monthly("PARTIAL","2026-01-01","2026-01-31","2026-01-31","EMP-1");
  process("a","alpha","owner","PARTIAL").andExpect(status().isConflict());
  monthly("OUTSIDE","2026-02-01","2026-02-28","2026-02-28","EMP-1");
  process("a","alpha","owner","OUTSIDE").andExpect(status().isNotFound());
  request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"payFrequency\":\"WEEKLY\"}"),"a","alpha","owner").andExpect(status().isOk());
  monthly("FREQUENCY","2026-01-01","2026-01-07","2026-01-07","EMP-1");
  process("a","alpha","owner","FREQUENCY").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("frequency")));
  assertThat(calculations.count()).isZero();
 }
 @Test void weeklyBiweeklyAndLeapMonthBoundariesAreInclusiveAndAligned() throws Exception {
  employee("a","alpha","WEEK","USD");
  request(patch("/api/payroll/employees/WEEK").contentType(MediaType.APPLICATION_JSON).content("{\"payFrequency\":\"WEEKLY\"}"),"a","alpha","owner").andExpect(status().isOk());
  seedEmployeeProfile("a","alpha","MONTH","USD","2026-01-01",null,"100");
  profile("a","alpha","WEEK","WEEKLY","2026-01-01",null,"70");
  monthly("WEEK-1","2026-01-01","2026-01-07","2026-01-07","WEEK");process("a","alpha","owner","WEEK-1").andExpect(status().isOk());
  monthly("WEEK-BAD","2026-01-09","2026-01-15","2026-01-15","WEEK");process("a","alpha","owner","WEEK-BAD").andExpect(status().isConflict());
  employee("a","alpha","BIWEEK","USD");
  request(patch("/api/payroll/employees/BIWEEK").contentType(MediaType.APPLICATION_JSON).content("{\"payFrequency\":\"BIWEEKLY\"}"),"a","alpha","owner").andExpect(status().isOk());
  profile("a","alpha","BIWEEK","BIWEEKLY","2026-01-01",null,"140");
  monthly("BIWEEK-1","2026-01-01","2026-01-14","2026-01-14","BIWEEK");process("a","alpha","owner","BIWEEK-1").andExpect(status().isOk());
  monthly("LEAP","2028-02-01","2028-02-29","2028-03-01","MONTH");process("a","alpha","owner","LEAP").andExpect(status().isOk());
 }
 @Test void failedRunRecoversAfterConfigurationFixWithoutPartialSnapshotsOrDuplicateLedger() throws Exception {
  seedEmployeeProfile("a","alpha","A-GOOD","USD","2026-01-01",null,"100");employee("a","alpha","Z-MISSING","USD");
  monthly("RECOVER","2026-01-01","2026-01-31","2026-02-01","A-GOOD");add("a","alpha","owner","RECOVER","Z-MISSING");
  process("a","alpha","owner","RECOVER").andExpect(status().isNotFound());
  assertThat(calculations.count()).isZero();assertThat(ledger.count()).isZero();
  request(get("/api/payroll/pay-runs/RECOVER"),"a","alpha","owner").andExpect(jsonPath("$.failureMessage").value("No effective compensation profile"));
  request(post("/api/payroll/pay-runs/RECOVER/recover"),"a","alpha","manager").andExpect(status().isForbidden());
  request(post("/api/payroll/pay-runs/RECOVER/recover"),"b","beta","owner").andExpect(status().isNotFound());
  profile("a","alpha","Z-MISSING","FIXED","2026-01-01",null,"200");
  request(post("/api/payroll/pay-runs/RECOVER/recover"),"a","alpha","owner").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
  process("a","alpha","owner","RECOVER").andExpect(status().isOk()).andExpect(jsonPath("$.grossTotal").value(300.0));
  finalizeRun("a","alpha","owner","RECOVER").andExpect(status().isOk());
  finalizeRun("a","alpha","owner","RECOVER").andExpect(status().isConflict());assertThat(ledger.count()).isEqualTo(4);
 }
 @Test void finalizationFailureRollsBackLedgerAndCanBeRetried() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");monthly("FINALIZE","2026-01-01","2026-01-31","2026-01-31","EMP-1");process("a","alpha","owner","FINALIZE").andExpect(status().isOk());
  doThrow(new IllegalStateException("simulated ledger failure after save")).when(ledger).flush();
  assertThatThrownBy(() -> finalizeRun("a","alpha","owner","FINALIZE")).hasRootCauseMessage("simulated ledger failure after save");
  reset(ledger);
  assertThat(ledger.count()).isZero();assertThat(runs.findByWorkspaceIdAndPayRunKey(A,"FINALIZE").orElseThrow().getStatus()).isEqualTo(PayRunStatus.CALCULATED);
  finalizeRun("a","alpha","owner","FINALIZE").andExpect(status().isOk());assertThat(ledger.count()).isEqualTo(2);
 }
 @Test void abandonedProcessingRecoversButActiveProcessingDoesNot() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");monthly("ABANDONED","2026-01-01","2026-01-31","2026-01-31","EMP-1");
  var run=runs.findByWorkspaceIdAndPayRunKey(A,"ABANDONED").orElseThrow();run.setStatus(PayRunStatus.PROCESSING);run.setProcessingAttempt(UUID.randomUUID());run.setProcessingStartedAt(java.time.Instant.now());runs.saveAndFlush(run);
  request(post("/api/payroll/pay-runs/ABANDONED/recover"),"a","alpha","owner").andExpect(status().isConflict());
  run.setProcessingStartedAt(java.time.Instant.now().minusSeconds(301));runs.saveAndFlush(run);
  request(post("/api/payroll/pay-runs/ABANDONED/recover"),"a","alpha","owner").andExpect(status().isOk()).andExpect(jsonPath("$.status").value("DRAFT"));
  process("a","alpha","owner","ABANDONED").andExpect(status().isOk());
 }
 @Test void supersededProcessingAttemptCannotCompleteOrFailItsReplacement() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");monthly("FENCED","2026-01-01","2026-01-31","2026-01-31","EMP-1");
  contexts.set(context("a","owner","alpha"));
  try {
   UUID old=transactions.begin("FENCED");
   var run=runs.findByWorkspaceIdAndPayRunKey(A,"FENCED").orElseThrow();run.setProcessingStartedAt(java.time.Instant.now().minusSeconds(301));runs.saveAndFlush(run);
   transactions.recover("FENCED");UUID replacement=transactions.begin("FENCED");
   assertThatThrownBy(() -> transactions.complete("FENCED",old)).hasMessageContaining("superseded");
   transactions.fail("FENCED",old,"old attempt failure");
   assertThat(runs.findByWorkspaceIdAndPayRunKey(A,"FENCED").orElseThrow().getProcessingAttempt()).isEqualTo(replacement);
   transactions.complete("FENCED",replacement);
   assertThat(calculations.count()).isEqualTo(1);
  } finally { contexts.clear(); }
 }
 @Test void recalculationPreservesOldSnapshotsAndLegacyCalculatedRunMustBeRevalidated() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");monthly("RECALC","2026-01-01","2026-01-31","2026-01-31","EMP-1");
  process("a","alpha","owner","RECALC").andExpect(status().isOk());
  jdbc.update("UPDATE payroll_calculations SET period_start=NULL, period_end=NULL");
  finalizeRun("a","alpha","owner","RECALC").andExpect(status().isConflict());
  request(post("/api/payroll/pay-runs/RECALC/recover"),"a","alpha","owner").andExpect(status().isOk()).andExpect(jsonPath("$.grossTotal").value(0.0));
  assertThat(calculations.count()).isEqualTo(1);
  process("a","alpha","owner","RECALC").andExpect(status().isOk()).andExpect(jsonPath("$.grossTotal").value(100.0));
  assertThat(calculations.count()).isEqualTo(2);
  finalizeRun("a","alpha","owner","RECALC").andExpect(status().isOk());assertThat(ledger.count()).isEqualTo(2);
  request(post("/api/payroll/pay-runs/RECALC/recover"),"a","alpha","owner").andExpect(status().isConflict());
 }
 @Test void legacyOneTimePaidInWrongPeriodCannotBePaidAgainInItsEligiblePeriod() throws Exception {
  request(post("/api/payroll/components").contentType(MediaType.APPLICATION_JSON).content("{\"componentKey\":\"BASE\",\"displayName\":\"Bonus\",\"category\":\"EARNING\",\"amountType\":\"FIXED_AMOUNT\",\"occurrenceType\":\"ONE_TIME\",\"taxability\":\"TAXABLE\",\"status\":\"ACTIVE\"}"),"a","alpha","owner").andExpect(status().isCreated());
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");monthly("LEGACY","2026-01-01","2026-01-31","2026-01-31","EMP-1");process("a","alpha","owner","LEGACY").andExpect(status().isOk());finalizeRun("a","alpha","owner","LEGACY").andExpect(status().isOk());
  // Simulate the old engine's September payout of a January-effective one-time assignment, without provenance.
  jdbc.update("UPDATE payroll_pay_runs SET period_start='2026-09-01',period_end='2026-09-30',calculation_date='2026-09-30' WHERE pay_run_key='LEGACY'");
  jdbc.update("UPDATE payroll_calculations SET calculation_date='2026-09-30',period_start=NULL,period_end=NULL");
  jdbc.update("UPDATE payroll_calculation_lines SET source_assignment_id=NULL");
  monthly("ELIGIBLE","2026-01-01","2026-01-31","2026-01-31","EMP-1");
  process("a","alpha","owner","ELIGIBLE").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("already included")));
  assertThat(calculations.count()).isEqualTo(1);assertThat(ledger.count()).isEqualTo(2);
 }
 @Test void preparationReportsActualEligibilityWithoutCreatingSnapshots() throws Exception {
  seedEmployeeProfile("a","alpha","A-GOOD","USD","2026-01-01",null,"100");
  employee("a","alpha","B-INACTIVE","USD");
  request(patch("/api/payroll/employees/B-INACTIVE").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\"}"),"a","alpha","owner").andExpect(status().isOk());
  employee("a","alpha","C-MISSING","USD");
  payRun("a","alpha","owner","PREP","2026-01-01","2026-01-31","2026-01-31","USD");
  preparation("PREP").andExpect(status().isOk()).andExpect(jsonPath("$.employeeCount").value(3))
   .andExpect(jsonPath("$.eligibleCount").value(1)).andExpect(jsonPath("$.blockedCount").value(2))
   .andExpect(jsonPath("$.selectedCount").value(0)).andExpect(jsonPath("$.ready").value(false))
   .andExpect(jsonPath("$.employees[0].eligible").value(true))
   .andExpect(jsonPath("$.employees[1].blockedReason").value(org.hamcrest.Matchers.containsString("inactive")))
   .andExpect(jsonPath("$.employees[2].blockedReason").value("No effective compensation profile"));
  prepare("PREP","[\"B-INACTIVE\"]").andExpect(status().isConflict());
  prepare("PREP","[\"C-MISSING\"]").andExpect(status().isConflict());
  assertThat(runEmployees.count()).isZero(); assertThat(calculations.count()).isZero();
 }
 @Test void preparationSelectionIsAtomicNormalizedAndReplaceable() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100"); employee("a","alpha","MISSING","USD");
  payRun("a","alpha","owner","PREP","2026-01-01","2026-01-31","2026-01-31","USD");
  prepare("PREP","[\" emp-1 \"]").andExpect(status().isOk()).andExpect(jsonPath("$.ready").value(true));
  prepare("PREP","[\"EMP-1\",\" emp-1 \"]").andExpect(status().isConflict());
  prepare("PREP","[\"UNKNOWN\"]").andExpect(status().isNotFound());
  prepare("PREP","[\"MISSING\"]").andExpect(status().isConflict());
  preparation("PREP").andExpect(jsonPath("$.selectedCount").value(1)).andExpect(jsonPath("$.employees[0].selected").value(true));
  prepare("PREP","[\"EMP-1\"]").andExpect(status().isOk()); // idempotent replacement
  assertThat(runEmployees.count()).isEqualTo(1);
  prepare("PREP","[]").andExpect(status().isOk()).andExpect(jsonPath("$.ready").value(false));
  process("a","alpha","owner","PREP").andExpect(status().isConflict());
  assertThat(runEmployees.count()).isZero(); assertThat(calculations.count()).isZero();
 }
 @Test void preparationThenProcessingAndFinalizationUseSameRules() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");
  payRun("a","alpha","owner","PREP","2026-01-01","2026-01-31","2026-02-05","USD");
  prepare("PREP","[\"EMP-1\"]").andExpect(status().isOk()).andExpect(jsonPath("$.ready").value(true));
  assertThat(calculations.count()).isZero();
  process("a","alpha","owner","PREP").andExpect(status().isOk()).andExpect(jsonPath("$.grossTotal").value(100.0));
  prepare("PREP","[]").andExpect(status().isConflict());
  finalizeRun("a","alpha","owner","PREP").andExpect(status().isOk());
  prepare("PREP","[]").andExpect(status().isConflict());
  assertThat(calculations.count()).isEqualTo(1); assertThat(ledger.count()).isEqualTo(2);
 }
 @Test void preparationRejectsInvalidPeriodsFrequencyAndCurrency() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01","2026-01-15","100");
  payRun("a","alpha","owner","BAD","2026-01-01","2026-01-15","2026-01-15","USD");
  prepare("BAD","[\"EMP-1\"]").andExpect(status().isConflict());
  preparation("BAD").andExpect(jsonPath("$.employees[0].blockedReason").value(org.hamcrest.Matchers.containsString("full aligned")));
  payRun("a","alpha","owner","SHORT","2026-01-01","2026-01-31","2026-01-31","USD");
  preparation("SHORT").andExpect(jsonPath("$.employees[0].blockedReason").value(org.hamcrest.Matchers.containsString("entire pay period")));
  request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"payFrequency\":\"WEEKLY\"}"),"a","alpha","owner");
  preparation("SHORT").andExpect(jsonPath("$.employees[0].blockedReason").value(org.hamcrest.Matchers.containsString("frequency does not match")));
  seedEmployeeProfile("a","alpha","EUR","EUR","2026-01-01",null,"100");
  prepare("SHORT","[\"EUR\"]").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("currency")));
 }
 @Test void preparationAndProcessCannotBypassChangedEligibilityOrCommittedOverlap() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");
  payRun("a","alpha","owner","FIRST","2026-01-01","2026-01-31","2026-01-31","USD");
  payRun("a","alpha","owner","SECOND","2026-01-01","2026-01-31","2026-01-31","USD");
  prepare("FIRST","[\"EMP-1\"]").andExpect(jsonPath("$.ready").value(true));
  prepare("SECOND","[\"EMP-1\"]").andExpect(jsonPath("$.ready").value(true)); // draft does not reserve wages
  request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\"}"),"a","alpha","owner");
  process("a","alpha","owner","FIRST").andExpect(status().isConflict());
  assertThat(calculations.count()).isZero();
  request(patch("/api/payroll/employees/EMP-1").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"ACTIVE\"}"),"a","alpha","owner");
  process("a","alpha","owner","SECOND").andExpect(status().isOk());
  request(post("/api/payroll/pay-runs/FIRST/recover"),"a","alpha","owner").andExpect(status().isOk());
  preparation("FIRST").andExpect(jsonPath("$.ready").value(false)).andExpect(jsonPath("$.selectedBlockedCount").value(1))
   .andExpect(jsonPath("$.employees[0].blockedReason").value(org.hamcrest.Matchers.containsString("already has")));
  process("a","alpha","owner","FIRST").andExpect(status().isConflict());
  assertThat(calculations.count()).isEqualTo(1);
 }
 @Test void preparationRequiresLiveWorkspaceAuthorityAndEntitlement() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");
  payRun("a","alpha","owner","PREP","2026-01-01","2026-01-31","2026-01-31","USD");
  request(get("/api/payroll/pay-runs/PREP/preparation"),"b","beta","owner").andExpect(status().isNotFound());
  request(put("/api/payroll/pay-runs/PREP/preparation").contentType(MediaType.APPLICATION_JSON).content("{\"employeeCodes\":[\"EMP-1\"]}"),"b","beta","owner").andExpect(status().isNotFound());
  request(get("/api/payroll/pay-runs/PREP/preparation"),"a","alpha","manager").andExpect(status().isForbidden());
  request(put("/api/payroll/pay-runs/PREP/preparation").contentType(MediaType.APPLICATION_JSON).content("{\"employeeCodes\":[],\"workspaceId\":\""+B+"\"}"),"a","alpha","owner").andExpect(status().isBadRequest());
  mvc.perform(get("/api/payroll/pay-runs/PREP/preparation")).andExpect(status().isUnauthorized());
  doThrow(new com.lexorion.payroll.api.PayrollException(403,"missing entitlement")).when(entitlement).requireProcessing(any());
  preparation("PREP").andExpect(status().isForbidden());prepare("PREP","[\"EMP-1\"]").andExpect(status().isForbidden());
 }
 @Test void legacyDraftWithMissingSetupCanBeResolvedWithoutBypassingValidation() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"100");employee("a","alpha","MISSING","USD");
  monthly("PREP","2026-01-01","2026-01-31","2026-01-31","MISSING");
  preparation("PREP").andExpect(jsonPath("$.selectedBlockedCount").value(1)).andExpect(jsonPath("$.ready").value(false));
  prepare("PREP","[\"EMP-1\"]").andExpect(status().isOk()).andExpect(jsonPath("$.ready").value(true));
  process("a","alpha","owner","PREP").andExpect(status().isOk());
 }
 @Test void preparationRejectsCombinedTotalsBeyondSupportedPrecision() throws Exception {
  seedEmployeeProfile("a","alpha","EMP-1","USD","2026-01-01",null,"600000000000000");
  seedEmployeeProfile("a","alpha","EMP-2","USD","2026-01-01",null,"600000000000000");
  payRun("a","alpha","owner","PREP","2026-01-01","2026-01-31","2026-01-31","USD");
  prepare("PREP","[\"EMP-1\",\"EMP-2\"]").andExpect(status().isConflict()).andExpect(jsonPath("$.message").value("Pay Run total exceeds supported precision"));
  assertThat(runEmployees.count()).isZero();assertThat(calculations.count()).isZero();
 }
 private ResultActions preparation(String key) throws Exception { return request(get("/api/payroll/pay-runs/"+key+"/preparation"),"a","alpha","owner"); }
 private ResultActions prepare(String key,String codes) throws Exception { return request(put("/api/payroll/pay-runs/"+key+"/preparation").contentType(MediaType.APPLICATION_JSON).content("{\"employeeCodes\":"+codes+"}"),"a","alpha","owner"); }

 protected void monthly(String key,String start,String end,String calculation,String employee)throws Exception {
  payRun("a","alpha","owner",key,start,end,calculation,"USD").andExpect(status().isCreated());add("a","alpha","owner",key,employee).andExpect(status().isCreated());
 }
 protected void seedEmployeeProfile(String w,String org,String code,String currency,String from,String to,String value)throws Exception{employee(w,org,code,currency);if(!definitions.existsByWorkspaceIdAndComponentKey(w.equals("a")?A:B,"BASE")){request(post("/api/payroll/components").contentType(MediaType.APPLICATION_JSON).content("{\"componentKey\":\"BASE\",\"displayName\":\"BASE\",\"category\":\"EARNING\",\"amountType\":\"FIXED_AMOUNT\",\"occurrenceType\":\"RECURRING\",\"taxability\":\"TAXABLE\",\"status\":\"ACTIVE\"}"),w,org,"owner").andExpect(status().isCreated());}profile(w,org,code,"PROFILE-"+code,from,to,value);}private void employee(String w,String org,String code,String currency)throws Exception{request(post("/api/payroll/employees").contentType(MediaType.APPLICATION_JSON).content("{\"employeeCode\":\""+code+"\",\"status\":\"ACTIVE\",\"currency\":\""+currency+"\",\"payFrequency\":\"MONTHLY\",\"effectiveFrom\":\"2026-01-01\"}"),w,org,"owner").andExpect(status().isCreated());}private void profile(String w,String org,String code,String key,String from,String to,String value)throws Exception{request(post("/api/payroll/employees/"+code+"/compensation").contentType(MediaType.APPLICATION_JSON).content("{\"profileKey\":\""+key+"\",\"currency\":\""+employees.findByWorkspaceIdAndEmployeeCode(w.equals("a")?A:B,code).orElseThrow().getCurrency()+"\",\"effectiveFrom\":\""+from+"\""+(to==null?"":",\"effectiveTo\":\""+to+"\"")+",\"status\":\"ACTIVE\",\"components\":[{\"componentKey\":\"BASE\",\"value\":"+value+"}]}"),w,org,"owner").andExpect(status().isCreated());}private ResultActions payRun(String w,String org,String token,String key,String start,String end,String date,String currency)throws Exception{return request(post("/api/payroll/pay-runs").contentType(MediaType.APPLICATION_JSON).content(runJson(key,start,end,date,currency)),w,org,token);}private String runJson(String key,String start,String end,String date,String currency){return "{\"payRunKey\":\""+key+"\",\"periodStart\":\""+start+"\",\"periodEnd\":\""+end+"\",\"calculationDate\":\""+date+"\",\"currency\":\""+currency+"\"}";}private ResultActions add(String w,String org,String token,String run,String employee)throws Exception{return request(addBuilder(run,employee),w,org,token);}private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder addBuilder(String run,String employee){return post("/api/payroll/pay-runs/"+run+"/employees").contentType(MediaType.APPLICATION_JSON).content("{\"employeeCode\":\""+employee+"\"}");}private ResultActions process(String w,String org,String token,String run)throws Exception{return request(post("/api/payroll/pay-runs/"+run+"/process"),w,org,token);}private ResultActions finalizeRun(String w,String org,String token,String run)throws Exception{return request(post("/api/payroll/pay-runs/"+run+"/finalize"),w,org,token);}private int requestStatus(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder){try{return request(builder,"a","alpha","owner").andReturn().getResponse().getStatus();}catch(Exception e){throw new IllegalStateException(e);}}private ResultActions request(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder r,String w,String org,String token)throws Exception{return mvc.perform(r.header("Host","horizon.lexorion.in").header("Authorization","Bearer "+token).header("X-Lexorion-Workspace",w).header("X-Lexorion-Organization",org));}protected TrustedPayrollContext context(String w,String token,String org){if((!w.equals("a")&&!w.equals("b"))||!org.equals(w.equals("a")?"alpha":"beta"))throw new IllegalArgumentException();return new TrustedPayrollContext(w.equals("a")?A:B,w,w.equals("a")?ALPHA:BETA,org,token.contains("manager")?"MANAGER":token.contains("member")?"EMPLOYEE":token.contains("admin")?"ADMIN":"ADMIN",UUID.nameUUIDFromBytes((w+":"+token).getBytes(StandardCharsets.UTF_8)));}
}
