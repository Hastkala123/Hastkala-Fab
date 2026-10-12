import type { Metadata } from "next";
import { isApprovedWholesale } from "@/lib/auth";
import { requireUserPage } from "@/server/auth/page-guard";
import { viewerFor } from "@/server/catalog/viewer";
import { getSettings } from "@/server/settings";
import { wholesaleDesigns } from "@/server/wholesale/catalogue";
import NotApproved from "@/components/wholesale/NotApproved";
import QuickOrderGrid from "./QuickOrderGrid";

export const metadata: Metadata = { title: "Quick order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function QuickOrderPage() {
  const user = await requireUserPage("/account/wholesale/quick-order");
  if (!isApprovedWholesale(user)) return <NotApproved />;
  const [designs, settings] = await Promise.all([wholesaleDesigns(await viewerFor(user)), getSettings()]);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950 sm:text-3xl">Quick order</h1>
      <p className="mt-1 text-sm text-slate-600">
        Type quantities for each size. Prices update as you go; sizes and colours of a design count together towards its
        minimum and price breaks.
      </p>
      <div className="mt-6">
        <QuickOrderGrid designs={designs} plusGst={!settings.tax.wholesalePricesIncludeTax} />
      </div>
    </div>
  );
}
