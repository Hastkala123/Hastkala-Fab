import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/server/auth/page-guard";
import SortableList from "@/components/admin/SortableList";
import CategoryManager from "./CategoryManager";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  await requireStaffPage("catalog.manage");

  const [categories, hsnCodes] = await Promise.all([
    db.category.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: {
        parent: { select: { id: true, name: true, slug: true } },
        _count: { select: { products: true, children: true } },
      },
    }),
    db.hsnCode.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, description: true } }),
  ]);
  const topLevel = categories.filter((c) => !c.parentId);
  const groups = topLevel
    .map((parent) => ({ parent, children: categories.filter((c) => c.parentId === parent.id) }))
    .filter((g) => g.children.length > 1);

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Categories</h1>
      <p className="mt-1 text-sm text-slate-600">
        Each category is a page in the shop at its own web address. Sub-categories go one level deep.
      </p>

      <CategoryManager
        hsnCodes={hsnCodes}
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? "",
          bottomContent: c.bottomContent ?? "",
          imageUrl: c.imageUrl ?? "",
          bannerImageUrl: c.bannerImageUrl ?? "",
          parentId: c.parentId ?? "",
          parentName: c.parent?.name ?? null,
          parentSlug: c.parent?.slug ?? null,
          hsnCodeId: c.hsnCodeId ?? "",
          isActive: c.isActive,
          showInMenu: c.showInMenu,
          metaTitle: c.metaTitle ?? "",
          metaDescription: c.metaDescription ?? "",
          productCount: c._count.products,
          childCount: c._count.children,
        }))}
      />

      {topLevel.length > 1 && (
        <section className="mt-10 max-w-2xl">
          <h2 className="font-display text-lg font-bold text-indigo-ink-950">Menu order</h2>
          <p className="mt-1 text-sm text-slate-600">Drag to set the order in the menu, footer and home page.</p>
          <div className="mt-4">
            <SortableList
              endpoint="/api/admin/categories/reorder"
              items={topLevel.map((c) => ({ id: c.id, label: c.name, sublabel: c.isActive ? null : "hidden", imageUrl: c.imageUrl }))}
            />
          </div>
          {groups.map(({ parent, children }) => (
            <div key={parent.id} className="mt-6">
              <h3 className="text-sm font-bold text-indigo-ink-900">Inside {parent.name}</h3>
              <div className="mt-2">
                <SortableList
                  endpoint="/api/admin/categories/reorder"
                  items={children.map((c) => ({ id: c.id, label: c.name, sublabel: c.isActive ? null : "hidden", imageUrl: c.imageUrl }))}
                />
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
