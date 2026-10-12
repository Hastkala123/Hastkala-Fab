import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { isApprovedWholesale } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { quickOrderSchema } from "@/lib/validators";
import { setCartLines } from "@/server/cart";

export const runtime = "nodejs";

/** Approved buyers: put every quantity from the quick-order grid into the bag at once. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "write", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  if (!isApprovedWholesale(gate.ctx.user)) return fail("Quick order is for approved wholesale buyers.", 403);
  const parsed = await parseJson(request, quickOrderSchema);
  if (!parsed.ok) return parsed.response;
  const lines = await setCartLines(parsed.data.items);
  return ok({ lines });
});
