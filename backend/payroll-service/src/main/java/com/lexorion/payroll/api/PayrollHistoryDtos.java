package com.lexorion.payroll.api;
import com.lexorion.payroll.domain.*;import java.math.BigDecimal;import java.time.*;import java.util.List;
public final class PayrollHistoryDtos{private PayrollHistoryDtos(){}
 public record LedgerEntryResponse(String employeeCode,String payRunKey,LocalDate periodStart,LocalDate periodEnd,LocalDate entryDate,PayrollLedgerEntryType type,String componentKey,String componentName,BigDecimal amount,String currency,String sourceReference,PayrollLedgerEntryStatus status,Instant createdAt){}
 public record PayslipLine(String componentKey,String displayName,ComponentCategory category,BigDecimal amount){}
 public record PayslipResponse(String employeeCode,String payRunKey,LocalDate periodStart,LocalDate periodEnd,LocalDate calculationDate,String currency,List<PayslipLine>earnings,List<PayslipLine>deductions,BigDecimal grossAmount,BigDecimal deductionAmount,BigDecimal netAmount,Instant finalizedAt){}
}
