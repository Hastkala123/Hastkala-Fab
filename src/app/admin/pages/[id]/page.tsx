import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/server/auth/page-guard";
import { getContentValues, isFixedPage } from "@/server/content/pages";
import PageEditor from "./PageEditor";

export const metadata: Metadata = { title: "Edit page" };
export const dynamic = "force-dynamic";

export default async function AdminPageEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("content.manage");
  const { id } = await params;
  const isNew = id === "new";
  const [page, values] = await Promise.all([
    isNew || !/^[a-z0-9]{1,64}$/i.test(id) ? null : db.page.findUnique({ where: { id } }),
    getContentValues(),
  ]);
  if (!isNew && !page) notFound();

  return (
    <div>
      <Link href="/admin/pages" className="text-sm text-indigo-ink-700 hover:underline">
        ← All pages
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        {page ? page.title : "New page"}
      </h1>
      <PageEditor
        values={values}
        page={
          page
            ? {
                id: page.id,
                title: page.title,
                slug: page.slug,
                type: page.type,
                status: page.status,
                body: page.body,
                metaTitle: page.metaTitle ?? "",
                metaDescription: page.metaDescription ?? "",
                showInFooter: page.showInFooter,
                fixed: isFixedPage(page.slug),
              }
            : null
        }
      />
    </div>
  );
}
