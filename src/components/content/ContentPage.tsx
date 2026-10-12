import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can, getCurrentUser } from "@/lib/auth";
import { contentToPlainText, fillPlaceholders } from "@/lib/content-text";
import { formatDate } from "@/lib/utils";
import { getContentValues, getPageBySlug, pagePath } from "@/server/content/pages";
import Breadcrumbs from "@/components/store/Breadcrumbs";
import ContentBody from "./ContentBody";

/**
 * A page from Admin → Content. Drafts are shown only to staff who can edit
 * content (with a banner), so the owner can read a policy before publishing.
 * With `fallbackTitle` the page still renders when there is no text yet
 * (Contact shows the store's details either way).
 */

export async function contentPageMetadata(slug: string, fallbackTitle?: string): Promise<Metadata> {
  const page = await getPageBySlug(slug);
  if (!page || page.status !== "PUBLISHED") {
    return {
      title: page?.title ?? fallbackTitle ?? "Page not found",
      robots: fallbackTitle && !page ? undefined : { index: false, follow: false },
      alternates: { canonical: pagePath(slug) },
    };
  }
  const title = page.metaTitle ?? page.title;
  const description =
    page.metaDescription ?? contentToPlainText(fillPlaceholders(page.body, await getContentValues())).slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: pagePath(slug) },
    openGraph: { title, description, url: pagePath(slug), type: "article" },
  };
}

export default async function ContentPage({
  slug,
  fallbackTitle,
  children,
}: {
  slug: string;
  fallbackTitle?: string;
  /** Shown beside the text on wide screens (e.g. contact details). */
  children?: React.ReactNode;
}) {
  const [page, values, user] = await Promise.all([getPageBySlug(slug), getContentValues(), getCurrentUser()]);
  const canEdit = can(user, "content.manage");
  const shown = page && (page.status === "PUBLISHED" || canEdit) ? page : null;
  if (!shown && !fallbackTitle) notFound();
  const title = shown?.title ?? fallbackTitle!;
  const path = pagePath(slug);

  return (
    <div className="hf-container py-8 sm:py-12">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: path, label: title }]} />

      {shown && shown.status !== "PUBLISHED" && (
        <p role="status" className="mt-6 rounded-lg border border-turmeric-300 bg-turmeric-50 px-4 py-3 text-sm text-indigo-ink-900">
          <strong>Not published</strong> — only staff can see this page.{" "}
          <Link href={`/admin/pages/${shown.id}`} className="hf-link font-semibold">
            Edit or publish it
          </Link>
        </p>
      )}

      <div className={`mt-6 grid gap-10 ${children ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
        <article className="max-w-3xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-indigo-ink-950 sm:text-4xl">{title}</h1>
          {shown?.type === "POLICY" && (
            <p className="mt-2 text-sm text-slate-500">
              Last updated <time dateTime={shown.updatedAt.toISOString()}>{formatDate(shown.updatedAt)}</time>
            </p>
          )}
          {shown && <ContentBody body={shown.body} values={values} className="mt-6" />}
          {canEdit && shown && shown.status === "PUBLISHED" && (
            <p className="mt-10 text-xs text-slate-400 print:hidden">
              <Link href={`/admin/pages/${shown.id}`} className="hover:underline">
                Edit this page
              </Link>
            </p>
          )}
        </article>
        {children && <aside>{children}</aside>}
      </div>
    </div>
  );
}
