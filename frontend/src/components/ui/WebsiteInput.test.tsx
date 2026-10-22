import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  WebsiteInput,
  extractDomainAndPath,
  validateWebsiteInput,
} from "./WebsiteInput";

afterEach(() => {
  cleanup();
});

describe("WebsiteInput - URL normalization & validation logic", () => {
  it("extracts domain and path correctly from full URLs (backward-compat)", () => {
    expect(extractDomainAndPath("https://www.example.com/about")).toBe("www.example.com/about");
    expect(extractDomainAndPath("http://company.org/careers")).toBe("company.org/careers");
    expect(extractDomainAndPath("sub.example.co.uk")).toBe("sub.example.co.uk");
    expect(extractDomainAndPath("")).toBe("");
    expect(extractDomainAndPath(null)).toBe("");
  });

  it("validates plain string addresses with and without protocol", () => {
    const res1 = validateWebsiteInput("example.com");
    expect(res1.isValid).toBe(true);
    expect(res1.value).toBe("example.com");
    expect(res1.canonicalUrl).toBe("https://example.com");

    const res2 = validateWebsiteInput("www.example.com/about/team");
    expect(res2.isValid).toBe(true);
    expect(res2.value).toBe("www.example.com/about/team");

    const res3 = validateWebsiteInput("https://example.com/about");
    expect(res3.isValid).toBe(true);
    expect(res3.value).toBe("https://example.com/about");

    const res4 = validateWebsiteInput("http://sub.domain.org");
    expect(res4.isValid).toBe(true);
    expect(res4.value).toBe("http://sub.domain.org");

    const res5 = validateWebsiteInput("localhost:8080");
    expect(res5.isValid).toBe(true);
    expect(res5.value).toBe("localhost:8080");
  });

  it("rejects unsupported protocols: javascript:, data:, file:, ftp:", () => {
    const js = validateWebsiteInput("javascript:alert(1)");
    expect(js.isValid).toBe(false);
    expect(js.error).toContain("javascript:, data:, and file: are prohibited");

    const data = validateWebsiteInput("data:text/html,test");
    expect(data.isValid).toBe(false);

    const file = validateWebsiteInput("file:///etc/passwd");
    expect(file.isValid).toBe(false);

    const ftp = validateWebsiteInput("ftp://ftp.example.com");
    expect(ftp.isValid).toBe(false);
  });

  it("rejects invalid characters, whitespace, and invalid hostnames", () => {
    const withSpace = validateWebsiteInput("example .com");
    expect(withSpace.isValid).toBe(false);

    const withQuotes = validateWebsiteInput('example.com/<script>');
    expect(withQuotes.isValid).toBe(false);

    const incomplete = validateWebsiteInput("justaword");
    expect(incomplete.isValid).toBe(false);
    expect(incomplete.error).toContain("valid hostname or domain");
  });

  it("enforces 255 character length limit", () => {
    const longDomain = "a".repeat(250) + ".com";
    const res = validateWebsiteInput(longDomain);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("cannot exceed 255 characters");
  });

  it("treats empty input as valid (optional field)", () => {
    const res = validateWebsiteInput("");
    expect(res.isValid).toBe(true);
    expect(res.value).toBe("");
  });
});

describe("WebsiteInput component", () => {
  it("renders as a plain text input without prefix addon", () => {
    const onChange = vi.fn();
    render(<WebsiteInput value="https://lexorion.com" onChange={onChange} />);

    // No protocol-addon UI
    expect(screen.queryByText("https://")).toBeNull();
    const input = screen.getByRole("textbox", { name: /website/i }) as HTMLInputElement;
    expect(input.value).toBe("https://lexorion.com");
  });

  it("accepts and preserves plain string entry without forcing https:// prefix", () => {
    const onChange = vi.fn();
    render(<WebsiteInput value="" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /website/i }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "www.example.com" } });

    expect(onChange).toHaveBeenCalledWith("www.example.com");
  });

  it("accepts and preserves full https:// URL as entered", () => {
    const onChange = vi.fn();
    render(<WebsiteInput value="" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /website/i }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://acme.org/jobs" } });

    expect(onChange).toHaveBeenCalledWith("https://acme.org/jobs");
  });

  it("shows inline validation error on invalid input", () => {
    const onChange = vi.fn();
    render(<WebsiteInput value="" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /website/i });
    fireEvent.change(input, { target: { value: "javascript:evil()" } });

    expect(screen.getByRole("alert").textContent).toContain("javascript:, data:, and file: are prohibited");
  });

  it("allows entering and clearing optional value", () => {
    const onChange = vi.fn();
    render(<WebsiteInput value="example.com" onChange={onChange} />);

    const input = screen.getByRole("textbox", { name: /website/i }) as HTMLInputElement;
    expect(input.value).toBe("example.com");

    fireEvent.change(input, { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });
});
