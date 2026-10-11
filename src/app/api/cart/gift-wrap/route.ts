import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { giftWrapSchema } from "@/lib/validators";
import { setGiftWrap } from "@/server/cart";

export const runtime = "nodejs";

export const POST = handler(async (request) => {
  const gate = await guard({ limit: { bucket: "cart", ...RATE_LIMITS.writeApi } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, giftWrapSchema);
  if (!parsed.ok) return parsed.response;

  await setGiftWrap(parsed.data.giftWrap, parsed.data.giftMessage);
  return ok({ success: true });
});
