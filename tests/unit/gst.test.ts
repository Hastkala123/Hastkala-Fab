import { describe, expect, it } from "vitest";
import {
  allocateProportionally,
  computeFeeTax,
  computeLineTax,
  extractTaxable,
  roundToRupee,
  selectRate,
  splitTax,
  TaxConfigError,
  type TaxBand,
} from "@/server/tax/gst";

/** Development placeholder bands (₹2,500 per-piece boundary, 5 % / 18 %). */
const APPAREL: TaxBand[] = [
  { minUnitValue: 0, maxUnitValue: 250_000, rateBps: 500 },
  { minUnitValue: 250_001, maxUnitValue: null, rateBps: 1800 },
];

const RETAIL_RAJASTHAN = { pricesIncludeTax: true, intraState: true };
const RETAIL_OTHER_STATE = { pricesIncludeTax: true, intraState: false };
const WHOLESALE_OTHER_STATE = { pricesIncludeTax: false, intraState: false };

describe("extractTaxable", () => {
  it("removes 5 % from an inclusive price", () => {
    expect(extractTaxable(105_000, 500)).toBe(100_000);
  });
  it("rounds to the nearest paisa", () => {
    // 1299.00 / 1.05 = 1237.142857… → 123714 paise
    expect(extractTaxable(129_900, 500)).toBe(123_714);
  });
});

describe("splitTax", () => {
  it("halves intra-state tax into CGST + SGST, odd paisa to SGST", () => {
    expect(splitTax(6_187, true)).toEqual({ cgst: 3_093, sgst: 3_094, igst: 0 });
  });
  it("puts inter-state tax entirely into IGST", () => {
    expect(splitTax(6_187, false)).toEqual({ cgst: 0, sgst: 0, igst: 6_187 });
  });
});

describe("selectRate", () => {
  it("throws when no rate is configured (never silently 0 %)", () => {
    expect(() => selectRate(100_000, [], true)).toThrow(TaxConfigError);
  });

  it("uses the low band for a ₹1,299 kurti", () => {
    expect(selectRate(129_900, APPAREL, true)).toEqual({ rateBps: 500, boundaryAmbiguous: false });
  });

  it("uses the high band for a ₹4,000 saree", () => {
    expect(selectRate(400_000, APPAREL, true)).toEqual({ rateBps: 1800, boundaryAmbiguous: false });
  });

  it("flags the inclusive-price gap between the bands and uses the higher rate", () => {
    // ₹2,700 incl.: at 5 % taxable is ₹2,571 (> ₹2,500, not low band);
    // at 18 % taxable is ₹2,288 (≤ ₹2,500, not high band) — neither fits.
    expect(selectRate(270_000, APPAREL, true)).toEqual({ rateBps: 1800, boundaryAmbiguous: true });
  });

  it("tests exclusive (wholesale) prices directly against the bands", () => {
    expect(selectRate(250_000, APPAREL, false).rateBps).toBe(500);
    expect(selectRate(250_001, APPAREL, false).rateBps).toBe(1800);
  });
});

describe("computeLineTax", () => {
  it("extracts GST from a retail line delivered in Rajasthan", () => {
    const line = computeLineTax(129_900, 1, APPAREL, RETAIL_RAJASTHAN);
    expect(line).toMatchObject({
      rateBps: 500,
      taxableValue: 123_714,
      tax: 6_186,
      cgst: 3_093,
      sgst: 3_093,
      igst: 0,
      total: 129_900, // the customer pays exactly the shown price
    });
  });

  it("charges IGST for delivery outside Rajasthan, same total", () => {
    const line = computeLineTax(259_800, 2, APPAREL, RETAIL_OTHER_STATE);
    expect(line.igst).toBe(line.tax);
    expect(line.cgst + line.sgst).toBe(0);
    expect(line.total).toBe(259_800);
  });

  it("picks the rate from the per-piece value, not the line total", () => {
    // 3 × ₹1,299 = ₹3,897 line, but each piece is under the boundary.
    expect(computeLineTax(389_700, 3, APPAREL, RETAIL_RAJASTHAN).rateBps).toBe(500);
  });

  it("adds GST on top of a wholesale (+ GST) line", () => {
    const line = computeLineTax(749_000, 10, APPAREL, WHOLESALE_OTHER_STATE);
    expect(line).toMatchObject({ rateBps: 500, taxableValue: 749_000, tax: 37_450, igst: 37_450 });
    expect(line.total).toBe(786_450);
  });

  it("always satisfies taxable + tax = total and the split sums to tax", () => {
    for (let paise = 1; paise < 600_000; paise += 997) {
      for (const mode of [RETAIL_RAJASTHAN, RETAIL_OTHER_STATE, WHOLESALE_OTHER_STATE]) {
        const t = computeLineTax(paise, 1, APPAREL, mode);
        expect(t.taxableValue + t.tax).toBe(t.total);
        expect(t.cgst + t.sgst + t.igst).toBe(t.tax);
        if (mode.pricesIncludeTax) expect(t.total).toBe(paise);
      }
    }
  });

  it("rejects negative, fractional and zero-quantity input", () => {
    expect(() => computeLineTax(-1, 1, APPAREL, RETAIL_RAJASTHAN)).toThrow(RangeError);
    expect(() => computeLineTax(10.5, 1, APPAREL, RETAIL_RAJASTHAN)).toThrow(RangeError);
    expect(() => computeLineTax(100, 0, APPAREL, RETAIL_RAJASTHAN)).toThrow(RangeError);
  });
});

describe("allocateProportionally", () => {
  it("splits exactly, with no paisa lost or created", () => {
    const parts = allocateProportionally(10_000, [129_900, 289_900, 149_900]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10_000);
  });

  it("is deterministic on ties (earlier lines first)", () => {
    expect(allocateProportionally(1, [1, 1])).toEqual([1, 0]);
    expect(allocateProportionally(5, [1, 1, 1])).toEqual([2, 2, 1]);
  });

  it("returns zeros for a zero amount or zero weights", () => {
    expect(allocateProportionally(0, [5, 5])).toEqual([0, 0]);
    expect(allocateProportionally(100, [0, 0])).toEqual([0, 0]);
  });
});

describe("computeFeeTax", () => {
  const lines = [
    { lineNet: 129_900, rateBps: 500 },
    { lineNet: 400_000, rateBps: 1800 },
  ];

  it("taxes shipping proportionally across line rates", () => {
    // ₹79 split by line value → ₹19.37 at 5 % and ₹59.63 at 18 %:
    // 1937 → taxable 1845 (tax 92); 5963 → taxable 5053 (tax 910).
    const fee = computeFeeTax(7_900, lines, RETAIL_RAJASTHAN, "PROPORTIONAL");
    expect(fee).toMatchObject({ taxableValue: 6_898, tax: 1_002, total: 7_900 });
    expect(fee.cgst + fee.sgst).toBe(fee.tax);
  });

  it("taxes shipping at the highest rate when configured", () => {
    const fee = computeFeeTax(7_900, lines, RETAIL_RAJASTHAN, "HIGHEST_RATE");
    expect(fee.taxableValue).toBe(extractTaxable(7_900, 1800));
    expect(fee.total).toBe(7_900);
  });

  it("is zero for a free-shipping order", () => {
    expect(computeFeeTax(0, lines, RETAIL_RAJASTHAN, "PROPORTIONAL").tax).toBe(0);
  });
});

describe("roundToRupee", () => {
  it("rounds half up and reports the adjustment", () => {
    expect(roundToRupee(129_950)).toEqual({ rounded: 130_000, roundOff: 50 });
    expect(roundToRupee(129_949)).toEqual({ rounded: 129_900, roundOff: -49 });
  });
});
