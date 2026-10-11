import { describe, expect, it } from "vitest";
import { formatIndianMobile, maskIndianMobile, normalizeIndianMobile } from "@/lib/phone";
import { financialYear, formatDateIST, istDateString, istEndOfDay, istStartOfDay } from "@/lib/time";
import { checkGstin, gstinCheckCharacter } from "@/lib/gstin";
import {
  DocumentNumberError,
  formatCreditNoteNumber,
  formatInvoiceNumber,
  formatOrderNumber,
} from "@/server/numbering/format";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["+91 98765 43210", "+919876543210"],
    ["091-98765-43210", null],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["(987) 654-3210", "+919876543210"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(["5876543210", "98765", "98765432101", "", "abcdefghij"])("rejects %s", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });

  it("formats and masks for display", () => {
    expect(formatIndianMobile("+919876543210")).toBe("98765 43210");
    expect(maskIndianMobile("+919876543210")).toBe("98•••••210");
  });
});

describe("IST dates", () => {
  it("shows a 1 am IST order on the right day (UTC would say the day before)", () => {
    const oneAmIst = new Date("2026-10-10T19:30:00Z");
    expect(istDateString(oneAmIst)).toBe("2026-10-11");
    expect(formatDateIST(oneAmIst)).toBe("11 Oct 2026");
  });

  it("makes 'valid until 31 Oct' last until 23:59:59.999 IST", () => {
    expect(istEndOfDay("2026-10-31").toISOString()).toBe("2026-10-31T18:29:59.999Z");
    expect(istStartOfDay("2026-10-31").toISOString()).toBe("2026-10-30T18:30:00.000Z");
  });

  it("rolls the financial year over on 1 April IST", () => {
    expect(financialYear(new Date("2026-03-31T18:29:59Z")).label).toBe("2025-26");
    expect(financialYear(new Date("2026-03-31T18:30:00Z")).label).toBe("2026-27");
    expect(financialYear(new Date("2026-10-11T08:00:00Z"))).toEqual({
      startYear: 2026,
      label: "2026-27",
      short: "26-27",
    });
    expect(financialYear(new Date("2099-06-01T00:00:00Z")).short).toBe("99-00");
  });

  it("rejects malformed dates", () => {
    expect(() => istEndOfDay("31/10/2026")).toThrow(RangeError);
  });
});

describe("checkGstin", () => {
  it("accepts a correctly check-summed GSTIN", () => {
    expect(checkGstin(" 27aapfu0939f1zv ")).toEqual({
      valid: true,
      gstin: "27AAPFU0939F1ZV",
      stateCode: "27",
      pan: "AAPFU0939F",
    });
  });

  it("catches a one-character typo through the check digit", () => {
    const result = checkGstin("27AAPFU0939F1ZW");
    expect(result.valid).toBe(false);
  });

  it("rejects bad shapes and unknown state codes", () => {
    expect(checkGstin("27AAPFU0939F1Z").valid).toBe(false);
    expect(checkGstin("00AAPFU0939F1ZV").valid).toBe(false);
  });

  it("computes the check character", () => {
    expect(gstinCheckCharacter("27AAPFU0939F1Z")).toBe("V");
  });
});

describe("document numbers", () => {
  it("formats order and GST document numbers within 16 characters", () => {
    expect(formatOrderNumber(1)).toBe("HF-100001");
    expect(formatInvoiceNumber("HF", "26-27", 123)).toBe("HF/26-27/000123");
    expect(formatCreditNoteNumber("HF", "26-27", 12)).toBe("HFCN/26-27/00012");
  });

  it("refuses an invoice number longer than GST allows", () => {
    expect(() => formatInvoiceNumber("HASTKALA", "26-27", 1)).toThrow(DocumentNumberError);
  });
});
