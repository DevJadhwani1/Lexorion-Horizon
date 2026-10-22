// Industry Taxonomy Dataset
// Contains the 18 standard industry groups and canonical sub-industries.

export interface IndustryOption {
  value: string;
  label: string;
  group: string;
}

export interface IndustryGroup {
  group: string;
  options: IndustryOption[];
}

export const INDUSTRY_TAXONOMY: IndustryGroup[] = [
  {
    group: "Agriculture, forestry and fishing",
    options: [
      { value: "Crop & Animal Production", label: "Crop & Animal Production", group: "Agriculture, forestry and fishing" },
      { value: "Forestry & Logging", label: "Forestry & Logging", group: "Agriculture, forestry and fishing" },
      { value: "Fishing, Hunting & Aquaculture", label: "Fishing, Hunting & Aquaculture", group: "Agriculture, forestry and fishing" },
      { value: "Agriculture & AgTech", label: "Agriculture & AgTech", group: "Agriculture, forestry and fishing" },
    ],
  },
  {
    group: "Mining and natural resources",
    options: [
      { value: "Oil & Gas Extraction", label: "Oil & Gas Extraction", group: "Mining and natural resources" },
      { value: "Mining (Metals & Minerals)", label: "Mining (Metals & Minerals)", group: "Mining and natural resources" },
      { value: "Quarrying & Aggregate", label: "Quarrying & Aggregate", group: "Mining and natural resources" },
      { value: "Natural Resource Exploration", label: "Natural Resource Exploration", group: "Mining and natural resources" },
    ],
  },
  {
    group: "Manufacturing",
    options: [
      { value: "Aerospace & Defense", label: "Aerospace & Defense", group: "Manufacturing" },
      { value: "Automotive & Parts", label: "Automotive & Parts", group: "Manufacturing" },
      { value: "Chemicals & Petrochemicals", label: "Chemicals & Petrochemicals", group: "Manufacturing" },
      { value: "Consumer Electronics & Hardware", label: "Consumer Electronics & Hardware", group: "Manufacturing" },
      { value: "Food & Beverage Manufacturing", label: "Food & Beverage Manufacturing", group: "Manufacturing" },
      { value: "Industrial Machinery & Equipment", label: "Industrial Machinery & Equipment", group: "Manufacturing" },
      { value: "Pharmaceutical & Medical Device Mfg", label: "Pharmaceutical & Medical Device Mfg", group: "Manufacturing" },
      { value: "Textiles, Apparel & Luxury Goods", label: "Textiles, Apparel & Luxury Goods", group: "Manufacturing" },
    ],
  },
  {
    group: "Energy and utilities",
    options: [
      { value: "Renewable Energy (Solar, Wind, Hydro)", label: "Renewable Energy (Solar, Wind, Hydro)", group: "Energy and utilities" },
      { value: "Electric Utilities & Grid Operations", label: "Electric Utilities & Grid Operations", group: "Energy and utilities" },
      { value: "Natural Gas Distribution", label: "Natural Gas Distribution", group: "Energy and utilities" },
      { value: "Water, Sewage & Waste Management", label: "Water, Sewage & Waste Management", group: "Energy and utilities" },
    ],
  },
  {
    group: "Construction and real estate",
    options: [
      { value: "Commercial Construction & Contracting", label: "Commercial Construction & Contracting", group: "Construction and real estate" },
      { value: "Residential Construction", label: "Residential Construction", group: "Construction and real estate" },
      { value: "Civil Engineering & Infrastructure", label: "Civil Engineering & Infrastructure", group: "Construction and real estate" },
      { value: "Real Estate Development & Brokerage", label: "Real Estate Development & Brokerage", group: "Construction and real estate" },
      { value: "Property & Facility Management", label: "Property & Facility Management", group: "Construction and real estate" },
    ],
  },
  {
    group: "Wholesale and retail trade",
    options: [
      { value: "E-commerce & Digital Retail", label: "E-commerce & Digital Retail", group: "Wholesale and retail trade" },
      { value: "Consumer Goods & Department Stores", label: "Consumer Goods & Department Stores", group: "Wholesale and retail trade" },
      { value: "Grocery & Specialty Food Retail", label: "Grocery & Specialty Food Retail", group: "Wholesale and retail trade" },
      { value: "Wholesale B2B Distribution", label: "Wholesale B2B Distribution", group: "Wholesale and retail trade" },
    ],
  },
  {
    group: "Transportation and logistics",
    options: [
      { value: "Aviation & Airlines", label: "Aviation & Airlines", group: "Transportation and logistics" },
      { value: "Freight Trucking & Ground Delivery", label: "Freight Trucking & Ground Delivery", group: "Transportation and logistics" },
      { value: "Maritime & Ocean Shipping", label: "Maritime & Ocean Shipping", group: "Transportation and logistics" },
      { value: "Warehousing, 3PL & Fulfillment", label: "Warehousing, 3PL & Fulfillment", group: "Transportation and logistics" },
      { value: "Postal & Courier Services", label: "Postal & Courier Services", group: "Transportation and logistics" },
    ],
  },
  {
    group: "Hospitality, travel and food services",
    options: [
      { value: "Hotels, Resorts & Lodging", label: "Hotels, Resorts & Lodging", group: "Hospitality, travel and food services" },
      { value: "Restaurants, Bars & Food Service", label: "Restaurants, Bars & Food Service", group: "Hospitality, travel and food services" },
      { value: "Travel Agencies & Tour Operators", label: "Travel Agencies & Tour Operators", group: "Hospitality, travel and food services" },
      { value: "Event Planning & Entertainment Venues", label: "Event Planning & Entertainment Venues", group: "Hospitality, travel and food services" },
    ],
  },
  {
    group: "Information technology and software",
    options: [
      { value: "Information technology and software", label: "Information Technology (General)", group: "Information technology and software" },
      { value: "Enterprise Software & SaaS", label: "Enterprise Software & SaaS", group: "Information technology and software" },
      { value: "Cloud Infrastructure & Hosting", label: "Cloud Infrastructure & Hosting", group: "Information technology and software" },
      { value: "Cybersecurity & Data Privacy", label: "Cybersecurity & Data Privacy", group: "Information technology and software" },
      { value: "Artificial Intelligence & Data Analytics", label: "Artificial Intelligence & Data Analytics", group: "Information technology and software" },
      { value: "IT Consulting & Managed Services", label: "IT Consulting & Managed Services", group: "Information technology and software" },
      { value: "Fintech & Payments Technology", label: "Fintech & Payments Technology", group: "Information technology and software" },
    ],
  },
  {
    group: "Telecommunications",
    options: [
      { value: "Wireless & Mobile Networks", label: "Wireless & Mobile Networks", group: "Telecommunications" },
      { value: "Broadband & Fiber Providers", label: "Broadband & Fiber Providers", group: "Telecommunications" },
      { value: "Satellite & Microwave Communications", label: "Satellite & Microwave Communications", group: "Telecommunications" },
      { value: "Telecom Infrastructure & Equipment", label: "Telecom Infrastructure & Equipment", group: "Telecommunications" },
    ],
  },
  {
    group: "Financial services and insurance",
    options: [
      { value: "Banking (Commercial & Retail)", label: "Banking (Commercial & Retail)", group: "Financial services and insurance" },
      { value: "Investment Banking & Capital Markets", label: "Investment Banking & Capital Markets", group: "Financial services and insurance" },
      { value: "Asset & Wealth Management", label: "Asset & Wealth Management", group: "Financial services and insurance" },
      { value: "Venture Capital & Private Equity", label: "Venture Capital & Private Equity", group: "Financial services and insurance" },
      { value: "Insurance Underwriting & Brokerage", label: "Insurance Underwriting & Brokerage", group: "Financial services and insurance" },
      { value: "Accounting & Audit Services", label: "Accounting & Audit Services", group: "Financial services and insurance" },
    ],
  },
  {
    group: "Professional and consulting services",
    options: [
      { value: "Management Consulting", label: "Management Consulting", group: "Professional and consulting services" },
      { value: "Legal Services & Law Practices", label: "Legal Services & Law Practices", group: "Professional and consulting services" },
      { value: "Human Resources & Staffing", label: "Human Resources & Staffing", group: "Professional and consulting services" },
      { value: "Marketing, Advertising & PR", label: "Marketing, Advertising & PR", group: "Professional and consulting services" },
      { value: "Architecture, Engineering & Design", label: "Architecture, Engineering & Design", group: "Professional and consulting services" },
      { value: "Research & Advisory Services", label: "Research & Advisory Services", group: "Professional and consulting services" },
    ],
  },
  {
    group: "Education and training",
    options: [
      { value: "Higher Education & Universities", label: "Higher Education & Universities", group: "Education and training" },
      { value: "K-12 Primary & Secondary Education", label: "K-12 Primary & Secondary Education", group: "Education and training" },
      { value: "EdTech & Online Learning Platforms", label: "EdTech & Online Learning Platforms", group: "Education and training" },
      { value: "Vocational & Professional Training", label: "Vocational & Professional Training", group: "Education and training" },
    ],
  },
  {
    group: "Healthcare and life sciences",
    options: [
      { value: "Hospitals & Health Systems", label: "Hospitals & Health Systems", group: "Healthcare and life sciences" },
      { value: "Outpatient Clinics & Medical Practices", label: "Outpatient Clinics & Medical Practices", group: "Healthcare and life sciences" },
      { value: "Biotechnology & Genomics", label: "Biotechnology & Genomics", group: "Healthcare and life sciences" },
      { value: "Pharmaceuticals & Clinical Trials", label: "Pharmaceuticals & Clinical Trials", group: "Healthcare and life sciences" },
      { value: "Digital Health & Telemedicine", label: "Digital Health & Telemedicine", group: "Healthcare and life sciences" },
    ],
  },
  {
    group: "Media and entertainment",
    options: [
      { value: "Film, Television & Video Production", label: "Film, Television & Video Production", group: "Media and entertainment" },
      { value: "Music Production & Sound Recording", label: "Music Production & Sound Recording", group: "Media and entertainment" },
      { value: "Video Games & Interactive Entertainment", label: "Video Games & Interactive Entertainment", group: "Media and entertainment" },
      { value: "Publishing (Books, Periodicals, Digital)", label: "Publishing (Books, Periodicals, Digital)", group: "Media and entertainment" },
      { value: "News & Broadcast Media", label: "News & Broadcast Media", group: "Media and entertainment" },
    ],
  },
  {
    group: "Government and public administration",
    options: [
      { value: "National & Federal Government Agencies", label: "National & Federal Government Agencies", group: "Government and public administration" },
      { value: "Regional & Municipal Governments", label: "Regional & Municipal Governments", group: "Government and public administration" },
      { value: "Public Safety, Law Enforcement & Fire", label: "Public Safety, Law Enforcement & Fire", group: "Government and public administration" },
      { value: "International Organizations & Diplomacy", label: "International Organizations & Diplomacy", group: "Government and public administration" },
    ],
  },
  {
    group: "Nonprofit and social services",
    options: [
      { value: "Charitable Nonprofits & Foundations", label: "Charitable Nonprofits & Foundations", group: "Nonprofit and social services" },
      { value: "Community Advocacy & Civil Rights", label: "Community Advocacy & Civil Rights", group: "Nonprofit and social services" },
      { value: "Social Services & Relief Assistance", label: "Social Services & Relief Assistance", group: "Nonprofit and social services" },
      { value: "Trade Associations & Professional Bodies", label: "Trade Associations & Professional Bodies", group: "Nonprofit and social services" },
    ],
  },
  {
    group: "Other",
    options: [
      { value: "Other", label: "Other / Uncategorized", group: "Other" },
    ],
  },
];

// Flat list of all canonical industry options
export const ALL_INDUSTRY_OPTIONS: IndustryOption[] = INDUSTRY_TAXONOMY.flatMap((g) => g.options);

// Helper to find or adapt an existing value (including legacy custom strings)
export function findIndustryOption(value: string | null | undefined): IndustryOption | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  const canonical = ALL_INDUSTRY_OPTIONS.find(
    (opt) => opt.value.toLowerCase() === trimmed.toLowerCase() || opt.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (canonical) return canonical;

  // Check if it matches any group name
  const groupMatch = INDUSTRY_TAXONOMY.find(
    (g) => g.group.toLowerCase() === trimmed.toLowerCase()
  );
  if (groupMatch) {
    return {
      value: groupMatch.group,
      label: groupMatch.group,
      group: groupMatch.group,
    };
  }

  // Preserve legacy stored value safely without dropping it
  return {
    value: trimmed,
    label: trimmed,
    group: "Existing Stored Value",
  };
}
