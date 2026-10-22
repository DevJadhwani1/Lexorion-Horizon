package com.lexorion.finance.api;

import static com.lexorion.finance.api.BillingDtos.*;

import com.lexorion.finance.service.BillingClientService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/finance/clients")
@PreAuthorize("hasRole('ADMIN')")
public class BillingClientController {
    private final BillingClientService service;

    public BillingClientController(BillingClientService service) {
        this.service = service;
    }

    @GetMapping
    public List<ClientResponse> list() {
        return service.list();
    }

    @PostMapping
    public ResponseEntity<ClientResponse> create(@Valid @RequestBody CreateClient request) {
        ClientResponse created = service.create(request);
        return ResponseEntity.created(URI.create("/api/finance/clients/" + created.clientKey())).body(created);
    }

    @GetMapping("/{clientKey}")
    public ClientResponse get(@PathVariable String clientKey) {
        return service.get(clientKey);
    }

    @PatchMapping("/{clientKey}")
    public ClientResponse update(@PathVariable String clientKey, @Valid @RequestBody UpdateClient request) {
        return service.update(clientKey, request);
    }
}
