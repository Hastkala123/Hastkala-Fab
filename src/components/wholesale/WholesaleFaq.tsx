import { jsonLd } from "@/lib/jsonld";
import type { FaqItem } from "@/lib/wholesale-content";

/** Questions from Settings → Wholesale, with FAQPage structured data for search results. */
export default function WholesaleFaq({ items }: { items: FaqItem[] }) {
  if (items.length === 0) return null;
  const structured = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structured)} />
      <div className="divide-y divide-cotton-300 rounded-card border border-cotton-300 bg-white">
        {items.map((item) => (
          <details key={item.question} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-indigo-ink-900">
              {item.question}
              <span aria-hidden="true" className="text-xl text-madder-600 transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
          </details>
        ))}
      </div>
    </>
  );
}
