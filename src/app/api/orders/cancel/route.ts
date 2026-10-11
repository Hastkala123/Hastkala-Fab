import { z } from "zod";
import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { optionalText } from "@/lib/validators";
import { cancelOrderByCustomer } from "@/server/orders/service";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "order-cancel", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;

  const parsed = await parseJson(
    request,
    z.object({
      orderNumber: z.string().trim().regex(/^HF-\d{6,9}$/, "Invalid order number"),
      reason: optionalText(300, "Reason"),
    }),
  );
  if (!parsed.ok) return parsed.response;

  await cancelOrderByCustomer(gate.ctx.user!, parsed.data.orderNumber, parsed.data.reason);
  return ok({ success: true });
});
