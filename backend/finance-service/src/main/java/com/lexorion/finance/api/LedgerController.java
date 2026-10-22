package com.lexorion.finance.api;

import static com.lexorion.finance.api.LedgerDtos.*;

import com.lexorion.finance.domain.LedgerAccount;
import com.lexorion.finance.service.LedgerService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Books: financial-year settings and the ledger reports. `fy` defaults to the current financial year. */
@RestController
@RequestMapping("/api/finance/books")
@PreAuthorize("hasRole('ADMIN')")
public class LedgerController {
    private final LedgerService service;

    public LedgerController(LedgerService service) {
        this.service = service;
    }

    @GetMapping("/settings")
    public BookSettings settings() {
        return service.settings();
    }

    @PutMapping("/settings")
    public BookSettings updateSettings(@Valid @RequestBody UpdateBookSettings request) {
        return service.updateSettings(request);
    }

    @GetMapping("/years")
    public List<FiscalYearOption> years() {
        return service.years();
    }

    @GetMapping("/summary")
    public YearSummary summary(@RequestParam(required = false) String fy) {
        return service.summary(fy);
    }

    @GetMapping("/sales-register")
    public SalesRegister salesRegister(@RequestParam(required = false) String fy, @RequestParam(required = false) String month) {
        return service.salesRegister(fy, month);
    }

    @GetMapping("/journal")
    public Journal journal(@RequestParam(required = false) String fy, @RequestParam(required = false) String month,
            @RequestParam(required = false) LedgerAccount account, @RequestParam(required = false) String clientKey,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return service.journal(fy, month, account, clientKey, page, size);
    }

    @GetMapping("/statements/{clientKey}")
    public Statement statement(@PathVariable String clientKey, @RequestParam(required = false) String fy) {
        return service.statement(clientKey, fy);
    }
}
