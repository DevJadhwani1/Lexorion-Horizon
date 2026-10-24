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

/** A recruitment firm's GST tax invoice: custom numbering per financial year, engagement fields and a frozen layout. */
@SpringBootTest
@AutoConfigureMockMvc
class InvoiceTemplateIntegrationTest {
    static final UUID WORKSPACE = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock testClock() {
            return Clock.fixed(Instant.parse("2027-05-10T10:00:00Z"), ZoneOffset.UTC);
        }
    }

    static final String RECRUITMENT = """
            {"name":"Recruitment tax invoice","layout":"MODERN","config":{
              "branding":{"primaryColor":"#1D2B7A","accentColor":"#7CB342"},
              "seller":{"legalName":"Omega Hires India Private Limited","tagline":"Executive recruitment · Workforce solutions",
                "address":"Vikhroli, Mumbai","region":"Maharashtra","identifiers":[{"label":"GSTIN","value":"27AAECO677261ZF"},{"label":"TAN","value":"MUMO11095A"}]},
              "document":{"title":"Invoice","subtitle":"Tax invoice","copyLabel":"Original for recipient","detailsTitle":"Recruitment engagement"},
              "numbering":{"pattern":"OH/{FY}/{SEQ}","padding":4,"fiscalYearStartMonth":4},
              "tax":{"mode":"GST"},
              "columns":{"showItemCode":true,"itemCodeLabel":"Code"},
              "customFields":[{"key":"candidate","label":"Candidate","type":"TEXT","required":true},{"key":"joiningDate","label":"Joining date","type":"DATE"}],
              "paymentDetails":[{"label":"Bank","value":"ICICI Bank"},{"label":"IFSC","value":"ICIC0000740"}],
              "terms":["Payment due within 30 days of invoice date."],
              "defaultNotes":"Please reference the invoice number on remittance.",
              "signatory":{"name":"Shumbham Arun Rai","title":"Authorised signatory"},
              "dateStyle":"ORDINAL"}}""";

    @Autowired MockMvc mvc;
    @Autowired LedgerEntryRepository ledger;
    @Autowired AllocationRepository allocations;
    @Autowired IdempotencyKeyRepository idempotencyKeys;
    @Autowired BillableItemRepository items;
    @Autowired PaymentRepository payments;
    @Autowired InvoiceRepository invoices;
    @Autowired InvoiceTemplateRepository templates;
    @Autowired NumberSequenceRepository sequences;
    @Autowired BillingClientRepository clients;
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
        when(authority.validate(anyString(), anyString(), any(), nullable(String.class))).thenAnswer(call ->
                new TrustedFinanceContext(WORKSPACE, call.getArgument(0), UUID.fromString("11111111-1111-1111-1111-111111111111"),
                        "omega", "ADMIN", UUID.fromString("33333333-3333-3333-3333-333333333333")));
    }

    @Test
    void recruitmentTemplateNumbersPerFinancialYearSplitsGstAndFreezesIssuedInvoices() throws Exception {
        json(post("/api/finance/templates"), RECRUITMENT)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.templateKey").value("recruitment-tax-invoice"))
                .andExpect(jsonPath("$.isDefault").value(true))
                .andExpect(jsonPath("$.nextNumber").value("OH/27-28/0001"))
                .andExpect(jsonPath("$.config.showAmountInWords").value(true));
        request(get("/api/finance/templates/recruitment-tax-invoice/next-number?date=2026-05-30"))
                .andExpect(jsonPath("$.number").value("OH/26-27/0001"));

        json(post("/api/finance/clients"), """
                {"clientKey":"mastek","displayName":"Mastek Limited","contactName":"Ramya Chandran · Accounts Payable","region":"Maharashtra","taxId":"27AAACM9908Q2ZP","currency":"INR"}""")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.region").value("Maharashtra"));
        json(post("/api/finance/clients"), """
                {"clientKey":"infosys","displayName":"Infosys","region":"Karnataka","currency":"INR"}""").andExpect(status().isCreated());

        // Within the seller's state: CGST + SGST. The default template, notes and place of supply apply automatically.
        json(post("/api/finance/invoices"), invoice("mastek", "2026-05-30", "\"candidate\":\"Saksham Jain\",\"joiningDate\":\"2026-04-10\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reference").value("REF-00001"))
                .andExpect(jsonPath("$.template.templateKey").value("recruitment-tax-invoice"))
                .andExpect(jsonPath("$.template.config.document.detailsTitle").value("Recruitment engagement"))
                .andExpect(jsonPath("$.placeOfSupply").value("Maharashtra"))
                .andExpect(jsonPath("$.notes").value("Please reference the invoice number on remittance."))
                .andExpect(jsonPath("$.customFields.candidate").value("Saksham Jain"))
                .andExpect(jsonPath("$.lines[0].itemCode").value("REC-001"))
                .andExpect(jsonPath("$.billTo.contactName").value("Ramya Chandran · Accounts Payable"))
                .andExpect(jsonPath("$.taxBreakdown[0].label").value("CGST"))
                .andExpect(jsonPath("$.taxBreakdown[0].amount").value(16200.00))
                .andExpect(jsonPath("$.taxBreakdown[1].label").value("SGST"))
                .andExpect(jsonPath("$.total").value(212400.00));
        request(post("/api/finance/invoices/REF-00001/issue"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.invoiceNumber").value("OH/26-27/0001"));

        // Another state: IGST. Same financial year continues the series; a new one restarts it.
        json(post("/api/finance/invoices"), invoice("infosys", "2026-06-02", "\"candidate\":\"Asha Rao\""))
                .andExpect(jsonPath("$.taxBreakdown[0].label").value("IGST"))
                .andExpect(jsonPath("$.taxBreakdown[0].amount").value(32400.00));
        request(post("/api/finance/invoices/REF-00002/issue")).andExpect(jsonPath("$.invoiceNumber").value("OH/26-27/0002"));
        json(post("/api/finance/invoices"), invoice("infosys", "2027-04-02", "\"candidate\":\"Vik Mehta\""));
        request(post("/api/finance/invoices/REF-00003/issue")).andExpect(jsonPath("$.invoiceNumber").value("OH/27-28/0001"));

        // Issued bills keep the template and buyer they were issued with; drafts follow the latest template.
        json(put("/api/finance/templates/recruitment-tax-invoice"), RECRUITMENT.replace("Omega Hires India Private Limited", "Omega Hires LLP")
                .replace("{\"name\":\"Recruitment tax invoice\",", "{"))
                .andExpect(status().isOk());
        json(patch("/api/finance/clients/mastek"), "{\"displayName\":\"Mastek Ltd (renamed)\"}").andExpect(status().isOk());
        request(get("/api/finance/invoices/REF-00001"))
                .andExpect(jsonPath("$.template.config.seller.legalName").value("Omega Hires India Private Limited"))
                .andExpect(jsonPath("$.billTo.name").value("Mastek Limited"))
                .andExpect(jsonPath("$.taxBreakdown[0].label").value("CGST"));
        json(post("/api/finance/invoices"), invoice("mastek", "2027-05-01", "\"candidate\":\"Neel Shah\""))
                .andExpect(jsonPath("$.template.config.seller.legalName").value("Omega Hires LLP"))
                .andExpect(jsonPath("$.billTo.name").value("Mastek Ltd (renamed)"));
        request(get("/api/finance/invoices?size=10")).andExpect(jsonPath("$.content[?(@.reference == 'REF-00004')].invoiceNumber").value(org.hamcrest.Matchers.contains((Object) null)));
    }

    @Test
    void templateRulesAreEnforced() throws Exception {
        json(post("/api/finance/templates"), RECRUITMENT).andExpect(status().isCreated());
        json(post("/api/finance/templates"), RECRUITMENT.replace("OH/{FY}/{SEQ}", "OH/{FY}")).andExpect(status().isBadRequest());
        json(post("/api/finance/templates"), RECRUITMENT.replace("OH/{FY}/{SEQ}", "OH {SEQ}")).andExpect(status().isBadRequest());
        json(post("/api/finance/templates"), RECRUITMENT.replace("OH/{FY}/{SEQ}", "{WEEK}-{SEQ}")).andExpect(status().isBadRequest());
        json(post("/api/finance/templates"), RECRUITMENT.replace("\"key\":\"joiningDate\"", "\"key\":\"candidate\"")).andExpect(status().isBadRequest());
        json(post("/api/finance/templates"), RECRUITMENT.replace("#1D2B7A", "navy")).andExpect(status().isBadRequest());
        json(post("/api/finance/templates"), """
                {"name":"Consulting","layout":"CLASSIC","config":{"customFields":[{"key":"project","label":"Project","type":"TEXT"}]}}""")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.isDefault").value(false))
                .andExpect(jsonPath("$.nextNumber").value("INV-00001"));
        json(put("/api/finance/templates/recruitment-tax-invoice"), "{\"status\":\"ARCHIVED\"}").andExpect(status().isConflict());
        request(post("/api/finance/templates/consulting/default")).andExpect(jsonPath("$.isDefault").value(true));
        request(get("/api/finance/templates")).andExpect(jsonPath("$[?(@.isDefault == true)].templateKey").value(org.hamcrest.Matchers.contains("consulting")));

        json(post("/api/finance/clients"), "{\"clientKey\":\"acme\",\"displayName\":\"Acme\",\"currency\":\"INR\"}");
        // Fields belong to a template, dates must be dates, and required fields block issuing, not drafting.
        json(post("/api/finance/invoices"), invoice("acme", "2027-05-01", "\"candidate\":\"Wrong template\"")).andExpect(status().isBadRequest());
        json(post("/api/finance/invoices"), invoiceWith("recruitment-tax-invoice", "\"joiningDate\":\"next week\"")).andExpect(status().isBadRequest());
        json(put("/api/finance/templates/recruitment-tax-invoice"), "{\"status\":\"ACTIVE\"}").andExpect(status().isOk());
        json(post("/api/finance/invoices"), invoiceWith("recruitment-tax-invoice", "")).andExpect(status().isCreated());
        request(post("/api/finance/invoices/REF-00001/issue")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Candidate is required by the Recruitment tax invoice template"));
    }

    private static String invoice(String client, String date, String fields) {
        return "{\"clientKey\":\"" + client + "\",\"issueDate\":\"" + date + "\",\"customFields\":{" + fields + "},"
                + "\"lines\":[{\"itemCode\":\"REC-001\",\"description\":\"Recruitment fee\",\"quantity\":1,\"unitPrice\":180000,\"taxRate\":18}]}";
    }

    private static String invoiceWith(String template, String fields) {
        return "{\"clientKey\":\"acme\",\"templateKey\":\"" + template + "\",\"customFields\":{" + fields + "},"
                + "\"lines\":[{\"description\":\"Fee\",\"quantity\":1,\"unitPrice\":100}]}";
    }

    private ResultActions json(MockHttpServletRequestBuilder builder, String body) throws Exception {
        return request(builder.contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions request(MockHttpServletRequestBuilder builder) throws Exception {
        return mvc.perform(builder.header("Authorization", "Bearer admin").header("X-Lexorion-Workspace", "omega")
                .header("X-Lexorion-Organization", "omega"));
    }
}
