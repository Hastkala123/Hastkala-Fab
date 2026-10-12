import Link from "next/link";
import { formatPrice } from "@/lib/money";
import { getCategories } from "@/server/catalog/products";
import { getSettings } from "@/server/settings";
import { footerPages, isFixedPage, pagePath, publishedPageSlugs } from "@/server/content/pages";
import NewsletterForm from "./NewsletterForm";

const helpLinks = [
  { href: "/account/support", label: "Help Centre" },
  { href: "/faq", label: "FAQs" },
  { href: "/track", label: "Track Your Order" },
  { href: "/shipping-policy", label: "Shipping & Delivery" },
  { href: "/returns-policy", label: "Returns & Exchange" },
  { href: "/contact", label: "Contact Us" },
];

const companyLinks = [
  { href: "/about", label: "Our Story" },
  { href: "/wholesale", label: "Wholesale / Bulk Orders" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
];

export default async function Footer() {
  const [categories, settings, published, extraPages] = await Promise.all([
    getCategories(),
    getSettings(),
    publishedPageSlugs(),
    footerPages(),
  ]);
  // Pages from Admin → Content appear once published; the rest always exist.
  const live = (link: { href: string }) => {
    const slug = link.href.slice(1);
    return !isFixedPage(slug) || slug === "contact" || published.has(slug);
  };
  const help = helpLinks.filter(live);
  const company = [
    ...companyLinks.filter(live),
    ...extraPages.map((p) => ({ href: pagePath(p.slug), label: p.title })),
  ];
  // Shop links follow the categories (and their order) set in Admin → Categories.
  const shopLinks = [
    ...categories
      .filter((c) => c.parentId === null && c.showInMenu)
      .slice(0, 6)
      .map((c) => ({ href: `/${c.slug}`, label: c.name })),
    { href: "/search?sort=newest", label: "New Arrivals" },
    { href: "/search?sort=popular", label: "Best Sellers" },
  ];
  const freeShipping = settings.shipping.freeShippingThreshold;
  const returnDays = settings.returns.windowDays;

  return (
    <footer className="mt-20 border-t border-cotton-300 bg-indigo-ink-950 text-cotton-200">
      <div className="hf-motif" />

      <div className="hf-container py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-cotton-50 text-indigo-ink-900">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
                  <path d="M12 3.2c1.9 2 3 3.6 3 5.3 0 1.7-1.3 3-3 3s-3-1.3-3-3c0-1.7 1.1-3.3 3-5.3Z" fill="currentColor" />
                  <path d="M12 20.8c-1.9-2-3-3.6-3-5.3 0-1.7 1.3-3 3-3s3 1.3 3 3c0 1.7-1.1 3.3-3 5.3Z" fill="currentColor" opacity=".6" />
                  <path d="M3.2 12c2-1.9 3.6-3 5.3-3M20.8 12c-2 1.9-3.6 3-5.3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-xl font-bold text-cotton-50">Hastkala Fab</span>
                <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-turmeric-400">
                  Sanganeri Handblock
                </span>
              </span>
            </div>

            <p className="mt-5 max-w-sm text-sm leading-relaxed text-cotton-300/80">
              Hand-block Sanganeri prints from Sanganer, Jaipur — carved wooden
              blocks and pure cotton. We sell direct to your wardrobe and to
              retailers across India.
            </p>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-turmeric-400">
                New prints and offers, in your inbox
              </p>
              <NewsletterForm />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            <FooterColumn title="Shop" links={shopLinks} />
            <FooterColumn title="Help" links={help} />
            <FooterColumn title="Company" links={company} />
          </div>
        </div>

        <div className="mt-12 grid gap-6 border-t border-white/10 pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {freeShipping != null && (
            <TrustItem title="Free shipping" detail={`On orders of ${formatPrice(freeShipping)} and above`} />
          )}
          {returnDays > 0 && <TrustItem title={`${returnDays}-day returns`} detail="Easy exchange & refund" />}
          <TrustItem title="Secure checkout" detail="UPI, cards, net banking and COD" />
          <TrustItem title="Wholesale" detail="Trade prices for registered businesses" />
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-cotton-300/70 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>
              © {new Date().getFullYear()} Hastkala Fab. All rights reserved. Handcrafted in
              Sanganer, Jaipur, Rajasthan.
            </p>
            <p>
              Designed and developed by{" "}
              <a
                href="https://naigrowth.com"
                target="_blank"
                rel="noopener"
                className="font-semibold text-cotton-200 underline-offset-2 transition hover:text-cotton-50 hover:underline"
              >
                Naigrowth
              </a>
            </p>
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {published.has("privacy-policy") && (
              <Link href="/privacy-policy" className="transition hover:text-cotton-50">Privacy</Link>
            )}
            {published.has("terms") && (
              <Link href="/terms" className="transition hover:text-cotton-50">Terms</Link>
            )}
            <Link href="/sitemap.xml" className="transition hover:text-cotton-50">Sitemap</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h3 className="font-display text-sm font-bold uppercase tracking-wider text-cotton-50">
        {title}
      </h3>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link
              href={link.href}
              className="text-sm text-cotton-300/80 transition hover:text-turmeric-300"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrustItem({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 text-turmeric-400">✦</span>
      <div>
        <p className="text-sm font-semibold text-cotton-50">{title}</p>
        <p className="text-xs text-cotton-300/70">{detail}</p>
      </div>
    </div>
  );
}
