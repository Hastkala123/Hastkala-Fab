import Link from "next/link";
import { env } from "@/lib/env";

export type Crumb = { href: string; label: string };

/**
 * Renders the visible trail and the matching BreadcrumbList JSON-LD.
 *
 * The structured data is what makes Google show "Home › Kurtis › Cotton Kurtis"
 * instead of a raw URL in the result — a measurable click-through improvement
 * on category and product pages.
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: `${env.NEXT_PUBLIC_SITE_URL}${item.href}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.href} className="flex items-center gap-1.5">
                {isLast ? (
                  <span aria-current="page" className="font-medium text-indigo-ink-800">
                    {item.label}
                  </span>
                ) : (
                  <>
                    <Link href={item.href} className="transition hover:text-indigo-ink-700">
                      {item.label}
                    </Link>
                    <span aria-hidden="true" className="text-cotton-400">
                      /
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
