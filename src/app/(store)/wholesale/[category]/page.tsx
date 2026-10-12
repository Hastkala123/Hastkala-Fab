import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser, isApprovedWholesale } from "@/lib/auth";
import { parseFaq, whatsappLink } from "@/lib/wholesale-content";
import { getCategoryPage } from "@/server/catalog/products";
import { getViewer } from "@/server/catalog/viewer";
import { getSettings } from "@/server/settings";
import { wholesaleCategories, wholesaleDesigns } from "@/server/wholesale/catalogue";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import DesignCard from "@/components/wholesale/DesignCard";
import InquiryForm from "@/components/wholesale/InquiryForm";
import WholesaleCta from "@/components/wholesale/WholesaleCta";
import WholesaleFaq from "@/components/wholesale/WholesaleFaq";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const page = await getCategoryPage(slug);
  if (!page) return {};
  const name = page.category.name;
  return {
    title: `${name} Wholesale — Sanganeri Hand Block Print from Jaipur`,
    description: `Buy ${name.toLowerCase()} wholesale direct from Sanganer, Jaipur: hand-block printed designs at trade prices, with GST invoices and dispatch across India.`,
    keywords: [`${name.toLowerCase()} wholesale`, `jaipuri ${name.toLowerCase()} wholesale`, `sanganeri ${name.toLowerCase()} wholesale`, `hand block print ${name.toLowerCase()} wholesale`],
    alternates: { canonical: `/wholesale/${page.category.slug}` },
  };
}

export default async function WholesaleCategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const page = await getCategoryPage(slug);
  if (!page) notFound();
  const { category } = page;

  const [user, viewer, settings, categories] = await Promise.all([getCurrentUser(), getViewer(), getSettings(), wholesaleCategories()]);
  const designs = await wholesaleDesigns(viewer, { categorySlug: category.slug });
  const approved = isApprovedWholesale(user);
  const plusGst = !settings.tax.wholesalePricesIncludeTax;
  const profile = settings["store.profile"];
  const whatsapp = profile.whatsapp ? whatsappLink(profile.whatsapp, `Hello! I'd like wholesale prices for ${category.name}.`) : null;
  const intro =
    category.wholesaleIntro ??
    `Hand-block printed ${category.name.toLowerCase()} from Sanganer, Jaipur, at trade prices for boutiques, retail stores and resellers. ${settings.wholesale.moqText} Every order ships with a GST invoice.`;

  return (
    <div>
      <section className="bg-indigo-ink-900">
        <div className="hf-container py-12 sm:py-16">
          <Breadcrumbs
            tone="dark"
            items={[
              { href: "/", label: "Home" },
              { href: "/wholesale", label: "Wholesale" },
              { href: `/wholesale/${category.slug}`, label: category.name },
            ]}
          />
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-cotton-50 sm:text-5xl">
            {category.name} wholesale
          </h1>
          <p className="mt-4 max-w-2xl whitespace-pre-line text-lg leading-relaxed text-cotton-200/90">{intro}</p>
          <div className="mt-7">
            <WholesaleCta user={user} whatsapp={whatsapp} />
          </div>
        </div>
      </section>

      <section className="hf-container py-12">
        {designs.length === 0 ? (
          <p className="hf-card p-8 text-center text-slate-600">
            New {category.name.toLowerCase()} designs are being added. Send an enquiry below and we&apos;ll share what&apos;s in production.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {designs.length} design{designs.length === 1 ? "" : "s"} available wholesale
              {approved ? "" : " · sign in with an approved wholesale account to see trade prices"}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
              {designs.map((design) => (
                <DesignCard key={design.id} design={design} showTradePrice={approved} plusGst={plusGst} />
              ))}
            </div>
          </>
        )}
        <p className="mt-8 text-sm">
          <Link href={`/${category.slug}`} className="hf-link font-semibold">
            Shop {category.name.toLowerCase()} at retail prices →
          </Link>
        </p>
      </section>

      <section className="bg-cotton-100 py-12">
        <div className="hf-container grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo-ink-950">Enquire about {category.name.toLowerCase()} wholesale</h2>
            <p className="mt-3 text-slate-600">Tell us the designs, quantities and colours you need — we&apos;ll reply within one working day.</p>
          </div>
          <div className="hf-card p-5 sm:p-6">
            <InquiryForm categories={categories.map((c) => c.name)} preselected={[category.name]} source={`wholesale/${category.slug}`} />
          </div>
        </div>
      </section>

      <section className="hf-container py-12">
        <h2 className="font-display text-2xl font-bold text-indigo-ink-950">Questions</h2>
        <div className="mt-6 max-w-3xl">
          <WholesaleFaq items={parseFaq(settings.wholesale.faq)} />
        </div>
      </section>
    </div>
  );
}
