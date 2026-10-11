"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type FacetOption = { value: string; count: number; hex?: string | null };
type Facets = {
  attributes: { key: string; label: string; options: FacetOption[] }[];
  sizes: FacetOption[];
  colors: FacetOption[];
  /** Paise. */
  price: { min: number; max: number };
};

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest first" },
  { value: "popular", label: "Best selling" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];

/** Keys that aren't attribute filters, so they don't count as "active filters". */
const NON_FILTER_KEYS = new Set(["q", "sort", "page"]);

/**
 * Filter panel. Filters come from the attributes the owner marks "filterable"
 * in admin, so a new filter needs no code. State lives in the URL, so a
 * filtered view is shareable, bookmarkable and back-button-correct.
 */
export default function FilterSidebar({ facets }: { facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  function push(params: URLSearchParams) {
    // Any filter change resets to page 1, so nobody lands on an empty page 7.
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    push(params);
  }

  const selected = (key: string) => (searchParams.get(key) ?? "").split(",").filter(Boolean);

  function toggle(key: string, value: string) {
    const current = selected(key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setParam(key, next.length ? next.join(",") : null);
  }

  const activeSort = searchParams.get("sort") ?? "recommended";
  const activeCount = [...searchParams.keys()].filter((k) => !NON_FILTER_KEYS.has(k)).length;

  function clearAll() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    const sort = searchParams.get("sort");
    if (sort) params.set("sort", sort);
    push(params);
  }

  const minRupees = Math.floor(facets.price.min / 100);
  const maxRupees = Math.ceil(facets.price.max / 100);

  const panel = (
    <div className="space-y-7">
      <FilterGroup title="Sort by">
        <select
          value={activeSort}
          onChange={(e) => setParam("sort", e.target.value === "recommended" ? null : e.target.value)}
          className="hf-input"
          aria-label="Sort products"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FilterGroup>

      <FilterGroup title="Price (₹)">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-min-price">
            Minimum price in rupees
          </label>
          <input
            id="filter-min-price"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={String(minRupees)}
            defaultValue={searchParams.get("min") ?? ""}
            onBlur={(e) => setParam("min", e.target.value.replace(/\D/g, ""))}
            className="hf-input"
          />
          <span aria-hidden="true" className="text-slate-400">
            –
          </span>
          <label className="sr-only" htmlFor="filter-max-price">
            Maximum price in rupees
          </label>
          <input
            id="filter-max-price"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={String(maxRupees)}
            defaultValue={searchParams.get("max") ?? ""}
            onBlur={(e) => setParam("max", e.target.value.replace(/\D/g, ""))}
            className="hf-input"
          />
        </div>
      </FilterGroup>

      <FilterGroup title="Availability">
        <FilterChip
          label="In stock only"
          active={searchParams.get("stock") === "1"}
          onClick={() => setParam("stock", searchParams.get("stock") === "1" ? null : "1")}
        />
      </FilterGroup>

      {facets.sizes.length > 1 && (
        <FilterGroup title="Size">
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((size) => {
              const active = selected("size").includes(size.value);
              return (
                <button
                  key={size.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle("size", size.value)}
                  className={cn(
                    "min-w-11 rounded-lg border px-2.5 py-1.5 text-sm transition",
                    active
                      ? "border-indigo-ink-800 bg-indigo-ink-800 font-semibold text-white"
                      : "border-cotton-300 text-slate-700 hover:border-indigo-ink-400",
                  )}
                >
                  {size.value}
                </button>
              );
            })}
          </div>
        </FilterGroup>
      )}

      {facets.colors.length > 1 && (
        <FilterGroup title="Colour">
          <ul className="space-y-1.5">
            {facets.colors.map((color) => (
              <li key={color.value}>
                <FilterChip
                  label={color.value}
                  count={color.count}
                  swatch={color.hex}
                  active={selected("color").includes(color.value)}
                  onClick={() => toggle("color", color.value)}
                />
              </li>
            ))}
          </ul>
        </FilterGroup>
      )}

      {facets.attributes.map((attribute) => (
        <FilterGroup key={attribute.key} title={attribute.label}>
          <ul className="space-y-1.5">
            {attribute.options.map((option) => (
              <li key={option.value}>
                <FilterChip
                  label={option.value}
                  count={option.count}
                  active={selected(`f_${attribute.key}`).includes(option.value)}
                  onClick={() => toggle(`f_${attribute.key}`, option.value)}
                />
              </li>
            ))}
          </ul>
        </FilterGroup>
      ))}

      {activeCount > 0 && (
        <button type="button" onClick={clearAll} className="hf-btn hf-btn-outline w-full">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="hf-btn hf-btn-outline flex-1"
          aria-expanded={mobileOpen}
        >
          Filter &amp; sort
          {activeCount > 0 && (
            <span className="ml-1 rounded-full bg-madder-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <aside className="hidden lg:block" aria-label="Product filters">
        {panel}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Filter and sort">
          <button
            type="button"
            className="absolute inset-0 bg-indigo-ink-950/45"
            onClick={() => setMobileOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-cotton-50 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-indigo-ink-950">Filter &amp; sort</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="hf-btn hf-btn-ghost px-2"
                aria-label="Close filters"
              >
                ✕
              </button>
            </div>
            {panel}
            <button type="button" onClick={() => setMobileOpen(false)} className="hf-btn hf-btn-primary mt-6 w-full">
              Show results
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-indigo-ink-900">{title}</h3>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  count,
  swatch,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  swatch?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition",
        active ? "bg-indigo-ink-800 font-semibold text-white" : "text-slate-600 hover:bg-cotton-200",
      )}
    >
      {swatch && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: swatch }}
        />
      )}
      <span className="flex-1">{label}</span>
      {count != null && <span className={cn("text-xs", active ? "text-white/80" : "text-slate-400")}>{count}</span>}
    </button>
  );
}
