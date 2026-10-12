import "server-only";

import type { PrintTechnique, Prisma, PrismaClient } from "@prisma/client";
import { variantLabel } from "@/lib/variants";
import type { CouponDef } from "@/server/coupons/evaluate";
import { retailPrice, tierPricesFor, wholesaleMinimum, wholesaleUnitPrice, type Viewer } from "@/server/catalog/pricing";
import { effectiveHsnId, loadTaxBands } from "@/server/catalog/tax";
import type { AllSettings } from "@/server/settings/schema";
import { toQuoteSettings } from "@/server/settings";
import { buildQuote, type Quote, type QuoteLine } from "./quote";

/**
 * Loads everything the checkout calculator needs from the database and runs
 * it. The cart page and order placement both call this, so the total a
 * shopper sees is exactly the total they are charged. Prices are always read
 * fresh here — a request body only ever carries variant ids and quantities.
 */

type Client = PrismaClient | Prisma.TransactionClient;

export type PricingItem = { key: string; variantId: string; quantity: number };

export type Buyer = {
  userId: string | null;
  viewer: Viewer;
};

export type PricingOptions = {
  couponCode: string | null;
  intraState: boolean;
  paymentMethod: "ONLINE" | "COD";
  giftWrap: boolean;
  settings: AllSettings;
  now?: Date;
};

export type PricedLine = {
  key: string;
  variantId: string;
  productId: string;
  productSlug: string;
  title: string;
  sku: string;
  variantLabel: string | null;
  imageUrl: string | null;
  imageAlt: string;
  hsnCode: string | null;
  printTechnique: PrintTechnique;
  packQuantity: number;
  mrp: number;
  stock: number;
  quantity: number;
  isReturnable: boolean;
  /** Why this line cannot be bought as it stands, if it can't. */
  issue: string | null;
  quote: QuoteLine;
};

export type Pricing = {
  quote: Quote;
  lines: PricedLine[];
  customerType: "RETAIL" | "WHOLESALE";
  couponError: string | null;
  /** Everything that must be fixed before the order can be placed. */
  issues: string[];
};

const variantInclude = {
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      publishAt: true,
      categoryId: true,
      hsnCodeId: true,
      price: true,
      mrp: true,
      printTechnique: true,
      isCodAllowed: true,
      isReturnable: true,
      wholesaleEnabled: true,
      wholesaleMinQty: true,
      hsnCode: { select: { code: true } },
      category: { select: { isActive: true, hsnCodeId: true, hsnCode: { select: { code: true } } } },
      media: {
        where: { type: "IMAGE" },
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true, alt: true, variantId: true },
      },
      wholesalePrices: { select: { priceTierId: true, minQuantity: true, unitPrice: true } },
    },
  },
  media: { where: { type: "IMAGE" }, orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
} satisfies Prisma.ProductVariantInclude;

export async function priceItems(
  client: Client,
  items: PricingItem[],
  buyer: Buyer,
  options: PricingOptions,
): Promise<Pricing> {
  const now = options.now ?? new Date();
  const { settings } = options;
  const customerType = buyer.viewer.wholesale ? "WHOLESALE" : "RETAIL";

  const variants = await client.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: variantInclude,
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const present = items.filter((i) => byId.has(i.variantId));

  const bands = await loadTaxBands(
    client,
    variants.map((v) => effectiveHsnId(v.product)).filter((id): id is string => Boolean(id)),
    now,
  );

  // Trade-price bands count every piece of a product across sizes and colours.
  const piecesPerProduct = new Map<string, number>();
  for (const item of present) {
    const v = byId.get(item.variantId)!;
    piecesPerProduct.set(v.productId, (piecesPerProduct.get(v.productId) ?? 0) + item.quantity);
  }

  const tierPrices = (v: (typeof variants)[number]) =>
    v.product.wholesaleEnabled ? tierPricesFor(v.product.wholesalePrices, buyer.viewer) : [];

  // Coupon -----------------------------------------------------------------
  let couponInput: Parameters<typeof buildQuote>[0]["coupon"] = null;
  let couponError: string | null = null;
  if (options.couponCode) {
    const coupon = await client.coupon.findUnique({
      where: { code: options.couponCode.toUpperCase() },
      include: { categories: { select: { categoryId: true } } },
    });
    if (!coupon) {
      couponError = "This coupon code isn't valid.";
    } else {
      const def: CouponDef = {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount,
        minOrderValue: coupon.minOrderValue,
        audience: coupon.audience,
        firstOrderOnly: coupon.firstOrderOnly,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        perUserLimit: coupon.perUserLimit,
        startsAt: coupon.startsAt,
        endsAt: coupon.endsAt,
        isActive: coupon.isActive,
        categoryIds: coupon.categories.map((c) => c.categoryId),
      };
      const [priorRedemptions, priorOrders] = buyer.userId
        ? await Promise.all([
            client.couponRedemption.count({
              where: { couponId: coupon.id, userId: buyer.userId, releasedAt: null },
            }),
            client.order.count({
              where: { userId: buyer.userId, status: { notIn: ["CANCELLED", "PAYMENT_FAILED"] } },
            }),
          ])
        : [0, 0];
      couponInput = {
        def,
        context: {
          now,
          customerType,
          shopperKnown: buyer.userId != null,
          priorRedemptionsByShopper: priorRedemptions,
          shopperHasPriorOrders: priorOrders > 0,
        },
      };
    }
  }

  const quote = buildQuote({
    lines: present.map((item) => {
      const v = byId.get(item.variantId)!;
      const tiers = tierPrices(v);
      const productPieces = piecesPerProduct.get(v.productId)!;
      const minimum = wholesaleMinimum(v.product, tiers);
      const reachesMinimum = minimum != null && productPieces >= minimum;
      const hsnId = effectiveHsnId(v.product);
      return {
        key: item.key,
        categoryId: v.product.categoryId,
        retailUnitPrice: retailPrice(v.product, v).price,
        quantity: item.quantity,
        piecesPerUnit: v.packQuantity,
        taxBands: hsnId ? (bands.get(hsnId) ?? []) : [],
        isCodAllowed: v.product.isCodAllowed,
        wholesaleUnitPrice: reachesMinimum ? wholesaleUnitPrice(tiers, productPieces) : null,
        // Pieces this line still needs, given the other lines of the product.
        wholesaleMinQty: minimum != null ? minimum - (productPieces - item.quantity) : null,
      };
    }),
    customerType,
    intraState: options.intraState,
    paymentMethod: options.paymentMethod,
    giftWrap: options.giftWrap,
    coupon: couponInput,
    settings: toQuoteSettings(settings),
  });

  const maxPerLine =
    customerType === "WHOLESALE" ? settings.wholesale.maxQuantityPerLine : settings.checkout.maxQuantityPerLine;
  const issues: string[] = [];

  const lines: PricedLine[] = present.map((item, i) => {
    const v = byId.get(item.variantId)!;
    const p = v.product;
    const label = variantLabel(v);
    const name = label ? `${p.title} (${label})` : p.title;
    const live =
      p.status === "ACTIVE" && (p.publishAt == null || p.publishAt <= now) && p.category.isActive && v.isActive && !v.archivedAt;

    let issue: string | null = null;
    if (!live) issue = `${name} is no longer available. Please remove it.`;
    else if (v.stock <= 0) issue = `${name} is sold out. Please remove it.`;
    else if (item.quantity > v.stock) issue = `Only ${v.stock} left of ${name}. Please reduce the quantity.`;
    else if (item.quantity > maxPerLine) issue = `You can order up to ${maxPerLine} of ${name} at a time.`;
    if (issue) issues.push(issue);

    const image = v.media[0] ?? p.media[0] ?? null;
    return {
      key: item.key,
      variantId: v.id,
      productId: p.id,
      productSlug: p.slug,
      title: p.title,
      sku: v.sku,
      variantLabel: label,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? p.title,
      hsnCode: p.hsnCode?.code ?? p.category.hsnCode?.code ?? null,
      printTechnique: p.printTechnique,
      packQuantity: v.packQuantity,
      mrp: retailPrice(p, v).mrp,
      stock: v.stock,
      quantity: item.quantity,
      isReturnable: p.isReturnable,
      issue,
      quote: quote.lines[i]!,
    };
  });

  if (present.length < items.length) issues.push("An item in your bag is no longer sold and was removed.");
  if (
    customerType === "WHOLESALE" &&
    settings.wholesale.minOrderValue > 0 &&
    quote.grandTotal < settings.wholesale.minOrderValue
  ) {
    issues.push(
      `Wholesale orders start at ₹${Math.ceil(settings.wholesale.minOrderValue / 100).toLocaleString("en-IN")}.`,
    );
  }
  issues.push(...quote.blockingIssues);

  return {
    quote,
    lines,
    customerType,
    couponError: couponError ?? quote.couponError,
    issues: [...new Set(issues)],
  };
}
