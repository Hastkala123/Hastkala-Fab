/**
 * The checkout calculator. Turns cart lines + customer + settings into every
 * number an order needs: unit prices, discounts, GST per line and per fee,
 * shipping, COD fee and the grand total.
 *
 * Pure and deterministic: the cart page, the checkout review, order creation
 * and the invoice all call this with the same inputs and get the same answer.
 */

import {
  allocateProportionally,
  computeFeeTax,
  computeLineTax,
  extractTaxable,
  roundToRupee,
  selectRate,
  TaxConfigError,
  type FeeTaxMode,
  type TaxBand,
  type TaxMode,
} from "@/server/tax/gst";
import {
  evaluateCoupon,
  type CouponContext,
  type CouponDef,
  type CustomerType,
} from "@/server/coupons/evaluate";

export type QuoteLineInput = {
  key: string;
  categoryId: string;
  /** Retail selling price per piece, paise, GST included. */
  retailUnitPrice: number;
  quantity: number;
  taxBands: TaxBand[];
  isCodAllowed: boolean;
  /**
   * Wholesale price for this buyer at this quantity, if the product sells
   * wholesale and the quantity meets the minimum. Same tax basis as
   * settings.wholesalePricesIncludeTax.
   */
  wholesaleUnitPrice?: number | null;
  /** Pieces needed for the wholesale price (shown when not yet met). */
  wholesaleMinQty?: number | null;
};

export type QuoteSettings = {
  wholesalePricesIncludeTax: boolean;
  /** Retail free-shipping threshold on the order total, paise; null = never free. */
  freeShippingThreshold: number | null;
  retailShippingFee: number;
  wholesaleShippingFee: number;
  codEnabled: boolean;
  codFee: number;
  codMaxOrderValue: number | null;
  giftWrapFee: number;
  feeTaxMode: FeeTaxMode;
  roundTotalToRupee: boolean;
};

export type QuoteInput = {
  lines: QuoteLineInput[];
  customerType: CustomerType;
  intraState: boolean;
  paymentMethod: "ONLINE" | "COD";
  giftWrap: boolean;
  coupon?: { def: CouponDef; context: Omit<CouponContext, "orderSubtotal" | "eligibleSubtotal"> } | null;
  settings: QuoteSettings;
};

export type QuoteLine = {
  key: string;
  unitPrice: number;
  quantity: number;
  priceSource: "RETAIL" | "WHOLESALE";
  lineSubtotal: number;
  discountAllocated: number;
  taxableValue: number;
  rateBps: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
  boundaryAmbiguous: boolean;
  /** e.g. "Add 4 more for the wholesale price." */
  note: string | null;
};

export type QuoteFee = {
  kind: "SHIPPING" | "COD" | "GIFT_WRAP";
  amount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
};

export type Quote = {
  pricesIncludeTax: boolean;
  lines: QuoteLine[];
  fees: QuoteFee[];
  itemsSubtotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  giftWrapFee: number;
  taxableValue: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  coupon: { code: string; discount: number; freeShipping: boolean } | null;
  couponError: string | null;
  cod: { available: boolean; reason: string | null };
  /** Problems that block checkout (missing tax setup, …). */
  blockingIssues: string[];
};

export function buildQuote(input: QuoteInput): Quote {
  const { settings, customerType } = input;
  const isWholesale = customerType === "WHOLESALE";
  const pricesIncludeTax = isWholesale ? settings.wholesalePricesIncludeTax : true;
  const mode: TaxMode = { pricesIncludeTax, intraState: input.intraState };
  const blockingIssues: string[] = [];

  // 1. Unit price per line --------------------------------------------------
  const priced = input.lines.map((line) => {
    let unitPrice = line.retailUnitPrice;
    let priceSource: QuoteLine["priceSource"] = "RETAIL";
    let note: string | null = null;

    if (isWholesale) {
      if (line.wholesaleUnitPrice != null) {
        unitPrice = line.wholesaleUnitPrice;
        priceSource = "WHOLESALE";
      } else {
        if (line.wholesaleMinQty && line.quantity < line.wholesaleMinQty) {
          const more = line.wholesaleMinQty - line.quantity;
          note = `Add ${more} more for the wholesale price.`;
        }
        // A retail-priced line inside a "+ GST" order is converted to its
        // pre-tax equivalent, so the buyer still pays exactly the retail price.
        if (!pricesIncludeTax) {
          try {
            const { rateBps } = selectRate(line.retailUnitPrice, line.taxBands, true);
            unitPrice = extractTaxable(line.retailUnitPrice, rateBps);
          } catch (error) {
            if (!(error instanceof TaxConfigError)) throw error;
          }
        }
      }
    }

    return { line, unitPrice, priceSource, note, lineSubtotal: unitPrice * line.quantity };
  });

  const itemsSubtotal = priced.reduce((sum, p) => sum + p.lineSubtotal, 0);

  // 2. Coupon ---------------------------------------------------------------
  let discounts = priced.map(() => 0);
  let couponSummary: Quote["coupon"] = null;
  let couponError: string | null = null;
  let freeShipping = false;

  if (input.coupon) {
    const { def, context } = input.coupon;
    const eligible = priced.map(
      (p) => def.categoryIds.length === 0 || def.categoryIds.includes(p.line.categoryId),
    );
    const eligibleSubtotal = priced.reduce(
      (sum, p, i) => sum + (eligible[i] ? p.lineSubtotal : 0),
      0,
    );
    const result = evaluateCoupon(def, { ...context, orderSubtotal: itemsSubtotal, eligibleSubtotal });

    if (result.ok) {
      freeShipping = result.freeShipping;
      const shares = allocateProportionally(
        result.discount,
        priced.map((p, i) => (eligible[i] ? p.lineSubtotal : 0)),
      );
      discounts = shares;
      couponSummary = { code: def.code, discount: result.discount, freeShipping };
    } else {
      couponError = result.reason;
    }
  }

  // 3. GST per line ---------------------------------------------------------
  const lines: QuoteLine[] = priced.map((p, i) => {
    const discountAllocated = discounts[i]!;
    const lineNet = p.lineSubtotal - discountAllocated;
    try {
      const tax = computeLineTax(lineNet, p.line.quantity, p.line.taxBands, mode);
      return {
        key: p.line.key,
        unitPrice: p.unitPrice,
        quantity: p.line.quantity,
        priceSource: p.priceSource,
        lineSubtotal: p.lineSubtotal,
        discountAllocated,
        taxableValue: tax.taxableValue,
        rateBps: tax.rateBps,
        cgst: tax.cgst,
        sgst: tax.sgst,
        igst: tax.igst,
        lineTotal: tax.total,
        boundaryAmbiguous: tax.boundaryAmbiguous,
        note: p.note,
      };
    } catch (error) {
      if (!(error instanceof TaxConfigError)) throw error;
      blockingIssues.push(
        "One of the items in your bag can't be sold right now. Please contact us or remove it.",
      );
      return {
        key: p.line.key,
        unitPrice: p.unitPrice,
        quantity: p.line.quantity,
        priceSource: p.priceSource,
        lineSubtotal: p.lineSubtotal,
        discountAllocated,
        taxableValue: lineNet,
        rateBps: 0,
        cgst: 0,
        sgst: 0,
        igst: 0,
        lineTotal: lineNet,
        boundaryAmbiguous: false,
        note: p.note,
      };
    }
  });

  const linesTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  // 4. Fees -----------------------------------------------------------------
  let shippingFee: number;
  if (lines.length === 0 || freeShipping) {
    shippingFee = 0;
  } else if (isWholesale) {
    shippingFee = settings.wholesaleShippingFee;
  } else {
    shippingFee =
      settings.freeShippingThreshold != null && linesTotal >= settings.freeShippingThreshold
        ? 0
        : settings.retailShippingFee;
  }

  const giftWrapFee = input.giftWrap && lines.length > 0 ? settings.giftWrapFee : 0;

  // Fees are taxed at the rates of the goods they accompany. Weights are each
  // line's value after discount (before tax is added, for "+ GST" orders).
  const rateLines = lines.map((l) => ({
    lineNet: l.lineSubtotal - l.discountAllocated,
    rateBps: l.rateBps,
  }));
  const taxFee = (kind: QuoteFee["kind"], amount: number): QuoteFee => {
    const t = computeFeeTax(amount, rateLines, mode, settings.feeTaxMode);
    return { kind, amount: t.total, taxableValue: t.taxableValue, cgst: t.cgst, sgst: t.sgst, igst: t.igst };
  };

  const fees: QuoteFee[] = [];
  if (shippingFee > 0) fees.push(taxFee("SHIPPING", shippingFee));
  if (giftWrapFee > 0) fees.push(taxFee("GIFT_WRAP", giftWrapFee));

  // COD availability is judged on what the customer would pay before the COD fee.
  const totalBeforeCod = linesTotal + fees.reduce((s, f) => s + f.amount, 0);
  let codReason: string | null = null;
  if (!settings.codEnabled) codReason = "Cash on delivery is not available right now.";
  else if (input.lines.some((l) => !l.isCodAllowed)) {
    codReason = "One of the items in your bag can't be paid for by cash on delivery.";
  } else if (settings.codMaxOrderValue != null && totalBeforeCod > settings.codMaxOrderValue) {
    codReason = `Cash on delivery is available on orders up to ₹${Math.floor(
      settings.codMaxOrderValue / 100,
    ).toLocaleString("en-IN")}.`;
  }
  const codAvailable = codReason === null;
  if (input.paymentMethod === "COD" && codAvailable && settings.codFee > 0) {
    fees.push(taxFee("COD", settings.codFee));
  }

  // 5. Totals ---------------------------------------------------------------
  const sum = (pick: (x: { taxableValue: number; cgst: number; sgst: number; igst: number }) => number) =>
    lines.reduce((s, l) => s + pick(l), 0) + fees.reduce((s, f) => s + pick(f), 0);

  const taxableValue = sum((x) => x.taxableValue);
  const cgstTotal = sum((x) => x.cgst);
  const sgstTotal = sum((x) => x.sgst);
  const igstTotal = sum((x) => x.igst);
  const exactTotal = linesTotal + fees.reduce((s, f) => s + f.amount, 0);
  const { rounded, roundOff } = settings.roundTotalToRupee
    ? roundToRupee(exactTotal)
    : { rounded: exactTotal, roundOff: 0 };

  return {
    pricesIncludeTax,
    lines,
    fees,
    itemsSubtotal,
    discountTotal: discounts.reduce((s, d) => s + d, 0),
    shippingFee: fees.find((f) => f.kind === "SHIPPING")?.amount ?? 0,
    codFee: fees.find((f) => f.kind === "COD")?.amount ?? 0,
    giftWrapFee: fees.find((f) => f.kind === "GIFT_WRAP")?.amount ?? 0,
    taxableValue,
    cgstTotal,
    sgstTotal,
    igstTotal,
    roundOff,
    grandTotal: rounded,
    coupon: couponSummary,
    couponError,
    cod: { available: codAvailable, reason: codReason },
    blockingIssues: [...new Set(blockingIssues)],
  };
}
