/** "M · Indigo · Pack of 3" — how a variant is named on cart lines, orders and invoices. */
export function variantLabel(variant: {
  size?: string | null;
  colorName?: string | null;
  packQuantity?: number | null;
  label?: string | null;
}): string | null {
  const parts = [
    variant.label?.trim() || null,
    variant.size?.trim() || null,
    variant.colorName?.trim() || null,
    variant.packQuantity && variant.packQuantity > 1 ? `Pack of ${variant.packQuantity}` : null,
  ].filter((p): p is string => Boolean(p));
  return parts.length ? parts.join(" · ") : null;
}
