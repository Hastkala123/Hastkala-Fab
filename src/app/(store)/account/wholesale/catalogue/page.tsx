import type { Metadata } from "next";
import Image from "next/image";
import { isApprovedWholesale } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { requireUserPage } from "@/server/auth/page-guard";
import { viewerFor } from "@/server/catalog/viewer";
import { getSettings } from "@/server/settings";
import { getWholesaleAccount } from "@/server/wholesale/account";
import { wholesaleDesigns } from "@/server/wholesale/catalogue";
import NotApproved from "@/components/wholesale/NotApproved";
import PrintButton from "@/components/wholesale/PrintButton";

export const metadata: Metadata = { title: "Wholesale catalogue", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * The line sheet: every wholesale design with sizes, minimums and this
 * buyer's prices. Laid out to print cleanly (or "Save as PDF").
 */
export default async function CataloguePage() {
  const user = await requireUserPage("/account/wholesale/catalogue");
  if (!isApprovedWholesale(user)) return <NotApproved />;
  const [designs, settings, account] = await Promise.all([
    wholesaleDesigns(await viewerFor(user)),
    getSettings(),
    getWholesaleAccount(user.id),
  ]);
  const plusGst = !settings.tax.wholesalePricesIncludeTax;
  const byCategory = designs.reduce<Map<string, typeof designs>>((map, d) => {
    map.set(d.categoryName, [...(map.get(d.categoryName) ?? []), d]);
    return map;
  }, new Map());
  const profile = settings["store.profile"];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">Catalogue & price list</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your trade prices ({account?.priceTier?.name ?? "Standard"} tier){plusGst ? ", before GST" : ""}. Print it, save it as a PDF, or
            download the price list for Excel.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <a href="/api/wholesale/price-list" download className="hf-btn hf-btn-outline">
            Download price list (Excel / CSV)
          </a>
        </div>
      </div>

      <header className="hidden print:block">
        <p className="font-display text-2xl font-bold">{profile.displayName} — wholesale catalogue</p>
        <p className="text-sm">
          Prepared for {account?.businessName ?? user.name} · {formatDate(new Date())} · prices per piece{plusGst ? " + GST" : ""}
          {profile.phone ? ` · ${profile.phone}` : ""}
        </p>
      </header>

      {designs.length === 0 ? (
        <p className="hf-card mt-6 p-8 text-center text-sm text-slate-500">No wholesale designs yet.</p>
      ) : (
        [...byCategory].map(([category, items]) => (
          <section key={category} className="mt-8 break-inside-avoid-page">
            <h2 className="border-b border-cotton-300 pb-2 font-display text-xl font-bold text-indigo-ink-950">{category}</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3 print:grid-cols-3">
              {items.map((design) => (
                <article key={design.id} className="break-inside-avoid rounded-lg border border-cotton-300 p-3">
                  <div className="relative aspect-[3/4] overflow-hidden rounded bg-cotton-100">
                    {design.image && <Image src={design.image.url} alt={design.image.alt} fill sizes="(min-width: 1024px) 20vw, 45vw" className="object-cover" />}
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-snug text-indigo-ink-950">{design.title}</p>
                  <p className="text-[11px] text-slate-500">{design.variants.map((v) => v.sku).slice(0, 3).join(", ")}{design.variants.length > 3 ? " …" : ""}</p>
                  <p className="mt-1 text-xs text-slate-600">{[...new Set(design.variants.map((v) => v.label))].join(" · ")}</p>
                  {design.minQuantity != null && <p className="mt-1 text-xs font-medium text-slate-700">Min. {design.minQuantity} pcs</p>}
                  <table className="mt-1.5 w-full text-xs">
                    <tbody>
                      {design.prices.map((p) => (
                        <tr key={p.minQuantity}>
                          <td className="text-slate-500">{p.minQuantity}+ pcs</td>
                          <td className="text-right font-semibold text-indigo-ink-950">
                            {formatPrice(p.unitPrice)}
                            {plusGst ? " + GST" : ""}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="text-slate-400">MRP</td>
                        <td className="text-right text-slate-400">{formatPrice(design.retailPrice)}</td>
                      </tr>
                    </tbody>
                  </table>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
