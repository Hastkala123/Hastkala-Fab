import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/server/auth/page-guard";
import SortableList from "@/components/admin/SortableList";
import FaqManager from "./FaqManager";

export const metadata: Metadata = { title: "FAQs" };
export const dynamic = "force-dynamic";

export default async function AdminFaqsPage() {
  await requireStaffPage("content.manage");
  const faqs = await db.faq.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, question: true, answer: true, group: true, isActive: true },
  });
  const groups = [...new Set(faqs.map((f) => f.group))];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">FAQs</h1>
      <p className="mt-1 text-sm text-slate-600">
        Shown on <a href="/faq" target="_blank" className="hf-link">/faq</a>, grouped by topic, and offered to Google as
        rich results. Answers use the same formatting and Settings values as pages.
      </p>

      <FaqManager faqs={faqs} groups={groups} />

      {faqs.length > 1 && (
        <section className="mt-10 max-w-2xl">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Order</h2>
          <p className="mt-1 text-sm text-slate-600">Drag to set the order. Topics appear in the order of their first question.</p>
          <div className="mt-4">
            <SortableList
              endpoint="/api/admin/faqs/reorder"
              items={faqs.map((f) => ({ id: f.id, label: f.question, sublabel: f.isActive ? f.group : `${f.group} · hidden` }))}
            />
          </div>
        </section>
      )}
    </div>
  );
}
