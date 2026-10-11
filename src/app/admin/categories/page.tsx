import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import CategoryManager from "./CategoryManager";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const categories = await db.category.findMany({
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { id: true, name: true } },
      _count: { select: { products: true, children: true } },
    },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        Categories
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Organise the catalogue. Sub-categories can nest one level deep — deeper
        trees make the storefront navigation unusable.
      </p>

      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          imageUrl: c.imageUrl ?? "",
          parentId: c.parentId ?? "",
          parentName: c.parent?.name ?? null,
          position: c.position,
          isActive: c.isActive,
          metaTitle: c.metaTitle ?? "",
          metaDescription: c.metaDescription ?? "",
          productCount: c._count.products,
          childCount: c._count.children,
        }))}
      />
    </div>
  );
}
