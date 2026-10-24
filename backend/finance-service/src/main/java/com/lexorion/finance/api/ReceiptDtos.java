package com.lexorion.finance.api;

import com.lexorion.finance.domain.PaymentMethod;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/** Recording a client receipt, and applying part of it to an invoice. */
public final class ReceiptDtos {
    private ReceiptDtos() { }

    public record CreateReceipt(
            @NotBlank @Size(max = 63) String clientKey,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 17, fraction = 2) BigDecimal amount,
            @NotNull LocalDate paymentDate,
            @NotNull PaymentMethod method,
            @Size(max = 64) String reference,
            @Size(max = 500) String notes) { }

    public record AllocateReceipt(
            @NotBlank @Size(max = 32) String invoiceReference,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 17, fraction = 2) BigDecimal amount) { }
}
