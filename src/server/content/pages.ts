import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { getSettings } from "@/server/settings";
import type { AllSettings } from "@/server/settings/schema";

/**
 * Pages written in Admin → Content: the story, contact text and policies.
 * The fixed ones have their own short address (linked from the footer and
 * checkout); any other page the owner adds lives at /pages/{slug}.
 */

export const FIXED_PAGES = ["about", "contact", "shipping-policy", "returns-policy", "privacy-policy", "terms"] as const;
export type FixedPageSlug = (typeof FIXED_PAGES)[number];

export function isFixedPage(slug: string): slug is FixedPageSlug {
  return (FIXED_PAGES as readonly string[]).includes(slug);
}

export function pagePath(slug: string): string {
  return isFixedPage(slug) ? `/${slug}` : `/pages/${slug}`;
}

/** A page by its address, published or not (callers decide who may see a draft). */
export const getPageBySlug = cache(async (slug: string) => db.page.findUnique({ where: { slug } }));

/** Slugs of published pages, so links to unpublished ones can be hidden. */
export const publishedPageSlugs = cache(async (): Promise<Set<string>> => {
  const rows = await db.page.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
  return new Set(rows.map((r) => r.slug));
});

/** Extra pages the owner chose to list in the footer. */
export const footerPages = cache(async () =>
  db.page.findMany({
    where: { status: "PUBLISHED", showInFooter: true, slug: { notIn: [...FIXED_PAGES] } },
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  }),
);

/** Active FAQs grouped in the owner's order. */
export const publishedFaqs = cache(async () => {
  const faqs = await db.faq.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, group: true },
  });
  const groups = new Map<string, typeof faqs>();
  for (const faq of faqs) groups.set(faq.group, [...(groups.get(faq.group) ?? []), faq]);
  return [...groups].map(([name, items]) => ({ name, items }));
});

/** The values {{placeholders}} in page text stand for (see lib/content-text). */
export function contentValues(settings: AllSettings): Record<string, string> {
  const p = settings["store.profile"];
  const { shipping, cod, returns, tax } = settings;
  const address = p.addressLine1
    ? [p.addressLine1, p.addressLine2, p.city, [p.state, p.pincode].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : "";
  const returnsOn = returns.windowDays > 0;
  const fee = shipping.retailFee > 0 ? formatPrice(shipping.retailFee) : null;
  const freeFrom = shipping.freeShippingThreshold != null ? formatPrice(shipping.freeShippingThreshold) : null;
  return {
    storeName: p.displayName,
    legalName: p.legalName,
    gstin: p.gstin,
    address,
    phone: p.phone,
    whatsapp: p.whatsapp,
    email: p.email,
    grievanceOfficer: p.grievanceOfficerName,
    grievanceEmail: p.grievanceOfficerEmail,
    grievancePhone: p.grievanceOfficerPhone,
    dispatchText: shipping.dispatchText,
    deliveryText: shipping.deliveryText,
    shippingCharges: !fee
      ? "Shipping is free on every order."
      : freeFrom
        ? `Shipping is free on orders of ${freeFrom} and above; below that it costs ${fee}.`
        : `Shipping costs ${fee} per order.`,
    wholesaleShipping:
      shipping.wholesaleFee > 0
        ? `Wholesale orders are charged ${formatPrice(shipping.wholesaleFee)} for shipping.`
        : "Freight for wholesale orders is arranged with you separately.",
    freeShippingAbove: freeFrom ?? "",
    shippingFee: fee ?? "",
    codAvailability: cod.enabled
      ? `Cash on Delivery is available on retail orders${cod.maxOrderValue ? ` up to ${formatPrice(cod.maxOrderValue)}` : ""}.`
      : "Cash on Delivery isn't available at the moment — please pay online.",
    returnDays: returnsOn ? String(returns.windowDays) : "",
    returnConditions: returnsOn ? returns.conditionsText : "",
    exchangeNote: returnsOn && returns.allowExchange ? "You can ask for a different size instead of a refund, while it is in stock." : "",
    returnShippingDeduction: returns.returnShippingDeduction > 0 ? formatPrice(returns.returnShippingDeduction) : "",
    wholesaleGst: tax.wholesalePricesIncludeTax
      ? "Wholesale prices include GST."
      : "Wholesale prices are shown + GST, and the GST is added at checkout.",
  };
}

export async function getContentValues(): Promise<Record<string, string>> {
  return contentValues(await getSettings());
}
