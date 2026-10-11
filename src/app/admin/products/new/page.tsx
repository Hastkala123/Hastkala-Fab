import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import ProductForm, { emptyProduct } from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "New Product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdmin();

  const categories = await db.category.findMany({
    orderBy: [{ parentId: "asc" }, { position: "asc" }],
    select: { id: true, name: true, parent: { select: { name: true } } },
  });

  return (
    <div>
      <Link href="/admin/products" className="hf-link text-sm font-semibold">
        ← Products
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
        Add a new product
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Fill in the details, upload photos and publish. You can save it hidden and
        make it live later.
      </p>

      <div className="mt-6">
        <ProductForm
          initial={emptyProduct}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            parentName: c.parent?.name ?? null,
          }))}
        />
      </div>
    </div>
  );
}
