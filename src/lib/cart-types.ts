/** The bag as the browser sees it. Built on the server from getCartView(). */
export type CartDisplayLine = {
  id: string;
  slug: string;
  title: string;
  variantLabel: string | null;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  quantity: number;
  maxQuantity: number;
  /** Per unit; includes GST unless `pricesIncludeTax` is false (wholesale "+ GST"). */
  unitPrice: number;
  mrp: number;
  lineSubtotal: number;
  discount: number;
  lineTotal: number;
  priceSource: "RETAIL" | "WHOLESALE";
  note: string | null;
  issue: string | null;
};

export type CartDisplay = {
  itemCount: number;
  customerType: "RETAIL" | "WHOLESALE";
  pricesIncludeTax: boolean;
  lines: CartDisplayLine[];
  itemsSubtotal: number;
  discountTotal: number;
  shippingFee: number;
  codFee: number;
  giftWrapFee: number;
  taxTotal: number;
  roundOff: number;
  grandTotal: number;
  couponCode: string | null;
  couponError: string | null;
  freeShipping: { threshold: number; remaining: number } | null;
  cod: { available: boolean; reason: string | null };
  issues: string[];
};
