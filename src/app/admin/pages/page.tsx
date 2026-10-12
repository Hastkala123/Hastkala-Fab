import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import { isFixedPage, pagePath } from "@/server/content/pages";

export const metadata: Metadata = { title: "Pages" };
export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  PUBLISHED: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-turmeric-50 text-turmeric-800",
  ARCHIVED: "bg-cotton-200 text-slate-600",
};

export default async function AdminPagesPage() {
  await requireStaffPage("content.manage");
  const pages = await db.page.findMany({
    orderBy: [{ position: "asc" }, { title: "asc" }],
    select: { id: true, title: true, slug: true, type: true, status: true, updatedAt: true, updatedById: true },
  });
  const starting = pages.filter((p) => !p.updatedById).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Pages</h1>
          <p className="mt-1 text-sm text-slate-600">Your story, contact text and policies. Footer and checkout link to the fixed ones.</p>
        </div>
        <Link href="/admin/pages/new" className="hf-btn hf-btn-primary">
          + New page
        </Link>
      </div>

      {starting > 0 && (
        <p className="mt-5 rounded-lg border border-turmeric-300 bg-turmeric-50 px-4 py-3 text-sm text-indigo-ink-900">
          <strong>{starting} page{starting === 1 ? " still has" : "s still have"} the starting text.</strong> Read each one, change
          anything that isn&apos;t how you work, and save. Have the policies checked by your CA or lawyer before going live.
        </p>
      )}

      <div className="hf-card mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-cotton-200 bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Page</th>
              <th className="px-4 py-3">Web address</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cotton-200">
            {pages.map((page) => (
              <tr key={page.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/pages/${page.id}`} className="font-semibold text-indigo-ink-900 hover:underline">
                    {page.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {page.type === "POLICY" ? "Policy" : page.type === "INFO" ? "Information" : "Landing page"}
                    {isFixedPage(page.slug) && " · linked across the shop"}
                    {!page.updatedById && " · starting text"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Link href={pagePath(page.slug)} target="_blank" className="text-xs text-indigo-ink-700 hover:underline">
                    {pagePath(page.slug)} ↗
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className={`hf-badge ${STATUS_STYLE[page.status] ?? ""}`}>{page.status.toLowerCase()}</span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(page.updatedAt)}</td>
              </tr>
            ))}
            {pages.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No pages yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
