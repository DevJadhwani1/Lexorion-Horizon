// Amounts in words for invoices: "Rupees Two Lakh Twelve Thousand Four Hundred Only".
// Rupees use the Indian system (lakh, crore); every other currency uses thousand, million and billion.

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
  "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const currencies: Record<string, [major: string, minor: string]> = {
  INR: ["Rupees", "Paise"], USD: ["US Dollars", "Cents"], EUR: ["Euros", "Cents"], GBP: ["Pounds", "Pence"],
  AED: ["Dirhams", "Fils"], SGD: ["Singapore Dollars", "Cents"], AUD: ["Australian Dollars", "Cents"], CAD: ["Canadian Dollars", "Cents"],
  JPY: ["Yen", "Sen"], SAR: ["Riyals", "Halalas"], ZAR: ["Rand", "Cents"], NZD: ["New Zealand Dollars", "Cents"],
};

function belowThousand(value: number): string {
  const hundred = Math.floor(value / 100), rest = value % 100;
  const parts: string[] = [];
  if (hundred) parts.push(`${ones[hundred]} Hundred`);
  if (rest) parts.push(rest < 20 ? ones[rest] : `${tens[Math.floor(rest / 10)]}${rest % 10 ? ` ${ones[rest % 10]}` : ""}`);
  return parts.join(" ");
}

function whole(value: number, indian: boolean): string {
  if (value === 0) return "Zero";
  const scales: [number, string][] = indian
    ? [[10_000_000, "Crore"], [100_000, "Lakh"], [1000, "Thousand"]]
    : [[1_000_000_000, "Billion"], [1_000_000, "Million"], [1000, "Thousand"]];
  const parts: string[] = [];
  let rest = value;
  for (const [size, name] of scales) {
    const count = Math.floor(rest / size);
    if (count) { parts.push(`${whole(count, indian)} ${name}`); rest %= size; }
  }
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

export function amountInWords(amount: number, currency: string): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const major = Math.floor(cents / 100), minor = cents % 100;
  const [majorName, minorName] = currencies[currency.toUpperCase()] ?? [currency.toUpperCase(), "Cents"];
  const indian = currency.toUpperCase() === "INR";
  return `${majorName} ${whole(major, indian)}${minor ? ` and ${whole(minor, indian)} ${minorName}` : ""} Only`;
}
