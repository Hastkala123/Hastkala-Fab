/**
 * Which price a buyer pays. Pure, shared by product cards, the product page,
 * the cart and checkout so all four always agree.
 */

export type WholesaleTierPrice = { minQuantity: number; unitPrice: number };

export type Viewer = {
  /** Approved wholesale buyers see trade prices. */
  wholesale: boolean;
  /** The buyer's price tier, or the default tier. */
  priceTierId: string | null;
  /** The default ("Standard") tier: used for designs with no price in the buyer's tier. */
  defaultTierId: string | null;
};

export const RETAIL_VIEWER: Viewer = { wholesale: false, priceTierId: null, defaultTierId: null };

/** Tier ids whose prices a viewer may need (none for retail). */
export function viewerTierIds(viewer: Viewer): string[] {
  if (!viewer.wholesale) return [];
  return [...new Set([viewer.priceTierId, viewer.defaultTierId].filter((id): id is string => Boolean(id)))];
}

/**
 * A design's trade prices for this viewer: their own tier's, or the default
 * tier's when the design has none in their tier. Never mixes the two.
 */
export function tierPricesFor<T extends { priceTierId: string }>(rows: T[], viewer: Viewer): T[] {
  if (!viewer.wholesale) return [];
  const own = viewer.priceTierId ? rows.filter((r) => r.priceTierId === viewer.priceTierId) : [];
  if (own.length > 0) return own.sort((a, b) => minQty(a) - minQty(b));
  return rows.filter((r) => r.priceTierId === viewer.defaultTierId).sort((a, b) => minQty(a) - minQty(b));
}

const minQty = (row: object) => (row as { minQuantity?: number }).minQuantity ?? 0;

/** Variant overrides the product's price/MRP when set. */
export function retailPrice(
  product: { price: number; mrp: number },
  variant?: { price: number | null; mrp: number | null } | null,
): { price: number; mrp: number } {
  const price = variant?.price ?? product.price;
  const mrp = Math.max(variant?.mrp ?? product.mrp, price);
  return { price, mrp };
}

/**
 * The trade price for `quantity` pieces: the band with the highest minimum the
 * quantity reaches. Null when the quantity is below every band.
 */
export function wholesaleUnitPrice(tiers: WholesaleTierPrice[], quantity: number): number | null {
  let best: WholesaleTierPrice | null = null;
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity && (!best || tier.minQuantity > best.minQuantity)) best = tier;
  }
  return best?.unitPrice ?? null;
}

/** The lowest quantity that unlocks a trade price ("from 10 pcs"). */
export function wholesaleMinimum(
  product: { wholesaleMinQty: number },
  tiers: WholesaleTierPrice[],
): number | null {
  if (tiers.length === 0) return null;
  return Math.max(product.wholesaleMinQty, Math.min(...tiers.map((t) => t.minQuantity)));
}

/** "From" trade price for cards: the price at the lowest band. */
export function wholesaleFromPrice(tiers: WholesaleTierPrice[]): WholesaleTierPrice | null {
  if (tiers.length === 0) return null;
  return tiers.reduce((low, t) => (t.minQuantity < low.minQuantity ? t : low));
}
