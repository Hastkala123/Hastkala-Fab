import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser, isApprovedWholesale } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import { parseFaq, whatsappLink } from "@/lib/wholesale-content";
import { getViewer } from "@/server/catalog/viewer";
import { getSettings } from "@/server/settings";
import { wholesaleCategories, wholesaleDesigns } from "@/server/wholesale/catalogue";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import DesignCard from "@/components/wholesale/DesignCard";
import InquiryForm from "@/components/wholesale/InquiryForm";
import WholesaleCta from "@/components/wholesale/WholesaleCta";
import WholesaleFaq from "@/components/wholesale/WholesaleFaq";

export const metadata: Metadata = {
  title: "Wholesale Hand Block Print Kurtis, Suits, Sarees & Bedsheets from Jaipur",
  description:
    "Buy Sanganeri hand-block print kurtis, salwar suits, sarees and Jaipuri cotton bedsheets wholesale, direct from Sanganer, Jaipur. Trade prices, GST invoices, dispatch across India.",
  keywords: [
    "jaipuri kurti wholesale",
    "sanganeri print wholesale",
    "hand block print wholesale jaipur",
    "cotton bedsheet wholesale jaipur",
    "block print saree wholesale",
    "salwar suit wholesale jaipur",
    "kurti manufacturer jaipur wholesale",
  ],
  alternates: { canonical: "/wholesale" },
};

export const dynamic = "force-dynamic";

export default async function WholesalePage() {
  const [user, viewer, settings, categories] = await Promise.all([
    getCurrentUser(),
    getViewer(),
    getSettings(),
    wholesaleCategories(),
  ]);
  const designs = await wholesaleDesigns(viewer, { take: 8 });
  const w = settings.wholesale;
  const profile = settings["store.profile"];
  const whatsapp = profile.whatsapp ? whatsappLink(profile.whatsapp, "Hello! I'd like to know about wholesale.") : null;
  const plusGst = !settings.tax.wholesalePricesIncludeTax;
  const approved = isApprovedWholesale(user);

  const benefits = [
    { title: "Direct from Sanganer", detail: "Hand-block printed in Sanganer, Jaipur — no middlemen between you and the printers." },
    { title: "Trade prices", detail: `Prices drop as quantities rise${plusGst ? ", quoted + GST" : ""}. ${w.moqText}` },
    { title: profile.gstin ? "GST invoices" : "Proper invoices", detail: profile.gstin ? "Every order comes with a GST invoice in your business name, so you can claim input tax credit." : "Every order comes with an invoice in your business name." },
    { title: "Pay your way", detail: `UPI, cards, net banking${w.bankTransferEnabled ? " or bank transfer" : ""}. Regular buyers can be offered advance-and-balance or credit terms.` },
    { title: "Dispatch from Jaipur", detail: settings.shipping.dispatchText },
    ...(w.minOrderValue > 0 ? [{ title: "Minimum order", detail: `Wholesale orders start at ${formatPrice(w.minOrderValue)}.` }] : []),
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-indigo-ink-900">
        <div className="hf-container relative py-14 sm:py-20">
          <Breadcrumbs tone="dark" items={[{ href: "/", label: "Home" }, { href: "/wholesale", label: "Wholesale" }]} />
          <span className="hf-badge mt-6 text-turmeric-300">For boutiques, retailers & resellers</span>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-cotton-50 sm:text-5xl">
            {w.landingHeadline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cotton-200/90">{w.landingIntro}</p>
          <div className="mt-8">
            <WholesaleCta user={user} whatsapp={whatsapp} />
          </div>
        </div>
        <div className="hf-motif opacity-20" />
      </section>

      <section className="hf-container py-14" aria-labelledby="how">
        <h2 id="how" className="font-display text-2xl font-bold text-indigo-ink-950 sm:text-3xl">
          How wholesale works
        </h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Apply", "Create an account with your business details and GSTIN, and add a document or two."],
            ["Get approved", "We check your details — usually within one working day — and switch on trade prices."],
            ["Order in bulk", "Use quick order to enter quantities per size across many designs at once."],
            ["We dispatch", "Pay online or by bank transfer; your order leaves Jaipur with a GST invoice."],
          ].map(([title, detail], index) => (
            <li key={title} className="hf-card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-madder-600 font-display font-bold text-white">
                {index + 1}
              </span>
              <p className="mt-4 font-display text-lg font-bold text-indigo-ink-950">{title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{detail}</p>
            </li>
          ))}
        </ol>
      </section>

      {categories.length > 0 && (
        <section className="bg-cotton-100 py-14" aria-labelledby="ranges">
          <div className="hf-container">
            <h2 id="ranges" className="font-display text-2xl font-bold text-indigo-ink-950 sm:text-3xl">
              Wholesale ranges
            </h2>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {categories.map((category) => (
                <li key={category.id}>
                  <Link
                    href={`/wholesale/${category.slug}`}
                    className="hf-card block p-5 transition hover:border-indigo-ink-300"
                  >
                    <p className="font-display text-lg font-bold text-indigo-ink-950">{category.name} wholesale</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {category.designs} design{category.designs === 1 ? "" : "s"} →
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {designs.length > 0 && (
        <section className="hf-container py-14" aria-labelledby="designs">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="designs" className="font-display text-2xl font-bold text-indigo-ink-950 sm:text-3xl">
              Designs available wholesale
            </h2>
            {approved && (
              <Link href="/account/wholesale/quick-order" className="hf-link text-sm font-semibold">
                Order in bulk →
              </Link>
            )}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-5 lg:grid-cols-4">
            {designs.map((design) => (
              <DesignCard key={design.id} design={design} showTradePrice={approved} plusGst={plusGst} />
            ))}
          </div>
        </section>
      )}

      <section className="hf-container pb-14" aria-labelledby="why">
        <h2 id="why" className="font-display text-2xl font-bold text-indigo-ink-950 sm:text-3xl">
          Why buy from Hastkala Fab
        </h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => (
            <li key={b.title} className="rounded-card border border-cotton-300 p-5">
              <p className="font-semibold text-indigo-ink-950">{b.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{b.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="enquiry" className="bg-cotton-100 py-14" aria-labelledby="enquire">
        <div className="hf-container grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="enquire" className="font-display text-2xl font-bold text-indigo-ink-950 sm:text-3xl">
              Send a wholesale enquiry
            </h2>
            <p className="mt-3 text-slate-600">
              Not ready to register? Tell us what you need and we&apos;ll call you back with designs, quantities and prices.
            </p>
            {profile.phone && <p className="mt-4 text-sm text-slate-700">Phone: <a className="hf-link" href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a></p>}
            {profile.email && <p className="mt-1 text-sm text-slate-700">Email: <a className="hf-link" href={`mailto:${profile.email}`}>{profile.email}</a></p>}
          </div>
          <div className="hf-card p-5 sm:p-6">
            <InquiryForm categories={categories.map((c) => c.name)} source="wholesale-page" />
          </div>
        </div>
      </section>

      <section className="hf-container py-14" aria-labelledby="faq">
        <h2 id="faq" className="font-display text-2xl font-bold text-indigo-ink-950 sm:text-3xl">
          Wholesale questions
        </h2>
        <div className="mt-6 max-w-3xl">
          <WholesaleFaq items={parseFaq(w.faq)} />
        </div>
      </section>
    </div>
  );
}
