package com.lexorion.payroll.domain;
public enum ComponentCategory {
    EARNING, DEDUCTION,
    /** Employer cost (for example the employer share of EPF or ESI). Never part of gross, deductions or net pay. */
    EMPLOYER_CONTRIBUTION
}
