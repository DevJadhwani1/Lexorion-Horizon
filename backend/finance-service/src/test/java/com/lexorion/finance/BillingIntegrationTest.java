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
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class BillingIntegrationTest {
    static final UUID WORKSPACE_A = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    static final UUID WORKSPACE_B = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    static final UUID ORGANIZATION = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final UUID USER = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock testClock() {
            return Clock.fixed(Instant.parse("2026-10-22T10:00:00Z"), ZoneOffset.UTC);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired LedgerEntryRepository ledger;
    @Autowired AllocationRepository allocations;
    @Autowired IdempotencyKeyRepository idempotencyKeys;
    @Autowired BillableItemRepository items;
    @Autowired PaymentRepository payments;
    @Autowired InvoiceRepository invoices;
    @Autowired BillingClientRepository clients;
    @Autowired InvoiceTemplateRepository templates;
    @Autowired NumberSequenceRepository sequences;
    @Autowired FinanceWorkspaceRepository workspaces;
    @MockitoBean FinanceAuthorityClient authority;

    @BeforeEach
    void setup() {
        ledger.deleteAll();
        allocations.deleteAll();
        idempotencyKeys.deleteAll();
        payments.deleteAll();
        invoices.deleteAll();
        items.deleteAll();
        templates.deleteAll();
        sequences.deleteAll();
        clients.deleteAll();
        workspaces.deleteAll();
        when(authority.validate(anyString(), anyString(), any(), nullable(String.class))).thenAnswer(call -> {
            String key = call.getArgument(0), token = call.getArgument(1);
            if (key.equals("denied")) throw new IllegalStateException("Platform refused");
            String role = token.endsWith("manager") ? "MANAGER" : "ADMIN";
            return new TrustedFinanceContext(key.equals("b") ? WORKSPACE_B : WORKSPACE_A, key, ORGANIZATION, "alpha", role, USER);
        });
    }

    @Test
    void requestsRequireAPlatformValidatedAdministrator() throws Exception {
        mvc.perform(get("/api/finance/invoices")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/finance/invoices").header("Authorization", "Bearer admin")).andExpect(status().isUnauthorized());
        request(get("/api/finance/invoices"), "denied", "admin").andExpect(status().isForbidden());
        request(get("/api/finance/invoices"), "a", "manager").andExpect(status().isForbidden());
        request(get("/api/finance/invoices"), "a", "admin").andExpect(status().isOk());
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void invoiceLifecycleFromDraftToPaid() throws Exception {
        json(post("/api/finance/clients"), "a", """
                {"displayName":"Meridian Logistics","email":"ap@meridian.test","taxId":"27aaecm9908q2zp","currency":"inr","paymentTermsDays":15}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.clientKey").value("meridian-logistics"))
                .andExpect(jsonPath("$.taxId").value("27AAECM9908Q2ZP"))
                .andExpect(jsonPath("$.currency").value("INR"))
                .andExpect(jsonPath("$.id").doesNotExist());
        json(post("/api/finance/invoices"), "a", """
                {"clientKey":"meridian-logistics","issueDate":"2026-10-20","lines":[
                  {"description":"Placement fee","quantity":1,"unitPrice":100000,"taxRate":18},
                  {"description":"Background checks","quantity":3,"unitPrice":1500.50}]}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reference").value("REF-00001"))
                .andExpect(jsonPath("$.invoiceNumber").doesNotExist())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.dueDate").value("2026-11-04"))
                .andExpect(jsonPath("$.subtotal").value(104501.50))
                .andExpect(jsonPath("$.taxTotal").value(18000.00))
                .andExpect(jsonPath("$.total").value(122501.50))
                .andExpect(jsonPath("$.lines.length()").value(2));

        // A draft can be replaced, including its lines.
        json(put("/api/finance/invoices/REF-00001"), "a", """
                {"clientKey":"meridian-logistics","issueDate":"2026-10-20","notes":"PO 4471","lines":[
                  {"description":"Placement fee","quantity":1,"unitPrice":100000,"taxRate":18}]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(118000.00))
                .andExpect(jsonPath("$.lines.length()").value(1))
                .andExpect(jsonPath("$.notes").value("PO 4471"));

        json(post("/api/finance/invoices/REF-00001/payments"), "a", payment("100", "2026-10-21"))
                .andExpect(status().isConflict());
        request(post("/api/finance/invoices/ref-00001/issue"), "a", "admin")
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ISSUED"))
                .andExpect(jsonPath("$.invoiceNumber").value("INV-00001"))
                .andExpect(jsonPath("$.taxBreakdown[0].label").value("Tax"));
        json(put("/api/finance/invoices/REF-00001"), "a", """
                {"clientKey":"meridian-logistics","lines":[{"description":"Changed","quantity":1,"unitPrice":1}]}""")
                .andExpect(status().isConflict());

        json(post("/api/finance/invoices/REF-00001/payments"), "a", payment("200000", "2026-10-21"))
                .andExpect(status().isBadRequest());
        json(post("/api/finance/invoices/REF-00001/payments"), "a", payment("100", "2026-10-30"))
                .andExpect(status().isBadRequest());
        json(post("/api/finance/invoices/REF-00001/payments"), "a", payment("18000", "2026-10-21"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receiptNumber").value("RCPT-00001"))
                .andExpect(jsonPath("$.invoiceNumber").value("INV-00001"))
                .andExpect(jsonPath("$.currency").value("INR"));
        request(get("/api/finance/invoices/REF-00001"), "a", "admin")
                .andExpect(jsonPath("$.status").value("PARTIALLY_PAID"))
                .andExpect(jsonPath("$.balanceDue").value(100000.00));
        request(get("/api/finance/clients/meridian-logistics"), "a", "admin")
                .andExpect(jsonPath("$.outstandingAmount").value(100000.00))
                .andExpect(jsonPath("$.openInvoices").value(1));
        json(post("/api/finance/invoices/REF-00001/void"), "a", "{\"reason\":\"Duplicate\"}")
                .andExpect(status().isConflict());

        json(post("/api/finance/invoices/REF-00001/payments"), "a", payment("100000", "2026-10-22"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.receiptNumber").value("RCPT-00002"));
        request(get("/api/finance/invoices/REF-00001"), "a", "admin")
                .andExpect(jsonPath("$.status").value("PAID"))
                .andExpect(jsonPath("$.balanceDue").value(0.00));
        request(get("/api/finance/invoices/REF-00001/payments"), "a", "admin")
                .andExpect(jsonPath("$.length()").value(2));
        request(get("/api/finance/payments"), "a", "admin")
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].receiptNumber").value("RCPT-00002"));
        request(get("/api/finance/summary"), "a", "admin")
                .andExpect(jsonPath("$.paidInvoices").value(1))
                .andExpect(jsonPath("$.openInvoices").value(0))
                .andExpect(jsonPath("$.totals[0].currency").value("INR"))
                .andExpect(jsonPath("$.totals[0].invoicedThisMonth").value(118000.00))
                .andExpect(jsonPath("$.totals[0].collectedThisMonth").value(118000.00));
    }

    @Test
    void overdueInvoicesAreAgedAndVoidingKeepsNumbersUnique() throws Exception {
        json(post("/api/finance/clients"), "a", """
                {"clientKey":"vertex","displayName":"Vertex Retail","currency":"INR","paymentTermsDays":30}""")
                .andExpect(status().isCreated());
        json(post("/api/finance/clients"), "a", """
                {"clientKey":"vertex","displayName":"Vertex Again","currency":"INR"}""")
                .andExpect(status().isConflict());
        json(post("/api/finance/invoices"), "a", """
                {"clientKey":"vertex","issueDate":"2026-08-01","dueDate":"2026-08-31","lines":[{"description":"Retainer","quantity":1,"unitPrice":8400}]}""")
                .andExpect(status().isCreated());
        request(post("/api/finance/invoices/REF-00001/issue"), "a", "admin").andExpect(status().isOk());
        json(post("/api/finance/invoices"), "a", """
                {"clientKey":"vertex","lines":[{"description":"Mistake","quantity":1,"unitPrice":1}]}""")
                .andExpect(jsonPath("$.reference").value("REF-00002"))
                .andExpect(jsonPath("$.issueDate").value("2026-10-22"))
                .andExpect(jsonPath("$.dueDate").value("2026-11-21"));
        json(post("/api/finance/invoices/REF-00002/void"), "a", "{\"reason\":\"Raised in error\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("VOID"));
        json(post("/api/finance/invoices"), "a", """
                {"clientKey":"vertex","issueDate":"2026-10-22","dueDate":"2026-10-01","lines":[{"description":"Bad dates","quantity":1,"unitPrice":1}]}""")
                .andExpect(status().isBadRequest());
        json(post("/api/finance/invoices"), "a", """
                {"clientKey":"vertex","lines":[]}""")
                .andExpect(status().isBadRequest());

        request(get("/api/finance/invoices?overdue=true"), "a", "admin")
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].invoiceNumber").value("INV-00001"))
                .andExpect(jsonPath("$.content[0].overdue").value(true));
        request(get("/api/finance/invoices?status=VOID"), "a", "admin")
                .andExpect(jsonPath("$.content[0].reference").value("REF-00002"))
                .andExpect(jsonPath("$.content[0].invoiceNumber").doesNotExist());
        request(get("/api/finance/summary"), "a", "admin")
                .andExpect(jsonPath("$.overdueInvoices").value(1))
                .andExpect(jsonPath("$.activeClients").value(1))
                .andExpect(jsonPath("$.totals[0].overdue").value(8400.00))
                .andExpect(jsonPath("$.totals[0].aging.days31To60").value(8400.00));

        json(patch("/api/finance/clients/vertex"), "a", "{\"status\":\"ARCHIVED\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ARCHIVED"));
        json(post("/api/finance/invoices"), "a", """
                {"clientKey":"vertex","lines":[{"description":"After archive","quantity":1,"unitPrice":1}]}""")
                .andExpect(status().isConflict());
    }

    @Test
    void workspacesKeepSeparateClientsInvoicesAndNumbering() throws Exception {
        json(post("/api/finance/clients"), "a", "{\"clientKey\":\"acme\",\"displayName\":\"Acme\",\"currency\":\"USD\"}")
                .andExpect(status().isCreated());
        json(post("/api/finance/invoices"), "a", "{\"clientKey\":\"acme\",\"lines\":[{\"description\":\"Work\",\"quantity\":2,\"unitPrice\":50}]}")
                .andExpect(jsonPath("$.reference").value("REF-00001"));

        request(get("/api/finance/invoices/REF-00001"), "b", "admin").andExpect(status().isNotFound());
        request(get("/api/finance/clients"), "b", "admin").andExpect(jsonPath("$.length()").value(0));
        json(post("/api/finance/invoices"), "b", "{\"clientKey\":\"acme\",\"lines\":[{\"description\":\"Work\",\"quantity\":1,\"unitPrice\":1}]}")
                .andExpect(status().isNotFound());
        json(post("/api/finance/clients"), "b", "{\"clientKey\":\"acme\",\"displayName\":\"Acme B\",\"currency\":\"EUR\"}")
                .andExpect(status().isCreated());
        json(post("/api/finance/invoices"), "b", "{\"clientKey\":\"acme\",\"lines\":[{\"description\":\"Work\",\"quantity\":1,\"unitPrice\":1}]}")
                .andExpect(jsonPath("$.reference").value("REF-00001"))
                .andExpect(jsonPath("$.currency").value("EUR"));
    }

    @Test
    void clientsValidateGstinsAndInvoicesCanBeSearchedByNumberOrClient() throws Exception {
        json(post("/api/finance/clients"), "a", """
                {"displayName":"Mastek","country":"IN","taxId":"not-a-gstin","currency":"INR"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("GSTIN must be 15 characters, for example 27AAACM9908Q2ZP"));
        json(post("/api/finance/clients"), "a", """
                {"displayName":"Mastek","country":"in","taxId":"27aaacm9908q2zp","region":"Maharashtra","currency":"INR"}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.country").value("IN"))
                .andExpect(jsonPath("$.taxId").value("27AAACM9908Q2ZP"));
        json(post("/api/finance/clients"), "a", """
                {"displayName":"Acme Inc","country":"US","taxId":"12-3456789","currency":"USD"}""")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.taxId").value("12-3456789"));
        json(post("/api/finance/invoices"), "a", "{\"clientKey\":\"acme-inc\",\"lines\":[{\"description\":\"Work\",\"quantity\":1,\"unitPrice\":10}]}")
                .andExpect(jsonPath("$.placeOfSupply").value("United States"))
                .andExpect(jsonPath("$.billTo.country").value("US"));
        json(post("/api/finance/invoices"), "a", "{\"clientKey\":\"mastek\",\"lines\":[{\"description\":\"Work\",\"quantity\":1,\"unitPrice\":10}]}");
        request(post("/api/finance/invoices/REF-00002/issue"), "a", "admin").andExpect(jsonPath("$.invoiceNumber").value("INV-00001"));
        request(get("/api/finance/invoices?search=acme"), "a", "admin")
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].reference").value("REF-00001"));
        request(get("/api/finance/invoices?search=inv-0000"), "a", "admin")
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].clientName").value("Mastek"));
        request(get("/api/finance/invoices?search=100%25"), "a", "admin").andExpect(jsonPath("$.totalElements").value(0));
    }

    private static String payment(String amount, String date) {
        return "{\"amount\":" + amount + ",\"paymentDate\":\"" + date + "\",\"method\":\"BANK_TRANSFER\",\"reference\":\"UTR-1\"}";
    }

    private ResultActions json(MockHttpServletRequestBuilder builder, String workspace, String body) throws Exception {
        return request(builder.contentType(MediaType.APPLICATION_JSON).content(body), workspace, "admin");
    }

    private ResultActions request(MockHttpServletRequestBuilder builder, String workspace, String user) throws Exception {
        return mvc.perform(builder.header("Authorization", "Bearer " + user).header("X-Lexorion-Workspace", workspace)
                .header("X-Lexorion-Organization", "alpha"));
    }
}
