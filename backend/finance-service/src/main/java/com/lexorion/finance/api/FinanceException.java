package com.lexorion.finance.api;

/** A business rule violation reported to the caller with the given HTTP status. */
public class FinanceException extends RuntimeException {
    private final int status;

    public FinanceException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
