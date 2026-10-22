package com.lexorion.finance.api;

import static com.lexorion.finance.api.ItemDtos.*;

import com.lexorion.finance.service.BillableItemService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/finance/items")
@PreAuthorize("hasRole('ADMIN')")
public class BillableItemController {
    private final BillableItemService service;

    public BillableItemController(BillableItemService service) {
        this.service = service;
    }

    @GetMapping
    public List<ItemResponse> list() {
        return service.list();
    }

    @GetMapping("/next-code")
    public NextCode nextCode(@RequestParam String prefix) {
        return service.nextCode(prefix);
    }

    @PostMapping
    public ResponseEntity<ItemResponse> create(@Valid @RequestBody CreateItem request) {
        ItemResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/finance/items/" + created.itemCode())).body(created);
    }

    @GetMapping("/{itemCode}")
    public ItemResponse get(@PathVariable String itemCode) {
        return service.get(itemCode);
    }

    @PatchMapping("/{itemCode}")
    public ItemResponse update(@PathVariable String itemCode, @Valid @RequestBody UpdateItem request) {
        return service.update(itemCode, request);
    }
}
