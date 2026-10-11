import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { requireStaffPage } from "@/server/auth/page-guard";
import { productFormOptions, productFormValues } from "@/server/catalog/admin-form";
import ProductForm from "@/components/admin/ProductForm";

export const metadata: Metadata = { title: "Edit Product" };
export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage("catalog.manage");
  const { id } = await params;

  const [values, options, orderLines, movements] = await Promise.all([
    productFormValues(id),
    productFormOptions(),
    db.orderItem.count({ where: { productId: id } }),
    db.inventoryMovement.findMany({
      where: { variant: { productId: id } },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { variant: { select: { sku: true } } },
    }),
  ]);
  if (!values) notFound();

  return (
    <div>
      <Link href="/admin/products" className="hf-link text-sm font-semibold">
        ← Products
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-indigo-ink-950">{values.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {orderLines > 0 ? `In ${orderLines} order line${orderLines === 1 ? "" : "s"}` : "Not ordered yet"}
          </p>
        </div>
        <Link href={`/products/${values.slug}?preview=1`} target="_blank" rel="noreferrer" className="hf-btn hf-btn-outline py-2 text-sm">
          View in shop ↗
        </Link>
      </div>

      {orderLines > 0 && (
        <p className="mt-4 rounded-lg border border-turmeric-200 bg-turmeric-50 px-4 py-3 text-sm text-turmeric-900">
          Past orders and invoices keep the name and price they were bought at. Changing the web address breaks old links
          and search rankings, so avoid it for products that are already selling.
        </p>
      )}

      <div className="mt-6">
        <ProductForm initial={values} {...options} />
      </div>

      {movements.length > 0 && (
        <section className="hf-card -mt-16 mb-28 p-5">
          <h2 className="font-display text-base font-bold text-indigo-ink-950">Recent stock changes</h2>
          <ul className="mt-3 divide-y divide-cotton-200 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-slate-700">
                  <span className="font-mono text-xs">{m.variant.sku}</span> · {m.reason.replace(/_/g, " ").toLowerCase()}
                  {m.note ? ` · ${m.note}` : ""}
                </span>
                <span className="text-slate-500">
                  <strong className={m.change < 0 ? "text-madder-700" : "text-emerald-700"}>
                    {m.change > 0 ? `+${m.change}` : m.change}
                  </strong>{" "}
                  → {m.stockAfter} · {formatDateTime(m.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
