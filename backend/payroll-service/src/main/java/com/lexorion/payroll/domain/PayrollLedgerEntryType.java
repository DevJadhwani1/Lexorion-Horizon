package com.lexorion.payroll.domain;
/** EARNING and EMPLOYER_CONTRIBUTION are positive credits; DEDUCTION and NET_PAY are negative debits; ADJUSTMENT uses its signed amount. */
public enum PayrollLedgerEntryType { EARNING, DEDUCTION, EMPLOYER_CONTRIBUTION, ADJUSTMENT, NET_PAY }
