import type { Metadata } from "next";
import Link from "next/link";
import { contentToPlainText, fillPlaceholders } from "@/lib/content-text";
import { jsonLd } from "@/lib/jsonld";
import { getContentValues, publishedFaqs } from "@/server/content/pages";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ContentBody from "@/components/content/ContentBody";

export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Answers about orders, delivery, Cash on Delivery, returns, hand-block print care and wholesale buying at Hastkala Fab, Sanganer, Jaipur.",
  alternates: { canonical: "/faq" },
};

export const dynamic = "force-dynamic";

/** Questions from Admin → Content → FAQs, grouped, with FAQPage structured data. */
export default async function FaqPage() {
  const [groups, values] = await Promise.all([publishedFaqs(), getContentValues()]);
  const answered = groups.flatMap((g) => g.items).map((faq) => ({
    ...faq,
    plain: contentToPlainText(fillPlaceholders(faq.answer, values)),
  }));
  const structured = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: answered
      .filter((faq) => faq.plain)
      .map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.plain } })),
  };

  return (
    <div className="hf-container py-8 sm:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/faq", label: "FAQs" }]} />
      {structured.mainEntity.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />}

      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-indigo-ink-950 sm:text-4xl">
        Frequently asked questions
      </h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Can&apos;t find your answer? <Link href="/contact" className="hf-link font-semibold">Contact us</Link> or ask from the{" "}
        <Link href="/account/support" className="hf-link font-semibold">Help Centre</Link>.
      </p>

      {groups.length > 1 && (
        <nav aria-label="FAQ topics" className="mt-6 flex flex-wrap gap-2">
          {groups.map((group) => (
            <a key={group.name} href={`#${topicId(group.name)}`} className="rounded-full border border-cotton-400 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-ink-400">
              {group.name}
            </a>
          ))}
        </nav>
      )}

      {groups.length === 0 ? (
        <p className="hf-card mt-8 max-w-3xl p-6 text-slate-600">
          We&apos;re putting our answers together. Meanwhile, <Link href="/contact" className="hf-link font-semibold">contact us</Link> with any question.
        </p>
      ) : (
        <div className="mt-8 max-w-3xl space-y-10">
          {groups.map((group) => (
            <section key={group.name} id={topicId(group.name)} aria-labelledby={`${topicId(group.name)}-h`} className="scroll-mt-24">
              <h2 id={`${topicId(group.name)}-h`} className="font-display text-xl font-bold text-indigo-ink-950">
                {group.name}
              </h2>
              <div className="mt-4 divide-y divide-cotton-300 rounded-card border border-cotton-300 bg-white">
                {group.items.map((faq) => (
                  <details key={faq.id} className="group p-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-indigo-ink-900">
                      {faq.question}
                      <span aria-hidden="true" className="text-xl text-madder-600 transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <ContentBody body={faq.answer} values={values} className="mt-3 text-sm" />
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function topicId(name: string): string {
  return `topic-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
