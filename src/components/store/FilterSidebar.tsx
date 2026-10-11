"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Facets = {
  fabrics: string[];
  occasions: string[];
  minPrice: number;
  maxPrice: number;
};

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "popular", label: "Most popular" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating", label: "Highest rated" },
];

/**
 * Faceted filter panel. State lives entirely in the URL rather than in React
 * state, so a filtered view is shareable, bookmarkable, back-button-correct and
 * indexable — all of which matter for a catalogue that lives on search traffic.
 */
export default function FilterSidebar({ facets }: { facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Any filter change resets to page 1; staying on page 7 of a narrower
    // result set is the classic way to land a user on an empty page.
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeFabric = searchParams.get("fabric");
  const activeOccasion = searchParams.get("occasion");
  const activeMin = searchParams.get("minPrice");
  const activeMax = searchParams.get("maxPrice");
  const activeSort = searchParams.get("sort") ?? "newest";

  const activeCount = [activeFabric, activeOccasion, activeMin, activeMax].filter(
    Boolean,
  ).length;

  function clearAll() {
    const params = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) params.set("q", q);
    router.push(params.toString() ? `${pathname}?${params}` : pathname);
  }

  const panel = (
    <div className="space-y-7">
      <FilterGroup title="Sort by">
        <select
          value={activeSort}
          onChange={(e) => setParam("sort", e.target.value)}
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

      <FilterGroup title="Price range">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="filter-min-price">
            Minimum price
          </label>
          <input
            id="filter-min-price"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={`₹${facets.minPrice}`}
            defaultValue={activeMin ?? ""}
            onBlur={(e) => setParam("minPrice", e.target.value)}
            className="hf-input"
          />
          <span aria-hidden="true" className="text-slate-400">
            –
          </span>
          <label className="sr-only" htmlFor="filter-max-price">
            Maximum price
          </label>
          <input
            id="filter-max-price"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={`₹${facets.maxPrice}`}
            defaultValue={activeMax ?? ""}
            onBlur={(e) => setParam("maxPrice", e.target.value)}
            className="hf-input"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            { label: "Under ₹1000", min: null, max: "1000" },
            { label: "₹1000–2000", min: "1000", max: "2000" },
            { label: "₹2000+", min: "2000", max: null },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                preset.min ? params.set("minPrice", preset.min) : params.delete("minPrice");
                preset.max ? params.set("maxPrice", preset.max) : params.delete("maxPrice");
                params.delete("page");
                router.push(`${pathname}?${params.toString()}`);
              }}
              className="rounded-full border border-cotton-300 px-2.5 py-1 text-xs text-slate-600 transition hover:border-indigo-ink-400 hover:text-indigo-ink-800"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      {facets.fabrics.length > 0 && (
        <FilterGroup title="Fabric">
          <ul className="space-y-1.5">
            {facets.fabrics.map((fabric) => (
              <li key={fabric}>
                <FilterChip
                  label={fabric}
                  active={activeFabric === fabric}
                  onClick={() =>
                    setParam("fabric", activeFabric === fabric ? null : fabric)
                  }
                />
              </li>
            ))}
          </ul>
        </FilterGroup>
      )}

      {facets.occasions.length > 0 && (
        <FilterGroup title="Occasion">
          <ul className="space-y-1.5">
            {facets.occasions.map((occasion) => (
              <li key={occasion}>
                <FilterChip
                  label={occasion}
                  active={activeOccasion === occasion}
                  onClick={() =>
                    setParam("occasion", activeOccasion === occasion ? null : occasion)
                  }
                />
              </li>
            ))}
          </ul>
        </FilterGroup>
      )}

      {activeCount > 0 && (
        <button type="button" onClick={clearAll} className="hf-btn hf-btn-outline w-full">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile trigger */}
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
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-indigo-ink-950/45"
            onClick={() => setMobileOpen(false)}
            aria-label="Close filters"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-cotton-50 p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-indigo-ink-950">
                Filter &amp; sort
              </h2>
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
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="hf-btn hf-btn-primary mt-6 w-full"
            >
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
      <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-indigo-ink-900">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full rounded-lg px-3 py-1.5 text-left text-sm transition",
        active
          ? "bg-indigo-ink-800 font-semibold text-white"
          : "text-slate-600 hover:bg-cotton-200",
      )}
    >
      {label}
    </button>
  );
}
