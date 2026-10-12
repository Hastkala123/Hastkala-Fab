import { describe, expect, it } from "vitest";
import { tierPricesFor, type Viewer } from "@/server/catalog/pricing";
import { confirmThreshold } from "@/server/payments/status";
import { priceListCsv } from "@/server/wholesale/price-list";
import { advanceAmount, paymentOptions, type BuyerTerms } from "@/server/wholesale/terms";
import { parseFaq, whatsappLink } from "@/lib/wholesale-content";

const terms = (over: Partial<BuyerTerms> = {}): BuyerTerms => ({
  terms: "PREPAID",
  advancePercent: 30,
  creditLimit: null,
  creditDays: 30,
  ...over,
});

describe("advance on advance + balance terms", () => {
  it("is the percentage, rounded up to the rupee", () => {
    expect(advanceAmount(1_000_000, terms({ terms: "ADVANCE_BALANCE" }))).toBe(300_000);
    expect(advanceAmount(123_456, terms({ terms: "ADVANCE_BALANCE" }))).toBe(37_100);
  });
  it("is nothing on other terms, for retail, or when it would be the whole order", () => {
    expect(advanceAmount(1_000_000, terms())).toBe(0);
    expect(advanceAmount(1_000_000, null)).toBe(0);
    expect(advanceAmount(100, terms({ terms: "ADVANCE_BALANCE", advancePercent: 99 }))).toBe(0);
  });
  it("sets what must be paid before the order is confirmed", () => {
    expect(confirmThreshold({ grandTotal: 1_000_000, advanceAmount: 300_000 })).toBe(300_000);
    expect(confirmThreshold({ grandTotal: 1_000_000, advanceAmount: 0 })).toBe(1_000_000);
  });
});

describe("ways to pay at checkout", () => {
  const base = {
    onlineAvailable: true,
    cod: { available: true, reason: null, fee: 0 },
    bankTransferEnabled: true,
    wholesaleCodAllowed: false,
    creditRemaining: null,
    orderTotal: 500_000,
  };
  const values = (opts: ReturnType<typeof paymentOptions>) => opts.map((o) => o.value);

  it("gives retail shoppers online and COD only", () => {
    expect(values(paymentOptions({ ...base, wholesale: null }))).toEqual(["UPI", "CARD", "NETBANKING", "COD"]);
  });
  it("adds bank transfer for wholesale buyers, and COD only if allowed", () => {
    expect(values(paymentOptions({ ...base, wholesale: terms() }))).toEqual(["UPI", "CARD", "NETBANKING", "BANK_TRANSFER"]);
    expect(values(paymentOptions({ ...base, wholesale: terms(), wholesaleCodAllowed: true }))).toContain("COD");
    expect(values(paymentOptions({ ...base, wholesale: terms(), bankTransferEnabled: false }))).not.toContain("BANK_TRANSFER");
  });
  it("offers credit only on credit terms, and only while the order fits the limit", () => {
    const fits = paymentOptions({ ...base, wholesale: terms({ terms: "CREDIT" }), creditRemaining: 600_000 });
    expect(fits.find((o) => o.value === "CREDIT")?.available).toBe(true);
    const over = paymentOptions({ ...base, wholesale: terms({ terms: "CREDIT" }), creditRemaining: 400_000 });
    expect(over.find((o) => o.value === "CREDIT")).toMatchObject({ available: false });
    const unlimited = paymentOptions({ ...base, wholesale: terms({ terms: "CREDIT" }), creditRemaining: null });
    expect(unlimited.find((o) => o.value === "CREDIT")?.available).toBe(true);
  });
  it("marks online methods unavailable when the gateway is off", () => {
    const options = paymentOptions({ ...base, wholesale: null, onlineAvailable: false });
    expect(options.filter((o) => !o.available).map((o) => o.value)).toEqual(["UPI", "CARD", "NETBANKING"]);
  });
});

describe("tier prices", () => {
  const rows = [
    { priceTierId: "std", minQuantity: 10, unitPrice: 80_000 },
    { priceTierId: "std", minQuantity: 50, unitPrice: 70_000 },
    { priceTierId: "gold", minQuantity: 10, unitPrice: 75_000 },
  ];
  const viewer = (priceTierId: string | null): Viewer => ({ wholesale: true, priceTierId, defaultTierId: "std" });

  it("uses the buyer's own tier when the design has prices in it", () => {
    expect(tierPricesFor(rows, viewer("gold")).map((r) => r.unitPrice)).toEqual([75_000]);
  });
  it("falls back to the default tier, never mixing the two", () => {
    expect(tierPricesFor(rows, viewer("silver")).map((r) => r.unitPrice)).toEqual([80_000, 70_000]);
  });
  it("gives retail shoppers no trade prices", () => {
    expect(tierPricesFor(rows, { wholesale: false, priceTierId: null, defaultTierId: null })).toEqual([]);
  });
});

describe("wholesale page text", () => {
  it("reads FAQs written one per line", () => {
    expect(parseFaq("Who? | Shops.\nbroken line\n | no question\nHow? |  Online.  ")).toEqual([
      { question: "Who?", answer: "Shops." },
      { question: "How?", answer: "Online." },
    ]);
  });
  it("builds WhatsApp links from numbers written any way", () => {
    expect(whatsappLink("+91 98765 43210", "hi")).toBe("https://wa.me/919876543210?text=hi");
    expect(whatsappLink("098765-43210", "hi")).toBe("https://wa.me/919876543210?text=hi");
    expect(whatsappLink("12345", "hi")).toBeNull();
  });
});

describe("price list CSV", () => {
  it("quotes commas and neutralises spreadsheet formulas", () => {
    const csv = priceListCsv(
      [
        {
          id: "p1",
          title: '=HYPERLINK("x"), "Indigo" kurti',
          slug: "x",
          categoryName: "Kurtis",
          categoryId: "c",
          image: null,
          retailPrice: 129_900,
          minQuantity: 10,
          prices: [{ minQuantity: 10, unitPrice: 80_000 }],
          variants: [{ id: "v1", sku: "K-1-M", label: "M", stock: 4 }],
        },
      ],
      true,
    );
    const [header, row] = csv.split("\r\n");
    expect(header).toContain("Break 1 price per piece (Rs, + GST)");
    expect(row).toBe(`Kurtis,"'=HYPERLINK(""x""), ""Indigo"" kurti",K-1-M,M,4,10,10,800.00,1299.00`);
  });
});
