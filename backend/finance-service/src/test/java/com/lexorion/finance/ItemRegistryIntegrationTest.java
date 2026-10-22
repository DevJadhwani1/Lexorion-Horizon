package com.lexorion.finance;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.lexorion.finance.repository.*;
import com.lexorion.finance.tenant.FinanceAuthorityClient;
import com.lexorion.finance.tenant.TrustedFinanceContext;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** The registry of services: codes grouped by prefix, HSN/SAC validation, and lines that keep what was billed. */
@SpringBootTest
@AutoConfigureMockMvc
class ItemRegistryIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired BillableItemRepository items;
    @Autowired LedgerEntryRepository ledger;
    @Autowired PaymentRepository payments;
    @Autowired InvoiceRepository invoices;
    @Autowired BillingClientRepository clients;
    @Autowired NumberSequenceRepository sequences;
    @Autowired FinanceWorkspaceRepository workspaces;
    @MockitoBean FinanceAuthorityClient authority;

    @BeforeEach
    void setup() {
        ledger.deleteAll(); payments.deleteAll(); invoices.deleteAll(); items.deleteAll(); sequences.deleteAll(); clients.deleteAll(); workspaces.deleteAll();
        when(authority.validate(anyString(), anyString(), any(), nullable(String.class))).thenAnswer(call ->
                new TrustedFinanceContext(UUID.fromString("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"), call.getArgument(0),
                        UUID.fromString("11111111-1111-1111-1111-111111111111"), "omega", "ADMIN", UUID.fromString("33333333-3333-3333-3333-333333333333")));
    }

    @Test
    void codesGroupByServiceLineAndLinesKeepTheirBilledValues() throws Exception {
        json(post("/api/finance/items"), """
                {"name":"Recruitment fee","category":"Recruitment","hsnSac":"998512","unit":"Placement","unitPrice":180000,"taxRate":18}""")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.itemCode").value("REC-001")).andExpect(jsonPath("$.kind").value("SERVICE"));
        json(post("/api/finance/items"), "{\"name\":\"Replacement search\",\"codePrefix\":\"rec\"}").andExpect(jsonPath("$.itemCode").value("REC-002"));
        json(post("/api/finance/items"), "{\"name\":\"Advisory retainer\",\"category\":\"Consulting\",\"hsnSac\":\"998311\"}").andExpect(jsonPath("$.itemCode").value("CON-001"));
        json(post("/api/finance/items"), "{\"itemCode\":\"rec-010\",\"name\":\"Executive search\"}").andExpect(jsonPath("$.itemCode").value("REC-010"));
        json(post("/api/finance/items"), "{\"itemCode\":\"REC-010\",\"name\":\"Duplicate\"}").andExpect(status().isConflict());
        json(post("/api/finance/items"), "{\"name\":\"Bad code\",\"hsnSac\":\"99851\"}").andExpect(status().isBadRequest());
        request(get("/api/finance/items/next-code?prefix=REC")).andExpect(jsonPath("$.code").value("REC-011"));
        request(get("/api/finance/items/next-code?prefix=HW")).andExpect(jsonPath("$.code").value("HW-001"));
        request(get("/api/finance/items")).andExpect(jsonPath("$.length()").value(4)).andExpect(jsonPath("$[0].itemCode").value("CON-001"));

        json(patch("/api/finance/items/rec-001"), "{\"unitPrice\":200000,\"status\":\"ARCHIVED\"}")
                .andExpect(jsonPath("$.unitPrice").value(200000)).andExpect(jsonPath("$.status").value("ARCHIVED"));
        json(patch("/api/finance/items/REC-001"), "{\"clearTaxRate\":true,\"hsnSac\":\"\"}")
                .andExpect(jsonPath("$.taxRate").doesNotExist()).andExpect(jsonPath("$.hsnSac").doesNotExist());

        json(post("/api/finance/clients"), "{\"clientKey\":\"mastek\",\"displayName\":\"Mastek\",\"currency\":\"INR\"}");
        json(post("/api/finance/invoices"), """
                {"clientKey":"mastek","lines":[{"itemCode":"REC-001","hsnSac":"998512","unit":"Placement","description":"Recruitment fee","quantity":1,"unitPrice":180000,"taxRate":18}]}""")
                .andExpect(jsonPath("$.lines[0].hsnSac").value("998512")).andExpect(jsonPath("$.lines[0].unit").value("Placement"));
        json(post("/api/finance/invoices"), """
                {"clientKey":"mastek","lines":[{"hsnSac":"12","description":"Bad","quantity":1,"unitPrice":1}]}""").andExpect(status().isBadRequest());
    }

    private ResultActions json(MockHttpServletRequestBuilder builder, String body) throws Exception {
        return request(builder.contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions request(MockHttpServletRequestBuilder builder) throws Exception {
        return mvc.perform(builder.header("Authorization", "Bearer admin").header("X-Lexorion-Workspace", "omega").header("X-Lexorion-Organization", "omega"));
    }
}
