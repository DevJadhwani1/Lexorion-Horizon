package com.lexorion.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.lexorion.finance.repository.*;
import com.lexorion.finance.service.LedgerBackfill;
import com.lexorion.finance.tenant.FinanceAuthorityClient;
import com.lexorion.finance.tenant.TrustedFinanceContext;
import java.math.BigDecimal;
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

/** The books: postings, the month-wise financial-year summary, registers, statements, the lock date and the backfill. */
@SpringBootTest
@AutoConfigureMockMvc
class LedgerIntegrationTest {
    static final UUID WORKSPACE = UUID.fromString("dddddddd-dddd-dddd-dddd-dddddddddddd");

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock testClock() {
            return Clock.fixed(Instant.parse("2027-05-10T10:00:00Z"), ZoneOffset.UTC);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired LedgerEntryRepository ledger;
    @Autowired BillableItemRepository items;
    @Autowired PaymentRepository payments;
    @Autowired InvoiceRepository invoices;
    @Autowired InvoiceTemplateRepository templates;
    @Autowired NumberSequenceRepository sequences;
    @Autowired BillingClientRepository clients;
    @Autowired FinanceWorkspaceRepository workspaces;
    @Autowired LedgerBackfill backfill;
    @MockitoBean FinanceAuthorityClient authority;

    @BeforeEach
    void setup() {
        ledger.deleteAll();
        payments.deleteAll();
        invoices.deleteAll();
        items.deleteAll();
        templates.deleteAll();
        sequences.deleteAll();
        clients.deleteAll();
        workspaces.deleteAll();
        when(authority.validate(anyString(), anyString(), any(), nullable(String.class))).thenAnswer(call ->
                new TrustedFinanceContext(WORKSPACE, call.getArgument(0), UUID.fromString("11111111-1111-1111-1111-111111111111"),
                        "omega", "ADMIN", UUID.fromString("33333333-3333-3333-3333-333333333333")));
    }

    @Test
    void invoicesReceiptsAndVoidsPostBalancedEntriesReportedMonthWiseByFinancialYear() throws Exception {
        json(post("/api/finance/templates"), """
                {"name":"GST","config":{"seller":{"legalName":"Omega","region":"Maharashtra"},"tax":{"mode":"GST"}}}""").andExpect(status().isCreated());
        json(post("/api/finance/clients"), """
                {"clientKey":"mastek","displayName":"Mastek","country":"IN","region":"Maharashtra","currency":"INR"}""").andExpect(status().isCreated());
        // FY 2026-27: May (paid in June), and March (voided in May 2027, so the reversal lands in FY 2027-28).
        issue("2026-05-30", 180000);                                  // REF-00001: 1,80,000 + 9% + 9% = 2,12,400
        json(post("/api/finance/invoices/REF-00001/payments"), "{\"amount\":100000,\"paymentDate\":\"2026-06-15\",\"method\":\"BANK_TRANSFER\"}")
                .andExpect(status().isCreated());
        issue("2027-03-31", 10000);                                   // REF-00002: 11,800
        issue("2027-04-01", 5000);                                    // REF-00003, FY 2027-28: 5,900
        json(post("/api/finance/invoices/REF-00002/void"), "{\"reason\":\"Duplicate\"}").andExpect(status().isOk());
        json(post("/api/finance/invoices/REF-00003/payments"), "{\"amount\":5900,\"paymentDate\":\"2027-05-02\",\"method\":\"CASH\"}");

        request(get("/api/finance/books/years"))
                .andExpect(jsonPath("$[0].label").value("2027-28")).andExpect(jsonPath("$[0].current").value(true))
                .andExpect(jsonPath("$[1].label").value("2026-27"));
        request(get("/api/finance/books/summary?fy=2026-27"))
                .andExpect(jsonPath("$.start").value("2026-04-01")).andExpect(jsonPath("$.end").value("2027-03-31"))
                .andExpect(jsonPath("$.currencies[0].openingReceivables").value(0))
                .andExpect(jsonPath("$.currencies[0].months.length()").value(12))
                .andExpect(jsonPath("$.currencies[0].months[1].month").value("2026-05"))
                .andExpect(jsonPath("$.currencies[0].months[1].taxable").value(180000.00))
                .andExpect(jsonPath("$.currencies[0].months[1].cgst").value(16200.00))
                .andExpect(jsonPath("$.currencies[0].months[1].sgst").value(16200.00))
                .andExpect(jsonPath("$.currencies[0].months[1].invoiced").value(212400.00))
                .andExpect(jsonPath("$.currencies[0].months[1].closingReceivables").value(212400.00))
                .andExpect(jsonPath("$.currencies[0].months[2].collected").value(100000.00))
                .andExpect(jsonPath("$.currencies[0].months[2].closingReceivables").value(112400.00))
                .andExpect(jsonPath("$.currencies[0].months[11].month").value("2027-03"))
                .andExpect(jsonPath("$.currencies[0].months[11].closingReceivables").value(124200.00))
                .andExpect(jsonPath("$.currencies[0].total.invoicesIssued").value(2))
                .andExpect(jsonPath("$.currencies[0].total.taxable").value(190000.00))
                .andExpect(jsonPath("$.currencies[0].closingReceivables").value(124200.00));
        // FY 2027-28 opens with last year's closing balance; the void reverses in May without touching March.
        request(get("/api/finance/books/summary?fy=2027-28"))
                .andExpect(jsonPath("$.currencies[0].openingReceivables").value(124200.00))
                .andExpect(jsonPath("$.currencies[0].months[0].invoiced").value(5900.00))
                .andExpect(jsonPath("$.currencies[0].months[1].invoicesVoided").value(1))
                .andExpect(jsonPath("$.currencies[0].months[1].taxable").value(-10000.00))
                .andExpect(jsonPath("$.currencies[0].months[1].invoiced").value(-11800.00))
                .andExpect(jsonPath("$.currencies[0].months[1].collected").value(5900.00))
                .andExpect(jsonPath("$.currencies[0].closingReceivables").value(112400.00));

        request(get("/api/finance/books/sales-register?fy=2026-27&month=2026-05"))
                .andExpect(jsonPath("$.rows.length()").value(1))
                .andExpect(jsonPath("$.rows[0].invoiceNumber").value("INV-00001"))
                .andExpect(jsonPath("$.rows[0].placeOfSupply").value("Maharashtra"))
                .andExpect(jsonPath("$.rows[0].total").value(212400.00));
        request(get("/api/finance/books/sales-register?fy=2027-28"))
                .andExpect(jsonPath("$.rows.length()").value(2))
                .andExpect(jsonPath("$.rows[1].voucherType").value("INVOICE_VOID"))
                .andExpect(jsonPath("$.rows[1].total").value(-11800.00))
                .andExpect(jsonPath("$.totals[0].invoices").value(1))
                .andExpect(jsonPath("$.totals[0].total").value(-5900.00));
        request(get("/api/finance/books/sales-register?fy=2026-27&month=2027-04")).andExpect(status().isBadRequest());

        // Every voucher balances: the journal's debits equal its credits.
        request(get("/api/finance/books/journal?fy=2026-27"))
                .andExpect(jsonPath("$.totals[0].debit").value(324200.00))
                .andExpect(jsonPath("$.totals[0].credit").value(324200.00));
        request(get("/api/finance/books/journal?fy=2027-28&account=CASH"))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.content[0].debit").value(5900.00));
        assertThat(ledger.imbalance(WORKSPACE)).isEqualByComparingTo(BigDecimal.ZERO);

        request(get("/api/finance/books/statements/mastek?fy=2027-28"))
                .andExpect(jsonPath("$.currencies[0].openingBalance").value(124200.00))
                .andExpect(jsonPath("$.currencies[0].lines.length()").value(3))
                .andExpect(jsonPath("$.currencies[0].lines[0].balance").value(130100.00))
                .andExpect(jsonPath("$.currencies[0].lines[2].balance").value(112400.00))
                .andExpect(jsonPath("$.currencies[0].closingBalance").value(112400.00));

        // The backfill rebuilds exactly the same books from invoices and payments.
        long posted = ledger.count();
        ledger.deleteAll();
        backfill.run(null);
        assertThat(ledger.count()).isEqualTo(posted);
        request(get("/api/finance/books/summary?fy=2026-27")).andExpect(jsonPath("$.currencies[0].closingReceivables").value(124200.00));
    }

    @Test
    void theLockDateClosesEarlierPeriodsAndTheFinancialYearStartIsConfigurable() throws Exception {
        json(post("/api/finance/clients"), "{\"clientKey\":\"acme\",\"displayName\":\"Acme\",\"currency\":\"USD\"}");
        issue("2027-03-15", 100);
        json(put("/api/finance/books/settings"), "{\"fiscalYearStartMonth\":4,\"booksLockedUntil\":\"2027-03-31\"}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.booksLockedUntil").value("2027-03-31"));
        json(put("/api/finance/books/settings"), "{\"fiscalYearStartMonth\":4,\"booksLockedUntil\":\"2027-06-01\"}").andExpect(status().isBadRequest());
        json(post("/api/finance/invoices"), invoiceBody("2027-03-20", 50));
        request(post("/api/finance/invoices/REF-00002/issue")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.startsWith("The books are locked up to 31 Mar 2027.")));
        json(post("/api/finance/invoices/REF-00001/payments"), "{\"amount\":10,\"paymentDate\":\"2027-03-31\",\"method\":\"UPI\"}").andExpect(status().isConflict());
        json(post("/api/finance/invoices/REF-00001/payments"), "{\"amount\":10,\"paymentDate\":\"2027-04-01\",\"method\":\"UPI\"}").andExpect(status().isCreated());

        json(put("/api/finance/books/settings"), "{\"fiscalYearStartMonth\":1,\"booksLockedUntil\":null}")
                .andExpect(jsonPath("$.currentFiscalYear").value("2027"));
        request(get("/api/finance/books/summary"))
                .andExpect(jsonPath("$.fiscalYear").value("2027")).andExpect(jsonPath("$.start").value("2027-01-01"))
                .andExpect(jsonPath("$.currencies[0].currency").value("USD"))
                .andExpect(jsonPath("$.currencies[0].months[2].invoiced").value(118.00));
        request(get("/api/finance/books/summary?fy=2026-27")).andExpect(status().isBadRequest());
    }

    private void issue(String date, int price) throws Exception {
        String reference = com.jayway.jsonpath.JsonPath.read(json(post("/api/finance/invoices"), invoiceBody(date, price))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.reference");
        request(post("/api/finance/invoices/" + reference + "/issue")).andExpect(status().isOk());
    }

    private String invoiceBody(String date, int price) {
        String client = clients.findAll().getFirst().getClientKey();
        return "{\"clientKey\":\"" + client + "\",\"issueDate\":\"" + date + "\",\"lines\":[{\"description\":\"Fee\",\"quantity\":1,\"unitPrice\":" + price + ",\"taxRate\":18}]}";
    }

    private ResultActions json(MockHttpServletRequestBuilder builder, String body) throws Exception {
        return request(builder.contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions request(MockHttpServletRequestBuilder builder) throws Exception {
        return mvc.perform(builder.header("Authorization", "Bearer admin").header("X-Lexorion-Workspace", "omega")
                .header("X-Lexorion-Organization", "omega"));
    }
}
