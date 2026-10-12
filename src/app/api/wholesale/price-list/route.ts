import { NextResponse } from "next/server";
import { fail, guard, handler } from "@/lib/api";
import { isApprovedWholesale } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { istDateString } from "@/lib/time";
import { viewerFor } from "@/server/catalog/viewer";
import { getSettings } from "@/server/settings";
import { wholesaleDesigns } from "@/server/wholesale/catalogue";
import { priceListCsv } from "@/server/wholesale/price-list";

export const runtime = "nodejs";

/** Approved buyers: their trade price list as a spreadsheet (CSV). */
export const GET = handler(async () => {
  const gate = await guard({ auth: "user", csrf: false, limit: { bucket: "download", ...RATE_LIMITS.download } });
  if (!gate.ok) return gate.response;
  if (!isApprovedWholesale(gate.ctx.user)) return fail("The price list is for approved wholesale buyers.", 403);
  const [designs, settings] = await Promise.all([wholesaleDesigns(await viewerFor(gate.ctx.user)), getSettings()]);
  // Byte-order mark so Excel opens the ₹-free UTF-8 text correctly.
  const csv = "﻿" + priceListCsv(designs, !settings.tax.wholesalePricesIncludeTax);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hastkala-fab-wholesale-prices-${istDateString(new Date())}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
