import { describe, expect, it } from "vitest";
import { amountInWords } from "./amountInWords";

describe("amountInWords", () => {
  it("uses lakh and crore for rupees", () => {
    expect(amountInWords(212400, "INR")).toBe("Rupees Two Lakh Twelve Thousand Four Hundred Only");
    expect(amountInWords(12_34_56_789.5, "INR")).toBe("Rupees Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine and Fifty Paise Only");
  });
  it("uses millions for other currencies and handles cents and zero", () => {
    expect(amountInWords(1_250_000.05, "USD")).toBe("US Dollars One Million Two Hundred Fifty Thousand and Five Cents Only");
    expect(amountInWords(0, "EUR")).toBe("Euros Zero Only");
    expect(amountInWords(19, "XYZ")).toBe("XYZ Nineteen Only");
  });
});
