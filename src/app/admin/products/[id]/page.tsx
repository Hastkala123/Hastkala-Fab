import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import ProductForm from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "Edit Product" };
export const dynamic = "force-dynamic";

/** Paise back to the rupee string the form field expects. */
function toRupees(paise: number | null): string {
  if (paise == null) return "";
  return String(paise / 100);
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: "asc" } },
        variants: { orderBy: [{ size: "asc" }, { color: "asc" }] },
        _count: { select: { orderItems: true } },
      },
    }),
    db.category.findMany({
      orderBy: [{ parentId: "asc" }, { position: "asc" }],
      select: { id: true, name: true, parent: { select: { name: true } } },
    }),
  ]);

  if (!product) notFound();

  return (
    <div>
      <Link href="/admin/products" className="hf-link text-sm font-semibold">
        ← Products
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
            Edit product
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {product.sku}
            {product._count.orderItems > 0 &&
              ` · appears in ${product._count.orderItems} order line${
                product._count.orderItems === 1 ? "" : "s"
              }`}
          </p>
        </div>
        <Link
          href={`/product/${product.slug}`}
          target="_blank"
          rel="noreferrer"
          className="hf-btn hf-btn-outline py-2 text-sm"
        >
          View on store ↗
        </Link>
      </div>

      {product._count.orderItems > 0 && (
        <p className="mt-4 rounded-lg border border-turmeric-200 bg-turmeric-50 px-4 py-3 text-sm text-turmeric-900">
          This product has order history. Changing the price or title will not
          affect past invoices — those were snapshotted at purchase time. Changing
          the URL slug will break existing links and search rankings.
        </p>
      )}

      <div className="mt-6">
        <ProductForm
          initial={{
            id: product.id,
            title: product.title,
            slug: product.slug,
            description: product.description,
            shortDesc: product.shortDesc ?? "",
            categoryId: product.categoryId,
            priceRetail: toRupees(product.priceRetail),
            mrp: toRupees(product.mrp),
            priceWholesale: toRupees(product.priceWholesale),
            wholesaleMinQty: String(product.wholesaleMinQty),
            sku: product.sku,
            stock: String(product.stock),
            fabric: product.fabric ?? "",
            printType: product.printType ?? "",
            workType: product.workType ?? "",
            occasion: product.occasion ?? "",
            washCare: product.washCare ?? "",
            origin: product.origin ?? "",
            isActive: product.isActive,
            isFeatured: product.isFeatured,
            isNew: product.isNew,
            metaTitle: product.metaTitle ?? "",
            metaDescription: product.metaDescription ?? "",
            keywords: product.keywords ?? "",
            images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
            variants: product.variants.map((v) => ({
              size: v.size ?? "",
              color: v.color ?? "",
              sku: v.sku,
              stock: String(v.stock),
              priceDelta: String(v.priceDelta / 100),
            })),
          }}
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
