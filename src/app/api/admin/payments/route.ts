import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { adminPaymentActionSchema } from "@/lib/validators";
import { hasPermission } from "@/server/auth/permissions";
import { resolveAttention, staffRetryRefund, staffSyncOrder } from "@/server/payments/admin";
import { reviewBankTransfer } from "@/server/wholesale/bank-transfer";

export const runtime = "nodejs";

/** Check with the gateway · mark a flag as resolved · retry a failed refund. */
export const POST = handler(async (request) => {
  const gate = await guard({ auth: "staff", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const parsed = await parseJson(request, adminPaymentActionSchema);
  if (!parsed.ok) return parsed.response;
  const staff = gate.ctx.user!;
  const input = parsed.data;

  switch (input.action) {
    case "sync":
      if (!hasPermission(staff, "payments.verify") && !hasPermission(staff, "orders.manage")) break;
      await staffSyncOrder(staff, input.orderId);
      return ok({ ok: true });
    case "resolve":
      if (!hasPermission(staff, "payments.verify")) break;
      await resolveAttention(staff, input.paymentId, input.note ?? null);
      return ok({ ok: true });
    case "retry-refund":
      if (!hasPermission(staff, "refunds.issue")) break;
      await staffRetryRefund(staff, input.refundId);
      return ok({ ok: true });
    case "review-transfer":
      if (!hasPermission(staff, "payments.verify")) break;
      await reviewBankTransfer(staff, { paymentId: input.paymentId, approve: input.approve, reason: input.reason });
      return ok({ ok: true });
  }
  return fail("You do not have access to this resource", 403);
});
