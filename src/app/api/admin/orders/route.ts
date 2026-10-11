import { fail, guard, handler, ok, parseJson } from "@/lib/api";
import { can } from "@/lib/auth";
import { RATE_LIMITS } from "@/lib/ratelimit";
import { orderStatusSchema } from "@/lib/validators";
import { changeOrderStatus } from "@/server/orders/service";

export const runtime = "nodejs";

/** Courier-side moves can be made by dispatch staff; the rest need order rights. */
const SHIPPING_STATUSES = new Set(["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "RTO_IN_TRANSIT", "RTO_DELIVERED"]);

export const PATCH = handler(async (request) => {
  const gate = await guard({ auth: "staff", limit: { bucket: "admin-write", ...RATE_LIMITS.adminWrite } });
  if (!gate.ok) return gate.response;
  const staff = gate.ctx.user!;

  const parsed = await parseJson(request, orderStatusSchema);
  if (!parsed.ok) return parsed.response;
  const { orderId, status, expectedFrom, note, customerVisible } = parsed.data;

  const allowed =
    can(staff, "orders.manage") || (SHIPPING_STATUSES.has(status) && can(staff, "shipping.manage"));
  if (!allowed) return fail("You do not have permission to do that", 403);

  await changeOrderStatus(orderId, status, { type: "STAFF", user: staff }, {
    expectedFrom,
    note,
    customerVisible,
    cancelReason: status === "CANCELLED" ? note : null,
  });
  return ok({ success: true });
});
