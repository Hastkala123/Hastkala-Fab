import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canSeeWholesalePricing, getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { discountPercent, formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { productCardSelect } from "@/lib/products";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ProductCard from "@/components/store/ProductCard";
import ProductGallery from "@/components/store/ProductGallery";
import BuyBox from "@/components/store/BuyBox";
import ReviewForm from "@/components/store/ReviewForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    select: {
      title: true,
      shortDesc: true,
      description: true,
      metaTitle: true,
      metaDescription: true,
      keywords: true,
      isActive: true,
      images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
    },
  });

  if (!product || !product.isActive) {
    return { title: "Product not found", robots: { index: false, follow: false } };
  }

  const description =
    product.metaDescription ??
    product.shortDesc ??
    product.description.slice(0, 155);

  return {
    title: product.metaTitle ?? product.title,
    description,
    keywords: product.keywords?.split(",").map((k) => k.trim()),
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      type: "website",
      title: product.metaTitle ?? product.title,
      description,
      url: `${env.NEXT_PUBLIC_SITE_URL}/product/${slug}`,
      images: product.images[0]
        ? [{ url: product.images[0].url, width: 900, height: 1200, alt: product.title }]
        : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await db.product.findUnique({
    where: { slug },
    include: {
      category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
      images: { orderBy: { position: "asc" } },
      variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
      reviews: {
        where: { isApproved: true },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!product || !product.isActive) notFound();

  const user = await getCurrentUser();
  const showWholesale = canSeeWholesalePricing(user) && user?.role === "WHOLESALE";
  const price =
    showWholesale && product.priceWholesale != null
      ? product.priceWholesale
      : product.priceRetail;
  const off = discountPercent(product.mrp, price);

  const [related, wishlisted, hasPurchased, hasReviewed] = await Promise.all([
    db.product.findMany({
      where: {
        isActive: true,
        categoryId: product.categoryId,
        id: { not: product.id },
      },
      orderBy: { soldCount: "desc" },
      take: 4,
      select: productCardSelect,
    }),
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

  const inStock = product.stock > 0;

  /**
   * Product JSON-LD. This is what produces the price, availability and star
   * rating directly in Google results — the single highest-leverage SEO change
   * available to an e-commerce catalogue.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDesc ?? product.description.slice(0, 300),
    sku: product.sku,
    image: product.images.map((i) => `${env.NEXT_PUBLIC_SITE_URL}${i.url}`),
    brand: { "@type": "Brand", name: "Hastkala Fab" },
    category: product.category.name,
    material: product.fabric ?? undefined,
    countryOfOrigin: "IN",
    offers: {
      "@type": "Offer",
      url: `${env.NEXT_PUBLIC_SITE_URL}/product/${product.slug}`,
      priceCurrency: "INR",
      price: (product.priceRetail / 100).toFixed(2),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "Hastkala Fab" },
      hasMerchantReturnPolicy: {
        "@type": "MerchantReturnPolicy",
        applicableCountry: "IN",
        returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
        merchantReturnDays: 7,
        returnMethod: "https://schema.org/ReturnByMail",
        returnFees: "https://schema.org/FreeReturn",
      },
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

  const crumbs = [
    { href: "/", label: "Home" },
    ...(product.category.parent
      ? [
          {
            href: `/category/${product.category.parent.slug}`,
            label: product.category.parent.name,
          },
        ]
      : []),
    { href: `/category/${product.category.slug}`, label: product.category.name },
    { href: `/product/${product.slug}`, label: product.title },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="hf-container py-6 sm:py-10">
        <Breadcrumbs items={crumbs} />

        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14">
          <ProductGallery
            images={product.images.map((i) => ({ url: i.url, alt: i.alt }))}
            title={product.title}
          />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/category/${product.category.slug}`}
                className="text-xs font-bold uppercase tracking-wider text-madder-600 hover:underline"
              >
                {product.category.name}
              </Link>
              {product.isNew && (
                <span className="hf-badge text-indigo-ink-700">New</span>
              )}
            </div>

            <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-indigo-ink-950 sm:text-3xl">
              {product.title}
            </h1>

            {product.ratingCount > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-700">
                  {product.ratingAvg.toFixed(1)}
                  <span aria-hidden="true">★</span>
                </span>
                <a href="#reviews" className="text-sm text-slate-500 hover:underline">
                  {product.ratingCount} verified{" "}
                  {product.ratingCount === 1 ? "review" : "reviews"}
                </a>
              </div>
            )}

            {product.shortDesc && (
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                {product.shortDesc}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-3xl font-bold text-indigo-ink-950">
                {formatPrice(price)}
              </span>
              {product.mrp > price && (
                <>
                  <span className="text-lg text-slate-400 line-through">
                    {formatPrice(product.mrp)}
                  </span>
                  <span className="rounded-md bg-madder-600 px-2 py-1 text-xs font-bold text-white">
                    {off}% OFF
                  </span>
                </>
              )}
            </div>

            {/*
              Legal Metrology (Packaged Commodities) Rules require the MRP to be
              declared as inclusive of all taxes wherever it is displayed.
            */}
            <p className="mt-1 text-xs text-slate-500">
              MRP inclusive of all taxes · GST calculated at checkout
            </p>

            {showWholesale && product.priceWholesale != null && (
              <div className="mt-3 rounded-lg border border-madder-200 bg-madder-50 px-3.5 py-2.5">
                <p className="text-sm font-semibold text-madder-800">
                  Wholesale rate applied
                </p>
                <p className="text-xs text-madder-700">
                  Minimum order {product.wholesaleMinQty} units · retail{" "}
                  {formatPrice(product.priceRetail)}
                </p>
              </div>
            )}

            <BuyBox
              productId={product.id}
              productTitle={product.title}
              stock={product.stock}
              minQty={showWholesale ? product.wholesaleMinQty : 1}
              wishlisted={Boolean(wishlisted)}
              variants={product.variants.map((v) => ({
                id: v.id,
                size: v.size,
                color: v.color,
                stock: v.stock,
                priceDelta: v.priceDelta,
              }))}
              basePrice={price}
            />

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-cotton-300 pt-6 text-sm">
              <Spec label="Fabric" value={product.fabric} />
              <Spec label="Print" value={product.printType} />
              <Spec label="Work" value={product.workType} />
              <Spec label="Occasion" value={product.occasion} />
              <Spec label="SKU" value={product.sku} />
              {/*
                Country of origin is a mandatory disclosure for goods sold
                online in India under the Consumer Protection (E-Commerce)
                Rules, 2020.
              */}
              <Spec label="Country of origin" value="India" />
              <Spec label="Made in" value={product.origin} />
              <Spec label="Marketed by" value="Hastkala Fab, Sanganer, Jaipur — 302029" />
            </dl>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Assurance title="Free delivery" detail="On orders above ₹999" />
              <Assurance title="7-day returns" detail="Unused, tags intact" />
              <Assurance title="Secure payment" detail="UPI, cards, COD" />
            </div>
          </div>
        </div>

        {/* ------------- Description & care ------------- */}
        <section className="mt-14 grid gap-10 lg:grid-cols-3 lg:gap-14">
          <div className="lg:col-span-2">
            <h2 className="font-display text-xl font-bold text-indigo-ink-950">
              About this piece
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700">
              {product.description.split("\n\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            <div className="mt-6 rounded-card border border-turmeric-200 bg-turmeric-50 p-4">
              <h3 className="text-sm font-bold text-turmeric-900">
                A note on hand block printing
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-turmeric-800">
                Slight irregularities in motif placement, colour depth and block
                registration are inherent to hand printing and are not defects.
                They are what distinguishes a genuine Sanganeri piece from a
                machine-printed reproduction.
              </p>
            </div>
          </div>

          <aside>
            {product.washCare && (
              <div className="hf-card p-5">
                <h3 className="font-display text-base font-bold text-indigo-ink-950">
                  Care instructions
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {product.washCare}
                </p>
              </div>
            )}

            <div className="hf-card mt-4 p-5">
              <h3 className="font-display text-base font-bold text-indigo-ink-950">
                Delivery &amp; returns
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                <li>Dispatched from Jaipur in 24–48 hours</li>
                <li>3–5 working days to metros, 5–8 elsewhere</li>
                <li>7-day return window from delivery</li>
                <li>Free reverse pickup on defective items</li>
              </ul>
              <Link href="/returns-policy" className="hf-link mt-3 inline-block text-sm font-semibold">
                Read the full policy →
              </Link>
            </div>
          </aside>
        </section>

        {/* ------------- Reviews ------------- */}
        <section id="reviews" className="mt-14 scroll-mt-24">
          <h2 className="font-display text-xl font-bold text-indigo-ink-950">
            Customer reviews
          </h2>

          {product.reviews.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No reviews yet. If you have bought this piece, yours would be the first.
            </p>
          ) : (
            <ul className="mt-5 grid gap-4 sm:grid-cols-2">
              {product.reviews.map((review) => (
                <li key={review.id} className="hf-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-sm font-bold text-turmeric-600"
                        aria-label={`${review.rating} out of 5 stars`}
                      >
                        {"★".repeat(review.rating)}
                        <span className="text-cotton-400">
                          {"★".repeat(5 - review.rating)}
                        </span>
                      </span>
                      {review.isVerifiedPurchase && (
                        <span className="hf-badge text-emerald-700">Verified</span>
                      )}
                    </div>
                    <time
                      dateTime={review.createdAt.toISOString()}
                      className="text-xs text-slate-400"
                    >
                      {formatDate(review.createdAt)}
                    </time>
                  </div>

                  {review.title && (
                    <h3 className="mt-2.5 text-sm font-bold text-indigo-ink-900">
                      {review.title}
                    </h3>
                  )}
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {review.comment}
                  </p>
                  <p className="mt-3 text-xs font-medium text-slate-500">
                    — {review.user.name}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6">
            {!user ? (
              <p className="text-sm text-slate-500">
                <Link href={`/login?next=/product/${product.slug}`} className="hf-link font-semibold">
                  Sign in
                </Link>{" "}
                to write a review.
              </p>
            ) : hasReviewed ? (
              <p className="text-sm text-slate-500">
                You have already reviewed this product. Thank you.
              </p>
            ) : hasPurchased ? (
              <ReviewForm productId={product.id} />
            ) : (
              <p className="text-sm text-slate-500">
                Reviews can be written once you have received an order containing
                this product.
              </p>
            )}
          </div>
        </section>

        {/* ------------- Related ------------- */}
        {related.length > 0 && (
          <section className="mt-16">
            <h2 className="font-display text-xl font-bold text-indigo-ink-950">
              You may also like
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
              {related.map((item) => (
                <ProductCard
                  key={item.id}
                  product={item}
                  showWholesale={showWholesale}
                />
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

function Assurance({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-cotton-300 bg-cotton-100 px-3 py-2.5 text-center">
      <p className="text-xs font-bold text-indigo-ink-900">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}
