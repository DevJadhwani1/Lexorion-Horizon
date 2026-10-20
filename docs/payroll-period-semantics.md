# Supported payroll periods and recovery

## Eligibility

Dates are inclusive `LocalDate` business dates, with no timezone conversion or proration. Monthly means first through last calendar day, including leap February. Weekly/biweekly means 7/14 days anchored to the payroll employee's `effectiveFrom`. A profile snapshots the employee's pay frequency when assigned; changing the employee's frequency does not reinterpret the old profile.

A run selects the compensation profile effective at **period start**, not the calculation date. The employee and that one active profile must cover the entire period; partial eligibility, mid-period profile changes and incompatible frequencies are rejected. Calculation date is the bookkeeping date and may follow period end, but cannot precede period start. Amounts are per complete pay period; the engine does not multiply monthly amounts into weekly amounts.

Recurring assignments contribute once per eligible period. A one-time assignment contributes only in the period starting on its profile's `effectiveFrom`; it is excluded from later periods. Consequently a profile starting in the middle of a monthly period cannot be paid by this engine. Choose aligned profile dates; proration and off-cycle bonuses are not supported. A new profile with a new one-time assignment is a new award, not a continuation of the old award.

The workspace lock serializes processing. An employee cannot have overlapping CALCULATED or FINALIZED runs, even under different run keys. Failed attempts reserve no period. This also protects historical runs created before the new period validation. Existing finalized payroll is never recalculated or silently corrected. One-time assignments are also checked against committed calculation lines. For legacy lines without assignment IDs, matching employee/component and the profile covering the original calculation date conservatively prevent a repeat payout, including a legacy payout in a different run period.

## Snapshots and recalculation

Standalone Calculation chooses the aligned period containing its selected date. It uses the same eligibility and one-time rules, but is a preview: it neither pays nor reserves a period. Repeated previews create separate immutable snapshots. A run calculates its own snapshots using the run's period, then freezes amounts, component metadata, assignment identity, source profile key, frequency and dates. CALCULATED runs must explicitly **Reset for recalculation** before processing again. Reset preserves old calculation objects, detaches them from the run, releases its period reservation and returns it to DRAFT with zero totals. A new processing attempt creates new snapshots. FINALIZED runs cannot be reset or edited.

V7 adds nullable period/source fields to old calculation snapshots without rewriting historical amounts. Legacy CALCULATED runs cannot finalize without period provenance; reset and recalculate them under the new rules. Existing profiles take their current employee frequency during migration because earlier assignments did not record it. Operators must review historical frequency changes and historical one-time payouts before future use; the migration cannot reconstruct facts that were never stored. New snapshots contain the missing provenance.

## Failure and recovery

- Validation/entitlement failure before processing leaves DRAFT.
- Calculation/processing failure rolls back **all** employee snapshots and totals, then records FAILED with a safe reason. Correct configuration or service availability and select **Recover to draft**, then **Process**.
- A crash between starting and completing processing can leave PROCESSING. Refresh first. Recovery is allowed after five minutes and acquires the workspace/run locks; it cannot interrupt a transaction holding those locks. Attempt IDs fence off old workers after recovery.
- Recovery retains employees and immutable run dates/currency. For incorrect run dates/currency, create a new run with a different key; the failed run remains available for review.
- Ledger creation and FINALIZED are one database transaction. A finalization failure leaves CALCULATED and no partial ledger; retry Finalize. An ambiguous network response requires Refresh before retrying. The state guard and unique ledger source references prevent duplicate finalized entries.
- There are no external payment/bank/Finance writes in this state machine. Recovery does not claim to reverse external disbursement. If a later integration adds one, it will need its own idempotent delivery contract.

Recovery requires the same organization/workspace authorization, ADMIN role and processing entitlement as processing. It rejects FINALIZED runs, any run with a finalized timestamp or ledger entries, and any failed run with unexpected committed calculation snapshots. CALCULATED runs may explicitly reset before finalization.
