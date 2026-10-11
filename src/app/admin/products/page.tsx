import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import { ADMIN_PAGE_SIZE, STATUS_STYLES } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import SortableList from "@/components/admin/SortableList";
import ProductRowActions from "./ProductRowActions";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

type Params = { q?: string; filter?: string; status?: string; category?: string; page?: string; reorder?: string };

const STATUSES = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireStaffPage("catalog.manage");
  const params = await searchParams;

  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const search = params.q?.trim().slice(0, 80);
  const status = STATUSES.find((s) => s === params.status);
  const categories = await db.category.findMany({
    orderBy: [{ parentId: "asc" }, { position: "asc" }],
    select: { id: true, name: true, parentId: true, parent: { select: { name: true } } },
  });
  const category = categories.find((c) => c.id === params.category);

  const where: Prisma.ProductWhereInput = {
    status: status ?? { not: "ARCHIVED" },
    ...(category ? { categoryId: category.id } : {}),
  };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { slug: { contains: search.toLowerCase() } },
      { variants: { some: { sku: { contains: search.toUpperCase() } } } },
    ];
  }
  if (params.filter === "low-stock") {
    const low = await db.$queryRaw<{ productId: string }[]>`
      SELECT DISTINCT "productId" FROM "ProductVariant"
       WHERE "isActive" AND "archivedAt" IS NULL AND "stock" <= "lowStockThreshold"`;
    where.id = { in: low.map((r) => r.productId) };
  }
  if (params.filter === "featured") where.isFeatured = true;

  // Drag-to-reorder: the whole category at once, in its current order.
  if (params.reorder === "1" && category) {
    const products = await db.product.findMany({
      where: { categoryId: category.id, status: { not: "ARCHIVED" } },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        media: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
      },
    });
    return (
      <div>
        <Link href={`/admin/products?category=${category.id}`} className="hf-link text-sm font-semibold">
          ← Back to products
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
          Arrange {category.name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Drag products (or use the arrows) into the order shoppers should see under &ldquo;Recommended&rdquo;.
        </p>
        <div className="mt-5 max-w-2xl">
          <SortableList
            endpoint="/api/admin/products/reorder"
            items={products.map((p) => ({
              id: p.id,
              label: p.title,
              sublabel: p.status === "ACTIVE" ? null : p.status.toLowerCase(),
              imageUrl: p.media[0]?.url ?? null,
            }))}
          />
        </div>
      </div>
    );
  }

  const [products, total] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: category ? [{ position: "asc" }, { createdAt: "desc" }] : { updatedAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        category: { select: { name: true } },
        media: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
        variants: {
          where: { archivedAt: null },
          select: { stock: true, lowStockThreshold: true, isActive: true, sku: true },
        },
        wholesalePrices: { orderBy: { minQuantity: "asc" }, take: 1, select: { unitPrice: true, minQuantity: true } },
      },
    }),
    db.product.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const hrefFor = (n: number) => {
    const qs = new URLSearchParams();
    for (const key of ["q", "filter", "status", "category"] as const) if (params[key]) qs.set(key, params[key]!);
    if (n > 1) qs.set("page", String(n));
    const str = qs.toString();
    return str ? `/admin/products?${str}` : "/admin/products";
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">Products</h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} {total === 1 ? "product" : "products"}
            {category ? ` in ${category.name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {category && (
            <Link href={`/admin/products?category=${category.id}&reorder=1`} className="hf-btn hf-btn-outline">
              Arrange order
            </Link>
          )}
          <Link href="/admin/products/new" className="hf-btn hf-btn-primary">
            + Add product
          </Link>
        </div>
      </div>

      <form method="get" className="mt-5 flex flex-wrap gap-2.5">
        <div className="min-w-48 flex-1">
          <label htmlFor="admin-product-search" className="sr-only">
            Search products
          </label>
          <input
            id="admin-product-search"
            name="q"
            type="search"
            defaultValue={search ?? ""}
            placeholder="Search by name, SKU or web address…"
            maxLength={80}
            className="hf-input"
          />
        </div>
        <label htmlFor="admin-product-category" className="sr-only">
          Category
        </label>
        <select id="admin-product-category" name="category" defaultValue={category?.id ?? ""} className="hf-input w-auto">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.parent ? `${c.parent.name} › ${c.name}` : c.name}
            </option>
          ))}
        </select>
        <label htmlFor="admin-product-status" className="sr-only">
          Status
        </label>
        <select id="admin-product-status" name="status" defaultValue={status ?? ""} className="hf-input w-auto">
          <option value="">Live and drafts</option>
          <option value="ACTIVE">Live</option>
          <option value="DRAFT">Drafts</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <label htmlFor="admin-product-filter" className="sr-only">
          Filter
        </label>
        <select id="admin-product-filter" name="filter" defaultValue={params.filter ?? ""} className="hf-input w-auto">
          <option value="">Any stock</option>
          <option value="low-stock">Low stock</option>
          <option value="featured">Featured</option>
        </select>
        <button type="submit" className="hf-btn hf-btn-outline">
          Apply
        </button>
        {(search || params.filter || status || category) && (
          <Link href="/admin/products" className="hf-btn hf-btn-ghost">
            Clear
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">
            {search || params.filter || status || category
              ? "No products match these filters."
              : "No products yet. Add your first one to get the shop live."}
          </p>
          <Link href="/admin/products/new" className="hf-btn hf-btn-primary mt-5">
            + Add a product
          </Link>
        </div>
      ) : (
        <>
          <div className="hf-card mt-5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cotton-200 bg-cotton-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-4 py-3 font-semibold">Product</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Price</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Stock</th>
                    <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cotton-200">
                  {products.map((product) => {
                    const live = product.variants.filter((v) => v.isActive);
                    const stock = live.reduce((sum, v) => sum + v.stock, 0);
                    const low = live.some((v) => v.stock <= v.lowStockThreshold);
                    return (
                      <tr key={product.id} className="transition hover:bg-cotton-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative aspect-square w-11 shrink-0 overflow-hidden rounded-lg bg-cotton-100">
                              {product.media[0] ? (
                                <Image src={product.media[0].url} alt="" fill sizes="44px" className="object-cover" />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-cotton-400">?</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/admin/products/${product.id}`}
                                className="hf-clamp-1 font-medium text-indigo-ink-900 hover:underline"
                              >
                                {product.title}
                              </Link>
                              <p className="text-xs text-slate-400">
                                {live[0]?.sku ?? "No SKU"}
                                {live.length > 1 && ` · ${live.length} sizes/colours`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{product.category.name}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-indigo-ink-900">{formatPrice(product.price)}</p>
                          {product.wholesaleEnabled && product.wholesalePrices[0] && (
                            <p className="text-xs text-madder-600">
                              W: {formatPrice(product.wholesalePrices[0].unitPrice)} ({product.wholesalePrices[0].minQuantity}+)
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-semibold ${stock === 0 ? "text-madder-600" : low ? "text-turmeric-700" : "text-slate-700"}`}>
                            {stock}
                          </span>
                          {low && stock > 0 && <span className="ml-1 text-xs text-turmeric-700">low</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <span className={`hf-badge ${STATUS_STYLES[product.status] ?? ""}`}>
                              {product.status === "ACTIVE" ? "Live" : product.status === "DRAFT" ? "Draft" : "Archived"}
                            </span>
                            {product.isFeatured && <span className="hf-badge text-turmeric-700">Featured</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ProductRowActions
                            productId={product.id}
                            title={product.title}
                            slug={product.slug}
                            archived={product.status === "ARCHIVED"}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={hrefFor(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={n === page ? "hf-btn hf-btn-primary px-3 py-1.5 text-sm" : "hf-btn hf-btn-outline px-3 py-1.5 text-sm"}
                >
                  {n}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
