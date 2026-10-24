package com.lexorion.payroll.domain;

/**
 * Whether money has been sent for a pay run. This is not a pay-run status.
 * Calculation and finalization never create a disbursement.
 *
 * The only implemented value is {@link #NOT_AVAILABLE}: Horizon has no payment
 * execution path, so a finalized run is an owed, locked calculation. It is not paid.
 *
 * A future payment integration has to define all of the following before it can
 * initiate a transfer. None of these states or operations exist yet:
 * authorization separate from finalization; verification of the selected method
 * (bank transfer requires a saved holder, account number, IFSC, and a verified
 * account; cheque and cash do not); an idempotency key per employee and run;
 * reconciliation against the settled amount; failure recovery that does not
 * reopen the finalized ledger; and an audit record that omits the full account number.
 */
public enum DisbursementStatus {
    NOT_AVAILABLE
}
