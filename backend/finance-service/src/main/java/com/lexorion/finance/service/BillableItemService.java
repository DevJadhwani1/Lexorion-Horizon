package com.lexorion.finance.service;

import static com.lexorion.finance.api.ItemDtos.*;

import com.lexorion.finance.api.FinanceException;
import com.lexorion.finance.domain.BillableItem;
import com.lexorion.finance.domain.ClientStatus;
import com.lexorion.finance.domain.FinanceWorkspace;
import com.lexorion.finance.domain.ItemKind;
import com.lexorion.finance.repository.BillableItemRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The registry of services and products a workspace bills for. Codes are unique per workspace and never change;
 * a prefix such as REC numbers its items REC-001, REC-002… so codes group by service line.
 */
@Service
public class BillableItemService {
    private final FinanceWorkspaceScope scope;
    private final BillableItemRepository items;

    public BillableItemService(FinanceWorkspaceScope scope, BillableItemRepository items) {
        this.scope = scope;
        this.items = items;
    }

    @Transactional(readOnly = true)
    public List<ItemResponse> list() {
        return items.findByWorkspaceIdOrderByItemCodeAsc(scope.context().workspaceId()).stream().map(ItemResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ItemResponse get(String code) {
        return ItemResponse.from(find(code));
    }

    @Transactional(readOnly = true)
    public NextCode nextCode(String prefix) {
        return new NextCode(next(scope.context().workspaceId(), explicitPrefix(prefix)));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ItemResponse create(CreateItem request) {
        FinanceWorkspace workspace = scope.locked();
        String code;
        if (request.itemCode() != null && !request.itemCode().isBlank()) {
            code = request.itemCode().trim().toUpperCase(Locale.ROOT);
            if (items.existsByWorkspaceIdAndItemCode(workspace.getId(), code)) throw new FinanceException(409, "An item with code " + code + " already exists");
        } else {
            code = next(workspace.getId(), request.codePrefix() != null && !request.codePrefix().isBlank() ? explicitPrefix(request.codePrefix())
                    : derivedPrefix(request.category() != null && !request.category().isBlank() ? request.category() : request.name()));
        }
        BillableItem item = new BillableItem();
        item.setWorkspace(workspace);
        item.setItemCode(code);
        item.setName(request.name().trim());
        item.setDescription(blank(request.description()));
        item.setKind(request.kind() == null ? ItemKind.SERVICE : request.kind());
        item.setCategory(blank(request.category()));
        item.setHsnSac(blank(request.hsnSac()));
        item.setUnit(blank(request.unit()));
        item.setUnitPrice(request.unitPrice());
        item.setTaxRate(request.taxRate());
        item.setStatus(ClientStatus.ACTIVE);
        return ItemResponse.from(items.saveAndFlush(item));
    }

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public ItemResponse update(String code, UpdateItem request) {
        scope.locked();
        BillableItem item = find(code);
        if (request.name() != null) {
            if (request.name().isBlank()) throw new FinanceException(400, "Item name is required");
            item.setName(request.name().trim());
        }
        if (request.description() != null) item.setDescription(blank(request.description()));
        if (request.kind() != null) item.setKind(request.kind());
        if (request.category() != null) item.setCategory(blank(request.category()));
        if (request.hsnSac() != null) item.setHsnSac(blank(request.hsnSac()));
        if (request.unit() != null) item.setUnit(blank(request.unit()));
        if (request.unitPrice() != null) item.setUnitPrice(request.unitPrice());
        if (Boolean.TRUE.equals(request.clearUnitPrice())) item.setUnitPrice(null);
        if (request.taxRate() != null) item.setTaxRate(request.taxRate());
        if (Boolean.TRUE.equals(request.clearTaxRate())) item.setTaxRate(null);
        if (request.status() != null) item.setStatus(request.status());
        return ItemResponse.from(items.saveAndFlush(item));
    }

    private BillableItem find(String code) {
        return items.findByWorkspaceIdAndItemCode(scope.context().workspaceId(), code == null ? "" : code.trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new FinanceException(404, "Item not found"));
    }

    /** A prefix the admin chose, used as given: REC, PAYROLL, HW2. */
    static String explicitPrefix(String prefix) {
        String value = prefix == null ? "" : prefix.trim().toUpperCase(Locale.ROOT);
        if (!value.matches("^[A-Z0-9]{1,8}$")) throw new FinanceException(400, "A code prefix is up to 8 letters or numbers");
        return value;
    }

    /** The first three letters or digits of a category or name: "Recruitment" → REC, "IT services" → ITS. */
    static String derivedPrefix(String source) {
        String letters = source == null ? "" : source.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        return letters.isEmpty() ? "ITEM" : letters.substring(0, Math.min(letters.length(), 3));
    }

    /** Next free PREFIX-NNN, continuing after the highest number already used with that prefix. */
    private String next(UUID workspaceId, String prefix) {
        Pattern pattern = Pattern.compile("^" + Pattern.quote(prefix) + "-(\\d+)$");
        int highest = 0, width = 3;
        for (BillableItem item : items.findByWorkspaceIdOrderByItemCodeAsc(workspaceId)) {
            Matcher match = pattern.matcher(item.getItemCode());
            if (match.matches()) { highest = Math.max(highest, Integer.parseInt(match.group(1))); width = Math.max(width, match.group(1).length()); }
        }
        String code;
        int number = highest;
        do code = String.format(Locale.ROOT, "%s-%0" + width + "d", prefix, ++number);
        while (items.existsByWorkspaceIdAndItemCode(workspaceId, code));
        return code;
    }

    private static String blank(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
