import { describe, expect, it } from "vitest";
import { buildQuote, type QuoteInput, type QuoteLineInput, type QuoteSettings } from "@/server/orders/quote";
import type { CouponDef } from "@/server/coupons/evaluate";
import type { TaxBand } from "@/server/tax/gst";

const BANDS: TaxBand[] = [
  { minUnitValue: 0, maxUnitValue: 250_000, rateBps: 500 },
  { minUnitValue: 250_001, maxUnitValue: null, rateBps: 1800 },
];

const SETTINGS: QuoteSettings = {
  wholesalePricesIncludeTax: false,
  freeShippingThreshold: 99_900,
  retailShippingFee: 7_900,
  wholesaleShippingFee: 0,
  codEnabled: true,
  codFee: 4_900,
  codMaxOrderValue: 1_000_000,
  giftWrapFee: 5_000,
  feeTaxMode: "PROPORTIONAL",
  roundTotalToRupee: false,
};

const kurti = (over: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
  key: "kurti",
  categoryId: "cat-kurtis",
  retailUnitPrice: 129_900,
  quantity: 1,
  taxBands: BANDS,
  isCodAllowed: true,
  ...over,
});

const saree = (over: Partial<QuoteLineInput> = {}): QuoteLineInput => ({
  key: "saree",
  categoryId: "cat-sarees",
  retailUnitPrice: 289_900,
  quantity: 1,
  taxBands: BANDS,
  isCodAllowed: true,
  ...over,
});

const base = (over: Partial<QuoteInput> = {}): QuoteInput => ({
  lines: [kurti()],
  customerType: "RETAIL",
  intraState: true,
  paymentMethod: "ONLINE",
  giftWrap: false,
  coupon: null,
  settings: SETTINGS,
  ...over,
});

const coupon = (over: Partial<CouponDef> = {}): CouponDef => ({
  code: "WELCOME10",
  type: "PERCENT",
  value: 10,
  maxDiscount: null,
  minOrderValue: 0,
  audience: "ALL",
  firstOrderOnly: false,
  usageLimit: null,
  usedCount: 0,
  perUserLimit: 1,
  startsAt: new Date("2026-01-01T00:00:00Z"),
  endsAt: null,
  isActive: true,
  categoryIds: [],
  ...over,
});

const shopper = {
  now: new Date("2026-10-11T08:00:00Z"),
  customerType: "RETAIL" as const,
  shopperKnown: true,
  priorRedemptionsByShopper: 0,
  shopperHasPriorOrders: false,
};

describe("buildQuote — retail", () => {
  it("charges exactly the shown price: GST is inside, never added on top (fixes C4)", () => {
    const q = buildQuote(base());
    expect(q.pricesIncludeTax).toBe(true);
    expect(q.itemsSubtotal).toBe(129_900);
    expect(q.shippingFee).toBe(0); // ₹1,299 ≥ ₹999 free-shipping threshold
    expect(q.grandTotal).toBe(129_900);
    expect(q.taxableValue + q.cgstTotal + q.sgstTotal + q.igstTotal).toBe(q.grandTotal);
  });

  it("adds tax-inclusive shipping below the free-shipping threshold", () => {
    const q = buildQuote(base({ lines: [kurti({ retailUnitPrice: 64_900 })] }));
    expect(q.shippingFee).toBe(7_900);
    expect(q.grandTotal).toBe(64_900 + 7_900);
    expect(q.fees[0]).toMatchObject({ kind: "SHIPPING", amount: 7_900 });
  });

  it("calculates GST on the price AFTER the coupon discount", () => {
    const q = buildQuote(base({ coupon: { def: coupon(), context: shopper } }));
    expect(q.discountTotal).toBe(12_990);
    expect(q.lines[0]!.lineTotal).toBe(129_900 - 12_990);
    // 116910 / 1.05 = 111343 taxable, 5567 tax
    expect(q.lines[0]!.taxableValue).toBe(111_343);
    expect(q.cgstTotal + q.sgstTotal).toBe(5_567);
    expect(q.grandTotal).toBe(116_910);
  });

  it("restricts a category coupon to that category and splits it across its lines", () => {
    const q = buildQuote(
      base({
        lines: [kurti(), saree()],
        coupon: { def: coupon({ categoryIds: ["cat-sarees"] }), context: shopper },
      }),
    );
    expect(q.lines.find((l) => l.key === "kurti")!.discountAllocated).toBe(0);
    expect(q.lines.find((l) => l.key === "saree")!.discountAllocated).toBe(28_990);
  });

  it("reports why a coupon fails without breaking the quote", () => {
    const q = buildQuote(
      base({ coupon: { def: coupon({ minOrderValue: 200_000 }), context: shopper } }),
    );
    expect(q.coupon).toBeNull();
    expect(q.couponError).toBe("Add ₹701 more to use this coupon.");
    expect(q.grandTotal).toBe(129_900);
  });

  it("applies a free-shipping coupon", () => {
    const q = buildQuote(
      base({
        lines: [kurti({ retailUnitPrice: 64_900 })],
        coupon: { def: coupon({ type: "FREE_SHIPPING", value: 0 }), context: shopper },
      }),
    );
    expect(q.shippingFee).toBe(0);
    expect(q.coupon?.freeShipping).toBe(true);
  });

  it("uses IGST for delivery outside Rajasthan", () => {
    const q = buildQuote(base({ intraState: false, lines: [kurti(), saree()] }));
    expect(q.cgstTotal + q.sgstTotal).toBe(0);
    expect(q.igstTotal).toBeGreaterThan(0);
  });

  it("adds the COD fee only for COD and only when COD is allowed", () => {
    expect(buildQuote(base({ paymentMethod: "COD" })).codFee).toBe(4_900);
    const blocked = buildQuote(
      base({ paymentMethod: "COD", lines: [kurti({ isCodAllowed: false })] }),
    );
    expect(blocked.cod.available).toBe(false);
    expect(blocked.codFee).toBe(0);
  });

  it("blocks COD above the COD limit", () => {
    const q = buildQuote(base({ lines: [saree({ quantity: 4 })], paymentMethod: "COD" }));
    expect(q.cod.available).toBe(false);
    expect(q.cod.reason).toMatch(/up to ₹10,000/);
  });

  it("blocks checkout when a product has no GST rate configured (never 0 % silently)", () => {
    const q = buildQuote(base({ lines: [kurti({ taxBands: [] })] }));
    expect(q.blockingIssues).toHaveLength(1);
  });

  it("rounds the total to the rupee when the setting is on", () => {
    const q = buildQuote(
      base({
        lines: [kurti({ retailUnitPrice: 64_950 })],
        settings: { ...SETTINGS, roundTotalToRupee: true },
      }),
    );
    expect(q.grandTotal % 100).toBe(0);
    expect(q.grandTotal - q.roundOff).toBe(64_950 + 7_900);
  });
});

describe("buildQuote — wholesale (+ GST)", () => {
  const wholesale = (over: Partial<QuoteInput> = {}) =>
    base({ customerType: "WHOLESALE", intraState: false, ...over });

  it("prices at the tier price and adds GST on top", () => {
    const q = buildQuote(
      wholesale({ lines: [kurti({ quantity: 10, wholesaleUnitPrice: 74_900, wholesaleMinQty: 10 })] }),
    );
    expect(q.pricesIncludeTax).toBe(false);
    expect(q.lines[0]).toMatchObject({ priceSource: "WHOLESALE", unitPrice: 74_900, lineSubtotal: 749_000 });
    expect(q.igstTotal).toBe(37_450);
    expect(q.grandTotal).toBe(786_450);
  });

  it("falls back to the retail price (same rupees to pay) below the minimum, with a hint", () => {
    const q = buildQuote(
      wholesale({ lines: [kurti({ quantity: 6, wholesaleUnitPrice: null, wholesaleMinQty: 10 })] }),
    );
    expect(q.lines[0]!.priceSource).toBe("RETAIL");
    expect(q.lines[0]!.note).toBe("Add 4 more for the wholesale price.");
    // Converted to pre-tax and GST added back: within a paisa per piece of retail.
    expect(Math.abs(q.lines[0]!.lineTotal - 129_900 * 6)).toBeLessThanOrEqual(6);
  });

  it("uses the wholesale shipping fee, not the retail threshold", () => {
    const q = buildQuote(
      wholesale({
        lines: [kurti({ quantity: 10, wholesaleUnitPrice: 74_900, wholesaleMinQty: 10 })],
        settings: { ...SETTINGS, wholesaleShippingFee: 50_000 },
      }),
    );
    // ₹500 freight + 5 % GST on top in a "+ GST" order.
    expect(q.shippingFee).toBe(52_500);
  });
});

describe("buildQuote — packs", () => {
  it("judges the GST band per piece, not per pack", () => {
    // A ₹4,000 pack of two ₹2,000 kurtis: 5% per piece, not 18% on ₹4,000.
    const pack = buildQuote(base({ lines: [kurti({ retailUnitPrice: 400_000, piecesPerUnit: 2 })] }));
    expect(pack.lines[0]!.rateBps).toBe(500);

    const single = buildQuote(base({ lines: [kurti({ retailUnitPrice: 400_000 })] }));
    expect(single.lines[0]!.rateBps).toBe(1800);
  });
});

describe("buildQuote — invariants", () => {
  it("always balances: Σ taxable + Σ GST + roundOff = grand total", () => {
    const cases: QuoteInput[] = [
      base({ lines: [kurti(), saree({ quantity: 2 })], paymentMethod: "COD", giftWrap: true }),
      base({ lines: [kurti({ retailUnitPrice: 33_300, quantity: 3 })], coupon: { def: coupon({ type: "FLAT", value: 5_000 }), context: shopper } }),
      base({ customerType: "WHOLESALE", lines: [kurti({ quantity: 12, wholesaleUnitPrice: 74_900 }), saree({ quantity: 2 })] }),
    ];
    for (const input of cases) {
      const q = buildQuote(input);
      expect(q.taxableValue + q.cgstTotal + q.sgstTotal + q.igstTotal + q.roundOff).toBe(q.grandTotal);
      expect(q.lines.reduce((s, l) => s + l.lineTotal, 0) + q.fees.reduce((s, f) => s + f.amount, 0) + q.roundOff).toBe(q.grandTotal);
    }
  });
});
