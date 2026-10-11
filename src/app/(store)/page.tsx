import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { canSeeWholesalePricing, getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import ProductCard, { type ProductCardData } from "@/components/store/ProductCard";

export const metadata: Metadata = {
  title: "Hastkala Fab — Authentic Sanganeri Print Kurtis, Sarees, Suits & Bedsheets",
  description:
    "Shop hand-block Sanganeri print kurtis, sarees, ladies suit sets and pure cotton bedsheets direct from Sanganer, Jaipur. Retail & wholesale. Free shipping above ₹999.",
  alternates: { canonical: "/" },
};

// The homepage personalises pricing and wishlist state per visitor, so it reads
// cookies and must render dynamically. Caching happens at the data layer
// instead — see the indexed queries in prisma/schema.prisma.
export const dynamic = "force-dynamic";

const productSelect = {
  id: true,
  title: true,
  slug: true,
  priceRetail: true,
  priceWholesale: true,
  mrp: true,
  stock: true,
  isNew: true,
  fabric: true,
  ratingAvg: true,
  ratingCount: true,
  images: { orderBy: { position: "asc" }, take: 2, select: { url: true, alt: true } },
} as const;

export default async function HomePage() {
  const user = await getCurrentUser();
  const wholesale = canSeeWholesalePricing(user) && user?.role === "WHOLESALE";

  const [categories, featured, newArrivals, bestSellers, stats] = await Promise.all([
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: "asc" },
      take: 6,
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        description: true,
        _count: { select: { products: true } },
      },
    }),
    db.product.findMany({
      where: { isActive: true, isFeatured: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productSelect,
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productSelect,
    }),
    db.product.findMany({
      where: { isActive: true, soldCount: { gt: 0 } },
      orderBy: { soldCount: "desc" },
      take: 4,
      select: productSelect,
    }),
    db.product.aggregate({ _count: { id: true } }),
  ]);

  const wishlistIds = user
    ? new Set(
        (
          await db.wishlistItem.findMany({
            where: { userId: user.id },
            select: { productId: true },
          })
        ).map((w) => w.productId),
      )
    : new Set<string>();

  // Organisation + WebSite JSON-LD. This is what earns the sitelinks search box
  // and the knowledge panel in Google results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${env.NEXT_PUBLIC_SITE_URL}/#organization`,
        name: "Hastkala Fab",
        url: env.NEXT_PUBLIC_SITE_URL,
        description:
          "Retail and wholesale seller of authentic Sanganeri hand-block printed kurtis, sarees, ladies suits and bedsheets.",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Sanganer, Jaipur",
          addressRegion: "Rajasthan",
          addressCountry: "IN",
        },
      },
      {
        "@type": "WebSite",
        "@id": `${env.NEXT_PUBLIC_SITE_URL}/#website`,
        url: env.NEXT_PUBLIC_SITE_URL,
        name: "Hastkala Fab",
        publisher: { "@id": `${env.NEXT_PUBLIC_SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${env.NEXT_PUBLIC_SITE_URL}/products?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-ink-900 via-indigo-ink-800 to-indigo-ink-950">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, #fdfbf7 2px, transparent 2.2px), radial-gradient(circle at 50% 50%, #e5b23a 1.5px, transparent 1.7px)",
            backgroundSize: "44px 44px, 44px 44px",
            backgroundPosition: "0 0, 22px 22px",
          }}
        />

        <div className="hf-container relative py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl">
            <span className="hf-badge text-turmeric-300">
              Direct from Sanganer, Jaipur
            </span>

            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight text-cotton-50 sm:text-5xl lg:text-6xl">
              Four centuries of block printing,{" "}
              <span className="text-turmeric-400">stitched into every piece.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-cotton-200/85 sm:text-lg">
              Hand-carved wooden blocks. Natural dyes. Pure cotton. Explore our
              collection of Sanganeri print kurtis, sarees, ladies suit sets and
              bedsheets — made by artisan families we have worked with for
              generations.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="hf-btn hf-btn-accent px-6 py-3 text-base">
                Shop the collection
              </Link>
              <Link
                href="/wholesale"
                className="hf-btn px-6 py-3 text-base text-cotton-50 ring-1 ring-inset ring-cotton-50/30 transition hover:bg-cotton-50/10"
              >
                Wholesale enquiry
              </Link>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
              <HeroStat value={`${stats._count.id}+`} label="Handpicked designs" />
              <HeroStat value="100%" label="Pure cotton" />
              <HeroStat value="7-day" label="Easy returns" />
            </dl>
          </div>
        </div>

        <div className="hf-motif opacity-25" />
      </section>

      {/* ---------------- Categories ---------------- */}
      <section className="hf-container py-14 sm:py-20">
        <SectionHeading
          eyebrow="Shop by category"
          title="Find your weave"
          description="From everyday cotton kurtis to festive suit sets and bedsheets that make a room."
        />

        {categories.length === 0 ? (
          <EmptyHint>
            No categories yet. Sign in as an admin and add your first category from
            the dashboard.
          </EmptyHint>
        ) : (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-3">
            {categories.map((category, index) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="group relative overflow-hidden rounded-card ring-1 ring-cotton-300 transition hover:ring-indigo-ink-400"
              >
                <div className="relative aspect-[4/3] bg-cotton-200">
                  {category.imageUrl ? (
                    <Image
                      src={category.imageUrl}
                      alt={category.name}
                      fill
                      sizes="(max-width: 1024px) 50vw, 33vw"
                      priority={index < 2}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="h-full w-full"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 50% 50%, #2d5480 3px, transparent 3.2px), radial-gradient(circle at 50% 50%, #b34733 2px, transparent 2.2px)",
                        backgroundSize: "36px 36px, 36px 36px",
                        backgroundPosition: "0 0, 18px 18px",
                        backgroundColor: "#f3ebdc",
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-ink-950/80 via-indigo-ink-950/10 to-transparent" />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <h3 className="font-display text-lg font-bold text-cotton-50 sm:text-xl">
                    {category.name}
                  </h3>
                  <p className="mt-0.5 text-xs text-cotton-200/80">
                    {category._count.products}{" "}
                    {category._count.products === 1 ? "design" : "designs"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------------- Featured ---------------- */}
      {featured.length > 0 && (
        <section className="bg-cotton-100 py-14 sm:py-20">
          <div className="hf-container">
            <SectionHeading
              eyebrow="Handpicked"
              title="Featured this season"
              description="The pieces our artisans and our customers keep coming back to."
              action={{ href: "/products", label: "View all" }}
            />
            <ProductGrid
              products={featured}
              wholesale={wholesale}
              wishlistIds={wishlistIds}
            />
          </div>
        </section>
      )}

      {/* ---------------- Craft story ---------------- */}
      <section className="hf-container py-14 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="hf-badge text-madder-600">The Sanganeri craft</span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-indigo-ink-950 sm:text-4xl">
              Every motif is pressed by hand, one block at a time
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Sanganeri printing began on the banks of the Saraswati near Jaipur,
              where the water's mineral content set natural dyes in a way no other
              river could. Our printers still work that way: teak blocks carved by
              hand, dyes ground from madder root, indigo and turmeric, and fabric
              washed in the open sun.
            </p>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              It means no two pieces are identical. Slight variation in the print is
              not a defect — it is the signature of a human hand.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <CraftStep n="01" label="Carve the block" />
              <CraftStep n="02" label="Mix natural dye" />
              <CraftStep n="03" label="Press by hand" />
              <CraftStep n="04" label="Sun-wash & set" />
            </div>
            <Link href="/about" className="hf-btn hf-btn-outline mt-7">
              Read our full story
            </Link>
          </div>

          <div className="relative aspect-[4/3] overflow-hidden rounded-card ring-1 ring-cotton-300">
            <div
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 50% 50%, #1e3a5f 5px, transparent 5.4px), radial-gradient(circle at 50% 50%, #b34733 3.5px, transparent 3.8px), radial-gradient(circle at 50% 50%, #c9a227 2px, transparent 2.2px)",
                backgroundSize: "72px 72px, 72px 72px, 36px 36px",
                backgroundPosition: "0 0, 36px 36px, 18px 18px",
                backgroundColor: "#faf6ee",
              }}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cotton-50 to-transparent p-6 pt-16">
              <p className="font-display text-lg font-semibold text-indigo-ink-900">
                Sanganer, Jaipur — Rajasthan
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Working with 40+ artisan families
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- New arrivals ---------------- */}
      {newArrivals.length > 0 && (
        <section className="bg-cotton-100 py-14 sm:py-20">
          <div className="hf-container">
            <SectionHeading
              eyebrow="Fresh off the block"
              title="New arrivals"
              description="Just printed, just listed."
              action={{ href: "/products?sort=newest", label: "See all new" }}
            />
            <ProductGrid
              products={newArrivals}
              wholesale={wholesale}
              wishlistIds={wishlistIds}
            />
          </div>
        </section>
      )}

      {/* ---------------- Best sellers ---------------- */}
      {bestSellers.length > 0 && (
        <section className="hf-container py-14 sm:py-20">
          <SectionHeading
            eyebrow="Loved by our customers"
            title="Best sellers"
            action={{ href: "/products?sort=popular", label: "View all" }}
          />
          <ProductGrid
            products={bestSellers}
            wholesale={wholesale}
            wishlistIds={wishlistIds}
          />
        </section>
      )}

      {/* ---------------- Wholesale CTA ---------------- */}
      <section className="hf-container pb-16">
        <div className="relative overflow-hidden rounded-card bg-indigo-ink-900 px-6 py-12 sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, #e5b23a 2px, transparent 2.2px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative max-w-2xl">
            <span className="hf-badge text-turmeric-300">For retailers & boutiques</span>
            <h2 className="mt-4 font-display text-3xl font-bold text-cotton-50 sm:text-4xl">
              Buy wholesale, straight from the printers
            </h2>
            <p className="mt-3 text-cotton-200/85">
              Register a wholesale account for trade pricing, MOQs from 10 pieces,
              custom colourways and priority dispatch. GST invoicing included.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/signup?type=wholesale" className="hf-btn hf-btn-accent px-6 py-3">
                Register as wholesaler
              </Link>
              <Link
                href="/wholesale"
                className="hf-btn px-6 py-3 text-cotton-50 ring-1 ring-inset ring-cotton-50/30 hover:bg-cotton-50/10"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------

function ProductGrid({
  products,
  wholesale,
  wishlistIds,
}: {
  products: ProductCardData[];
  wholesale: boolean;
  wishlistIds: Set<string>;
}) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          showWholesale={wholesale}
          priority={index < 4}
          wishlisted={wishlistIds.has(product.id)}
        />
      ))}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-madder-600">
          {eyebrow}
        </span>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-xl text-sm text-slate-600">{description}</p>
        )}
      </div>
      {action && (
        <Link href={action.href} className="hf-link text-sm font-semibold">
          {action.label} →
        </Link>
      )}
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-2xl font-bold text-turmeric-400">{value}</dd>
      <p className="mt-0.5 text-xs uppercase tracking-wider text-cotton-300/70">{label}</p>
    </div>
  );
}

function CraftStep({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-lg border border-cotton-300 bg-cotton-50 p-3">
      <span className="font-display text-sm font-bold text-madder-600">{n}</span>
      <p className="mt-1 text-xs font-medium leading-snug text-indigo-ink-900">{label}</p>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-card border border-dashed border-cotton-400 bg-cotton-100 p-8 text-center">
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}
