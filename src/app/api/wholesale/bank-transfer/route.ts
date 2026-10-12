import { guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { bankTransferSchema } from "@/lib/validators";
import { submitBankTransfer } from "@/server/wholesale/bank-transfer";

export const runtime = "nodejs";

/** "I've paid by bank transfer": records the UTR for staff to verify. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "user", limit: { bucket: "bank-transfer", ...RATE_LIMITS.bankTransfer } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, bankTransferSchema);
  if (!parsed.ok) return parsed.response;
  await submitBankTransfer(gate.ctx.user!, parsed.data);
  return ok({ success: true }, 201);
});
