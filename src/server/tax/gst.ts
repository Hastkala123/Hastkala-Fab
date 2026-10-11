/**
 * GST engine. Pure functions, no database — every rupee of tax on an order or
 * invoice is computed here and nowhere else.
 *
 * Units: money is integer paise; rates are integer basis points (500 = 5 %).
 *
 * Retail prices INCLUDE GST (what the customer sees is what they pay), so tax
 * is extracted from the price. Wholesale prices may EXCLUDE GST ("₹749 +
 * GST"), in which case tax is added on top. See docs/phase-1/04-data-model.md.
 */

export type TaxBand = {
  /** Inclusive lower bound of the per-piece taxable value, paise. */
  minUnitValue: number;
  /** Inclusive upper bound, paise; null = no limit. */
  maxUnitValue: number | null;
  rateBps: number;
};

export type TaxMode = {
  pricesIncludeTax: boolean;
  /** Delivery in the seller's own state → CGST + SGST; otherwise IGST. */
  intraState: boolean;
};

export type TaxSplit = { cgst: number; sgst: number; igst: number };

export type LineTax = TaxSplit & {
  rateBps: number;
  taxableValue: number;
  tax: number;
  /** What the customer pays for this line, tax included. */
  total: number;
  /**
   * True when the per-piece value sits where no single band (or more than one)
   * applies; the higher rate was used. Shown as a warning in admin.
   */
  boundaryAmbiguous: boolean;
};

export class TaxConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaxConfigError";
  }
}

function inBand(value: number, band: TaxBand): boolean {
  return value >= band.minUnitValue && (band.maxUnitValue == null || value <= band.maxUnitValue);
}

/** Taxable part of a tax-inclusive amount: round(amount ÷ (1 + rate)). */
export function extractTaxable(inclusiveAmount: number, rateBps: number): number {
  return Math.round((inclusiveAmount * 10_000) / (10_000 + rateBps));
}

/** Tax on a tax-exclusive amount: round(amount × rate). */
export function taxOnExclusive(exclusiveAmount: number, rateBps: number): number {
  return Math.round((exclusiveAmount * rateBps) / 10_000);
}

export function splitTax(tax: number, intraState: boolean): TaxSplit {
  if (!intraState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0 };
}

/**
 * Picks the GST rate for one piece.
 *
 * Bands are defined on the per-piece TAXABLE value. With tax-inclusive prices
 * the taxable value depends on the rate being chosen, so each candidate band
 * is tested at its own rate. Exactly one match → that rate. None or several
 * (a price sitting in the boundary gap) → the highest candidate rate, flagged.
 */
export function selectRate(
  perPieceAmount: number,
  bands: TaxBand[],
  pricesIncludeTax: boolean,
): { rateBps: number; boundaryAmbiguous: boolean } {
  if (bands.length === 0) {
    throw new TaxConfigError("No GST rate is configured for this product's HSN code.");
  }

  const matches = bands.filter((band) => {
    const taxablePerPiece = pricesIncludeTax
      ? extractTaxable(perPieceAmount, band.rateBps)
      : perPieceAmount;
    return inBand(taxablePerPiece, band);
  });

  if (matches.length === 1) {
    return { rateBps: matches[0]!.rateBps, boundaryAmbiguous: false };
  }

  const pool = matches.length > 1 ? matches : bands;
  const highest = Math.max(...pool.map((b) => b.rateBps));
  return { rateBps: highest, boundaryAmbiguous: true };
}

/**
 * Tax for one order line after its share of any discount.
 *
 * @param lineNet   unitPrice × quantity − discount share (paise); inclusive of
 *                  tax when mode.pricesIncludeTax, exclusive otherwise.
 */
export function computeLineTax(
  lineNet: number,
  quantity: number,
  bands: TaxBand[],
  mode: TaxMode,
): LineTax {
  if (!Number.isInteger(lineNet) || lineNet < 0) {
    throw new RangeError("lineNet must be a non-negative integer number of paise");
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError("quantity must be a positive integer");
  }

  const perPiece = Math.round(lineNet / quantity);
  const { rateBps, boundaryAmbiguous } = selectRate(perPiece, bands, mode.pricesIncludeTax);

  let taxableValue: number;
  let tax: number;
  if (mode.pricesIncludeTax) {
    taxableValue = extractTaxable(lineNet, rateBps);
    tax = lineNet - taxableValue;
  } else {
    taxableValue = lineNet;
    tax = taxOnExclusive(lineNet, rateBps);
  }

  return {
    rateBps,
    taxableValue,
    tax,
    total: taxableValue + tax,
    boundaryAmbiguous,
    ...splitTax(tax, mode.intraState),
  };
}

/**
 * Splits an amount across weighted shares so the parts are integers that add
 * up EXACTLY to the amount (largest-remainder method). Ties go to the earlier
 * entry, so the result is deterministic.
 */
export function allocateProportionally(amount: number, weights: number[]): number[] {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError("amount must be a non-negative integer");
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (amount === 0 || total <= 0) return weights.map(() => 0);

  const exact = weights.map((w) => (amount * w) / total);
  const parts = exact.map((x) => Math.floor(x));
  let remainder = amount - parts.reduce((sum, p) => sum + p, 0);

  const order = exact
    .map((x, index) => ({ index, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  for (const { index } of order) {
    if (remainder <= 0) break;
    parts[index]! += 1;
    remainder -= 1;
  }
  return parts;
}

export type FeeTaxMode = "PROPORTIONAL" | "HIGHEST_RATE";

/**
 * Tax on a fee (shipping, COD, gift wrap). PROPORTIONAL taxes each slice of the
 * fee at the rate of the line it is apportioned to; HIGHEST_RATE taxes the
 * whole fee at the order's highest line rate. Which one applies is a store
 * setting confirmed by the owner's CA.
 */
export function computeFeeTax(
  fee: number,
  lines: { lineNet: number; rateBps: number }[],
  mode: TaxMode,
  feeMode: FeeTaxMode,
): { taxableValue: number; tax: number; total: number } & TaxSplit {
  if (fee === 0 || lines.length === 0) {
    return { taxableValue: fee, tax: 0, total: fee, ...splitTax(0, mode.intraState) };
  }

  const slices =
    feeMode === "HIGHEST_RATE"
      ? [{ amount: fee, rateBps: Math.max(...lines.map((l) => l.rateBps)) }]
      : allocateProportionally(
          fee,
          lines.map((l) => l.lineNet),
        ).map((amount, i) => ({ amount, rateBps: lines[i]!.rateBps }));

  let taxableValue = 0;
  let tax = 0;
  for (const slice of slices) {
    if (mode.pricesIncludeTax) {
      const taxable = extractTaxable(slice.amount, slice.rateBps);
      taxableValue += taxable;
      tax += slice.amount - taxable;
    } else {
      taxableValue += slice.amount;
      tax += taxOnExclusive(slice.amount, slice.rateBps);
    }
  }

  return { taxableValue, tax, total: taxableValue + tax, ...splitTax(tax, mode.intraState) };
}

/** Rounds a paise total to the nearest rupee; returns the ± adjustment. */
export function roundToRupee(total: number): { rounded: number; roundOff: number } {
  const rounded = Math.round(total / 100) * 100;
  return { rounded, roundOff: rounded - total };
}
