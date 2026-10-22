import type { CustomField, TemplateConfig, TemplateLayout } from "./financeApi";

/** A complete config with neutral defaults. The service applies the same defaults to anything left out. */
export function blankTemplateConfig(): TemplateConfig {
  return {
    branding: { logo: null, primaryColor: "#1D2B7A", accentColor: "#7CB342" },
    seller: { legalName: "", tagline: "", subline: "", address: "", phone: "", email: "", website: "", region: "", identifiers: [] },
    document: { title: "Invoice", subtitle: "", copyLabel: "", detailsTitle: "Details" },
    numbering: { pattern: "INV-{SEQ}", padding: 5, fiscalYearStartMonth: 4 },
    tax: { mode: "SIMPLE", label: "Tax" },
    columns: { showItemCode: false, itemCodeLabel: "Code", showHsnSac: false },
    customFields: [],
    paymentDetails: [],
    terms: [],
    defaultNotes: "",
    signatory: { name: "", title: "Authorised signatory", signatureImage: null },
    footerNote: "This is a computer-generated invoice and does not require a physical signature.",
    showAmountInWords: true,
    dateStyle: "MEDIUM",
  };
}

export interface TemplatePreset {
  key: string;
  name: string;
  description: string;
  layout: TemplateLayout;
  apply(config: TemplateConfig): TemplateConfig;
}

const fields = (...items: [label: string, type: CustomField["type"], required?: boolean][]): CustomField[] =>
  items.map(([label, type, required]) => ({ key: fieldKey(label), label, type, required: Boolean(required) }));

/** "Joining date" → "joiningDate": the stable key an invoice stores the value under. */
export function fieldKey(label: string): string {
  const words = label.normalize("NFKD").replaceAll(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
  const key = words.map((word, index) => index === 0 ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1).toLowerCase()).join("");
  return (/^[a-z]/.test(key) ? key : `field${key}`).slice(0, 40) || "field";
}

const indianGst = (config: TemplateConfig): TemplateConfig => ({
  ...config,
  document: { ...config.document, title: "Invoice", subtitle: "Tax invoice", copyLabel: "Original for recipient" },
  numbering: { pattern: "INV/{FY}/{SEQ}", padding: 4, fiscalYearStartMonth: 4 },
  tax: { mode: "GST", label: "GST" },
  seller: { ...config.seller, identifiers: [{ label: "GSTIN", value: "" }, { label: "PAN", value: "" }] },
  paymentDetails: [{ label: "Bank", value: "" }, { label: "A/C No.", value: "" }, { label: "IFSC", value: "" }, { label: "Branch", value: "" }],
  dateStyle: "ORDINAL",
});

/**
 * Starting points by industry. Each sets the fields a business in that industry puts on every bill; everything stays
 * editable. Identifier and bank rows are left blank for the subscriber to fill in.
 */
export const templatePresets: TemplatePreset[] = [
  {
    key: "recruitment", name: "Recruitment & staffing", layout: "MODERN",
    description: "Placement fees per candidate with GST, engagement details and bank transfer instructions.",
    apply: (config) => {
      const base = indianGst(config);
      return { ...base, document: { ...base.document, detailsTitle: "Recruitment engagement" },
        columns: { showItemCode: true, itemCodeLabel: "Code", showHsnSac: true },
        customFields: fields(["Candidate", "TEXT", true], ["Position", "TEXT"], ["Joining date", "DATE"]),
        terms: ["Payment due within 30 days of invoice date.", "Replacement guarantee as per the signed service agreement."] };
    },
  },
  {
    key: "consulting", name: "Consulting & professional services", layout: "CLASSIC",
    description: "Retainers and milestones billed against a project, engagement period and client PO.",
    apply: (config) => {
      const base = indianGst(config);
      return { ...base, document: { ...base.document, detailsTitle: "Engagement" },
        columns: { showItemCode: true, itemCodeLabel: "Code", showHsnSac: true },
        customFields: fields(["Project", "TEXT", true], ["Period from", "DATE"], ["Period to", "DATE"], ["PO number", "TEXT"]),
        terms: ["Payment due within 15 days of invoice date."] };
    },
  },
  {
    key: "it-services", name: "IT services & software", layout: "MODERN",
    description: "Time-and-materials or subscription billing with billing period and hours.",
    apply: (config) => {
      const base = indianGst(config);
      return { ...base, document: { ...base.document, detailsTitle: "Billing period" },
        columns: { showItemCode: true, itemCodeLabel: "Code", showHsnSac: true },
        customFields: fields(["Project", "TEXT"], ["Billing month", "TEXT", true], ["Hours", "NUMBER"], ["PO number", "TEXT"]) };
    },
  },
  {
    key: "agency", name: "Agency & creative", layout: "MINIMAL",
    description: "Campaign and deliverable billing with a clean, minimal look.",
    apply: (config) => ({ ...config, document: { ...config.document, detailsTitle: "Campaign" },
      customFields: fields(["Campaign", "TEXT"], ["Brand", "TEXT"], ["PO number", "TEXT"]),
      terms: ["Payment due within 30 days.", "Usage rights transfer on full payment."] }),
  },
  {
    key: "trading", name: "Trading & distribution", layout: "CLASSIC",
    description: "Goods with HSN codes, delivery details and GST.",
    apply: (config) => {
      const base = indianGst(config);
      return { ...base, document: { ...base.document, detailsTitle: "Dispatch details" },
        columns: { showItemCode: true, itemCodeLabel: "Code", showHsnSac: true },
        customFields: fields(["PO number", "TEXT"], ["Delivery note", "TEXT"], ["Dispatched via", "TEXT"], ["Vehicle number", "TEXT"]) };
    },
  },
  {
    key: "general", name: "General", layout: "MODERN",
    description: "A simple invoice with one tax line. Works for any business and country.",
    apply: (config) => config,
  },
];
