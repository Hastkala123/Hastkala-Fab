import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/server/auth/page-guard";
import { productFormOptions } from "@/server/catalog/admin-form";
import ProductForm, { emptyProduct } from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "New Product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireStaffPage("catalog.manage");
  const options = await productFormOptions();

  return (
    <div>
      <Link href="/admin/products" className="hf-link text-sm font-semibold">
        ← Products
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Add a product</h1>
      <p className="mt-1 text-sm text-slate-600">
        Save it as a draft while you work; set the status to Live when it&apos;s ready.
      </p>
      <div className="mt-6">
        <ProductForm initial={emptyProduct} {...options} />
      </div>
    </div>
  );
}
