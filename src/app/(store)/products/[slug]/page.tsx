import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can, getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { jsonLd } from "@/lib/jsonld";
import { categoryPath, productPath } from "@/lib/routes";
import { formatDate } from "@/lib/utils";
import { variantLabel } from "@/lib/variants";
import { retailPrice } from "@/server/catalog/pricing";
import { getProductPage, relatedProducts } from "@/server/catalog/products";
import { getViewer } from "@/server/catalog/viewer";
import { getSettings } from "@/server/settings";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ProductCard from "@/components/store/ProductCard";
import ProductGallery from "@/components/store/ProductGallery";
import BuyBox from "@/components/store/BuyBox";
import ReviewForm from "@/components/store/ReviewForm";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

const PRINT_LABELS: Record<string, string> = {
  HAND_BLOCK: "Hand block print",
  SCREEN: "Screen print",
  DIGITAL: "Digital print",
  HAND_PAINTED: "Hand painted",
  OTHER: "Printed",
};

/** Staff can open ?preview=1 to see a draft before publishing it. */
async function load(slug: string, preview: boolean) {
  const user = await getCurrentUser();
  const allowPreview = preview && can(user, "catalog.manage");
  return { user, page: await getProductPage(slug, await getViewer(), { preview: allowPreview }) };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await load(slug, (await searchParams).preview === "1");
  if (!page) return { title: "Product not found", robots: { index: false, follow: false } };
  const { product } = page;
  const title = product.metaTitle ?? product.title;
  const description =
    product.metaDescription ?? product.shortDescription ?? product.description.replace(/\s+/g, " ").slice(0, 155);
  const image = product.ogImageUrl ?? product.media[0]?.url;
  return {
    title,
    description,
    keywords: product.searchKeywords.length ? product.searchKeywords : undefined,
    alternates: { canonical: productPath(product.slug) },
    robots: page.live ? undefined : { index: false, follow: false },
    openGraph: {
      type: "website",
      title,
      description,
      url: productPath(product.slug),
      images: image ? [{ url: image, alt: product.title }] : undefined,
    },
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { user, page } = await load(slug, (await searchParams).preview === "1");
  if (!page) notFound();
  const { product, specs, sizeChart, reviews } = page;

  const [settings, viewer] = await Promise.all([getSettings(), getViewer()]);
  const [related, wishlisted, purchased, reviewed] = await Promise.all([
    relatedProducts(product, viewer, 4),
    user
      ? db.wishlistItem.findUnique({
          where: { userId_productId: { userId: user.id, productId: product.id } },
          select: { id: true },
        })
      : null,
    user
      ? db.orderItem.findFirst({
          where: { productId: product.id, order: { userId: user.id, status: "DELIVERED" } },
          select: { id: true },
        })
      : null,
    user
      ? db.review.findUnique({
          where: { productId_userId: { productId: product.id, userId: user.id } },
          select: { id: true },
        })
      : null,
  ]);

  const variants = product.variants.map((v) => {
    const { price, mrp } = retailPrice(product, v);
    const hasNamedOption = !v.size && !v.colorName;
    return {
      id: v.id,
      size: v.size,
      colorName: v.colorName,
      colorHex: v.colorHex,
      optionLabel: hasNamedOption ? variantLabel(v) : null,
      price,
      mrp,
      stock: v.stock,
    };
  });
  const lowest = variants.length ? Math.min(...variants.map((v) => v.price)) : product.price;
  const highest = variants.length ? Math.max(...variants.map((v) => v.price)) : product.price;
  const inStock = variants.some((v) => v.stock > 0);
  const store = settings["store.profile"];
  const returnDays = settings.returns.windowDays;
  const maxPerLine = viewer.wholesale ? settings.wholesale.maxQuantityPerLine : settings.checkout.maxQuantityPerLine;
  const url = `${env.NEXT_PUBLIC_SITE_URL}${productPath(product.slug)}`;

  /** Product structured data: price, stock and real ratings in Google results. */
  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription ?? product.description.slice(0, 300),
    sku: product.variants[0]?.sku,
    image: product.media.map((m) => `${env.NEXT_PUBLIC_SITE_URL}${m.url}`),
    brand: { "@type": "Brand", name: store.displayName },
    category: product.category.name,
    material: specs.find((s) => s.key === "fabric")?.values.join(", "),
    countryOfOrigin: product.countryOfOrigin,
    offers: {
      "@type": "AggregateOffer",
      url,
      priceCurrency: "INR",
      lowPrice: (lowest / 100).toFixed(2),
      highPrice: (highest / 100).toFixed(2),
      offerCount: Math.max(1, variants.length),
      availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: store.displayName },
      ...(product.isReturnable && returnDays > 0
        ? {
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: "IN",
              returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
              merchantReturnDays: returnDays,
              returnMethod: "https://schema.org/ReturnByMail",
            },
          }
        : {}),
    },
    ...(product.ratingCount > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.ratingAvg.toFixed(1),
        reviewCount: product.ratingCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };

  const parent = product.category.parent;
  const categoryHref = categoryPath(product.category.slug, parent?.slug);
  const crumbs = [
    { href: "/", label: "Home" },
    ...(parent ? [{ href: categoryPath(parent.slug), label: parent.name }] : []),
    { href: categoryHref, label: product.category.name },
    { href: productPath(product.slug), label: product.title },
  ];
  const chartRows = Array.isArray(sizeChart?.rows) ? (sizeChart.rows as { size?: string; values?: string[] }[]) : [];

  return (
    <>
      {page.live && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />}

      <div className="hf-container py-6 sm:py-10">
        {!page.live && (
          <p className="mb-4 rounded-lg bg-turmeric-100 px-4 py-2.5 text-sm font-semibold text-turmeric-900">
            Preview — this product is not visible to shoppers yet ({product.status.toLowerCase()}).
          </p>
        )}
        <Breadcrumbs items={crumbs} />

        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <ProductGallery images={product.media.map((m) => ({ url: m.url, alt: m.alt }))} title={product.title} />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={categoryHref} className="text-xs font-bold uppercase tracking-wider text-madder-600 hover:underline">
                {product.category.name}
              </Link>
              {product.isNewArrival && <span className="hf-badge text-indigo-ink-700">New</span>}
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-indigo-ink-950 sm:text-3xl">
              {product.title}
            </h1>

            {product.ratingCount > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-700">
                  {product.ratingAvg.toFixed(1)}
                  <span aria-hidden="true">★</span>
                  <span className="sr-only">out of 5</span>
                </span>
                <a href="#reviews" className="text-sm text-slate-500 hover:underline">
                  {product.ratingCount} {product.ratingCount === 1 ? "review" : "reviews"}
                </a>
              </div>
            )}

            {product.shortDescription && (
              <p className="mt-4 text-base leading-relaxed text-slate-600">{product.shortDescription}</p>
            )}

            {variants.length > 0 ? (
              <BuyBox
                productId={product.id}
                productTitle={product.title}
                variants={variants}
                maxPerLine={maxPerLine}
                wishlisted={Boolean(wishlisted)}
                wholesale={
                  product.wholesaleEnabled && product.wholesalePrices.length
                    ? {
                        tiers: product.wholesalePrices.map((t) => ({
                          minQuantity: Math.max(t.minQuantity, product.wholesaleMinQty),
                          unitPrice: t.unitPrice,
                        })),
                        plusGst: !settings.tax.wholesalePricesIncludeTax,
                      }
                    : null
                }
              />
            ) : (
              <p className="mt-6 rounded-lg bg-cotton-200 px-4 py-3 text-sm font-semibold text-indigo-ink-800">
                This design is currently unavailable.
              </p>
            )}

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-cotton-300 pt-6 text-sm">
              <Spec label="Print" value={PRINT_LABELS[product.printTechnique] ?? null} />
              {specs.map((spec) => (
                <Spec
                  key={spec.key}
                  label={spec.label}
                  value={spec.values.map((v) => (spec.unit ? `${v} ${spec.unit}` : v)).join(", ")}
                />
              ))}
              {/* Consumer Protection (E-Commerce) Rules 2020: origin and seller details. */}
              <Spec label="Country of origin" value={product.countryOfOrigin} />
              <Spec
                label="Sold by"
                value={[store.legalName || store.displayName, store.city, store.pincode].filter(Boolean).join(", ")}
              />
            </dl>
          </div>
        </div>

        <section className="mt-14 grid gap-10 lg:grid-cols-3 lg:gap-14">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold text-indigo-ink-950">About this piece</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
              {product.description.split(/\n\s*\n/).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>

            {product.printTechnique === "HAND_BLOCK" && (
              <div className="mt-6 rounded-card border border-turmeric-200 bg-turmeric-50 p-4">
                <h3 className="text-sm font-bold text-turmeric-900">A note on hand block printing</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-turmeric-800">
                  Slight differences in motif placement, colour depth and block alignment come from printing by hand. They
                  are not defects — they are what make each piece one of a kind.
                </p>
              </div>
            )}

            {sizeChart && chartRows.length > 0 && (
              <div className="mt-8">
                <h2 className="font-display text-xl font-bold text-indigo-ink-950">Size chart</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <caption className="sr-only">Measurements in {sizeChart.unit === "cm" ? "centimetres" : "inches"}</caption>
                    <thead className="border-b border-cotton-300 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th scope="col" className="py-2 pr-4">Size</th>
                        {sizeChart.columns.map((col) => (
                          <th key={col} scope="col" className="py-2 pr-4">
                            {col} ({sizeChart.unit})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cotton-200">
                      {chartRows.map((row, i) => (
                        <tr key={`${row.size}-${i}`}>
                          <th scope="row" className="py-2 pr-4 font-semibold text-indigo-ink-900">{row.size}</th>
                          {(row.values ?? []).map((value, j) => (
                            <td key={j} className="py-2 pr-4 text-slate-700">{value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sizeChart.notes && <p className="mt-2 text-xs text-slate-500">{sizeChart.notes}</p>}
              </div>
            )}
          </div>

          <aside>
            {product.careInstructions && (
              <div className="hf-card p-5">
                <h3 className="font-display text-base font-bold text-indigo-ink-950">Care instructions</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{product.careInstructions}</p>
              </div>
            )}

            <div className="hf-card mt-4 p-5">
              <h3 className="font-display text-base font-bold text-indigo-ink-950">Delivery &amp; returns</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                {settings.shipping.dispatchText && <li>{settings.shipping.dispatchText}</li>}
                {settings.shipping.deliveryText && <li>{settings.shipping.deliveryText}</li>}
                <li>
                  {product.isReturnable && returnDays > 0
                    ? `${returnDays}-day returns from delivery`
                    : "This item can't be returned unless it arrives damaged"}
                </li>
                {!product.isCodAllowed && <li>Cash on delivery isn&apos;t available for this item</li>}
              </ul>
              <Link href="/returns-policy" className="hf-link mt-3 inline-block text-sm font-semibold">
                Read the full policy →
              </Link>
            </div>
          </aside>
        </section>

        <section id="reviews" className="mt-14 scroll-mt-24">
          <h2 className="font-display text-xl font-bold text-indigo-ink-950">Customer reviews</h2>

          {reviews.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No reviews yet. If you have bought this piece, yours would be the first.</p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {reviews.map((review) => (
                <li key={review.id} className="hf-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-turmeric-600" aria-label={`${review.rating} out of 5 stars`}>
                        {"★".repeat(review.rating)}
                        <span className="text-cotton-400">{"★".repeat(5 - review.rating)}</span>
                      </span>
                      {review.isVerifiedPurchase && <span className="hf-badge text-emerald-700">Verified purchase</span>}
                    </div>
                    <time dateTime={review.createdAt.toISOString()} className="text-xs text-slate-400">
                      {formatDate(review.createdAt)}
                    </time>
                  </div>
                  {review.title && <h3 className="mt-2.5 text-sm font-bold text-indigo-ink-900">{review.title}</h3>}
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{review.body}</p>
                  <p className="mt-3 text-xs font-medium text-slate-500">— {review.user.name}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            {!user ? (
              <p className="text-sm text-slate-500">
                <Link href={`/login?next=${encodeURIComponent(productPath(product.slug))}`} className="hf-link font-semibold">
                  Sign in
                </Link>{" "}
                to write a review.
              </p>
            ) : reviewed ? (
              <p className="text-sm text-slate-500">You have already reviewed this product. Thank you.</p>
            ) : purchased ? (
              <ReviewForm productId={product.id} />
            ) : (
              <p className="text-sm text-slate-500">You can review this piece once an order containing it has been delivered.</p>
            )}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-xl font-bold text-indigo-ink-950">You may also like</h2>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function Spec({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-indigo-ink-900">{value}</dd>
    </div>
  );
}
