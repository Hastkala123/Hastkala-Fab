import type { WholesaleDesign } from "./catalogue";

/** "Design, SKU, size, stock, MOQ, prices…" as CSV for the buyer's own sheet. */
export function priceListCsv(designs: WholesaleDesign[], plusGst: boolean): string {
  const breaks = Math.max(1, ...designs.map((d) => d.prices.length));
  const header = [
    "Category",
    "Design",
    "SKU",
    "Size / colour",
    "In stock",
    "Minimum pieces (per design)",
    ...Array.from({ length: breaks }, (_, i) => [`Break ${i + 1} from (pcs)`, `Break ${i + 1} price per piece (Rs${plusGst ? ", + GST" : ""})`]).flat(),
    "MRP per piece (Rs)",
  ];
  const rows = designs.flatMap((d) =>
    d.variants.map((v) => [
      d.categoryName,
      d.title,
      v.sku,
      v.label,
      String(v.stock),
      d.minQuantity != null ? String(d.minQuantity) : "",
      ...Array.from({ length: breaks }, (_, i) => {
        const p = d.prices[i];
        return p ? [String(p.minQuantity), (p.unitPrice / 100).toFixed(2)] : ["", ""];
      }).flat(),
      (d.retailPrice / 100).toFixed(2),
    ]),
  );
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function csvCell(value: string): string {
  // Spreadsheet formula injection: a cell starting with = + - @ is made literal.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
