import { notFound, permanentRedirect } from "next/navigation";
import { db } from "@/lib/db";
import { categoryPath } from "@/lib/routes";

/** Old address /category/{slug} → /{slug} or /{parent}/{slug}. */
export default async function OldCategoryRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = await db.category.findUnique({
    where: { slug },
    select: { slug: true, isActive: true, parent: { select: { slug: true } } },
  });
  if (!category || !category.isActive) notFound();
  permanentRedirect(categoryPath(category.slug, category.parent?.slug));
}
