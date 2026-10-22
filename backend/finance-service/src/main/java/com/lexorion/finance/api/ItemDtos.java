package com.lexorion.finance.api;

import com.lexorion.finance.domain.BillableItem;
import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.ItemKind;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;

public final class ItemDtos {
    private ItemDtos() { }

    static final String CODE = "^[A-Za-z0-9][A-Za-z0-9._/-]{0,31}$";
    static final String HSN_SAC = "^\\d{4}(\\d{2}){0,2}$";

    public record CreateItem(
            @Pattern(regexp = CODE, message = "must use letters, numbers, . _ / or -") String itemCode,
            /** Used when no code is given: the next free code with this prefix, for example REC → REC-004. */
            @Pattern(regexp = "^[A-Za-z0-9]{1,8}$", message = "must be up to 8 letters or numbers") String codePrefix,
            @NotBlank @Size(max = 160) String name,
            @Size(max = 300) String description,
            ItemKind kind,
            @Size(max = 60) String category,
            @Pattern(regexp = HSN_SAC, message = "must be 4, 6 or 8 digits") String hsnSac,
            @Size(max = 16) String unit,
            @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal unitPrice,
            @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 4) BigDecimal taxRate) { }

    /** Every field optional; an empty string clears an optional value. */
    public record UpdateItem(
            @Size(min = 1, max = 160) String name,
            @Size(max = 300) String description,
            ItemKind kind,
            @Size(max = 60) String category,
            @Pattern(regexp = "^$|" + HSN_SAC, message = "must be 4, 6 or 8 digits") String hsnSac,
            @Size(max = 16) String unit,
            @DecimalMin("0") @Digits(integer = 17, fraction = 2) BigDecimal unitPrice,
            @DecimalMin("0") @DecimalMax("100") @Digits(integer = 3, fraction = 4) BigDecimal taxRate,
            Boolean clearUnitPrice,
            Boolean clearTaxRate,
            ClientStatus status) { }

    public record ItemResponse(String itemCode, String name, String description, ItemKind kind, String category, String hsnSac,
            String unit, BigDecimal unitPrice, BigDecimal taxRate, ClientStatus status, Instant createdAt, Instant updatedAt) {
        public static ItemResponse from(BillableItem i) {
            return new ItemResponse(i.getItemCode(), i.getName(), i.getDescription(), i.getKind(), i.getCategory(), i.getHsnSac(), i.getUnit(),
                    i.getUnitPrice(), i.getTaxRate(), i.getStatus(), i.getCreatedAt(), i.getUpdatedAt());
        }
    }

    public record NextCode(String code) { }
}
