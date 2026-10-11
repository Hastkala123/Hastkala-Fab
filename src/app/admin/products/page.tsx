import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatPrice } from "@/lib/money";
import type { Prisma } from "@prisma/client";
import ProductRowActions from "./ProductRowActions";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const PER_PAGE = 20;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.q?.trim().slice(0, 80);

  const where: Prisma.ProductWhereInput = {};
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { sku: { contains: search } },
      { slug: { contains: search } },
    ];
  }
  if (params.filter === "low-stock") where.stock = { lte: 5 };
  if (params.filter === "inactive") where.isActive = false;
  if (params.filter === "featured") where.isFeatured = true;

  const [products, total, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        category: { select: { name: true } },
        images: { orderBy: { position: "asc" }, take: 1 },
        _count: { select: { variants: true, orderItems: true } },
      },
    }),
    db.product.count({ where }),
    db.category.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">
            Products
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {total} {total === 1 ? "product" : "products"} across {categories}{" "}
            categories
          </p>
        </div>
        <Link href="/admin/products/new" className="hf-btn hf-btn-primary">
          + Add product
        </Link>
      </div>

      {/* Filters — plain GET form so state stays in the URL. */}
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
            placeholder="Search by title, SKU or slug…"
            maxLength={80}
            className="hf-input"
          />
        </div>
        <label htmlFor="admin-product-filter" className="sr-only">
          Filter products
        </label>
        <select
          id="admin-product-filter"
          name="filter"
          defaultValue={params.filter ?? ""}
          className="hf-input w-auto"
        >
          <option value="">All products</option>
          <option value="low-stock">Low stock (≤5)</option>
          <option value="inactive">Hidden from store</option>
          <option value="featured">Featured</option>
        </select>
        <button type="submit" className="hf-btn hf-btn-outline">
          Apply
        </button>
        {(search || params.filter) && (
          <Link href="/admin/products" className="hf-btn hf-btn-ghost">
            Clear
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <div className="hf-card mt-6 p-12 text-center">
          <p className="text-sm text-slate-500">
            {search || params.filter
              ? "No products match these filters."
              : "No products yet. Add your first one to get the store live."}
          </p>
          <Link href="/admin/products/new" className="hf-btn hf-btn-primary mt-5">
            + Add your first product
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
                    <th scope="col" className="px-4 py-3 text-right font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cotton-200">
                  {products.map((product) => (
                    <tr key={product.id} className="transition hover:bg-cotton-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative aspect-square w-11 shrink-0 overflow-hidden rounded-lg bg-cotton-100">
                            {product.images[0] ? (
                              <Image
                                src={product.images[0].url}
                                alt=""
                                fill
                                sizes="44px"
                                className="object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-cotton-400">
                                ?
                              </div>
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
                              {product.sku}
                              {product._count.variants > 0 &&
                                ` · ${product._count.variants} variants`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {product.category.name}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-indigo-ink-900">
                          {formatPrice(product.priceRetail)}
                        </p>
                        {product.priceWholesale != null && (
                          <p className="text-xs text-madder-600">
                            W: {formatPrice(product.priceWholesale)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            product.stock === 0
                              ? "text-madder-600"
                              : product.stock <= 5
                                ? "text-turmeric-700"
                                : "text-slate-700"
                          }`}
                        >
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`hf-badge ${
                              product.isActive
                                ? "text-emerald-700"
                                : "text-slate-500"
                            }`}
                          >
                            {product.isActive ? "Live" : "Hidden"}
                          </span>
                          {product.isFeatured && (
                            <span className="hf-badge text-turmeric-700">Featured</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ProductRowActions
                          productId={product.id}
                          title={product.title}
                          slug={product.slug}
                          hasOrders={product._count.orderItems > 0}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Pagination"
              className="mt-5 flex items-center justify-center gap-2"
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => {
                const search = new URLSearchParams();
                if (params.q) search.set("q", params.q);
                if (params.filter) search.set("filter", params.filter);
                if (n > 1) search.set("page", String(n));
                const qs = search.toString();
                return (
                  <Link
                    key={n}
                    href={qs ? `/admin/products?${qs}` : "/admin/products"}
                    aria-current={n === page ? "page" : undefined}
                    className={
                      n === page
                        ? "hf-btn hf-btn-primary px-3 py-1.5 text-sm"
                        : "hf-btn hf-btn-outline px-3 py-1.5 text-sm"
                    }
                  >
                    {n}
                  </Link>
                );
              })}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
