import "server-only";

import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { hasPermission, type Permission } from "./permissions";

/**
 * Gate for admin pages (API routes use guard() in lib/api.ts). Shoppers are
 * sent to their account, so the admin area isn't confirmed to them; staff
 * without the right permission see a polite "no access" page.
 */
export async function requireStaffPage(permission?: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isStaff) redirect("/account");
  if (permission && !hasPermission(user, permission)) redirect("/admin/no-access");
  return user;
}

/** Gate for account pages: signed-out visitors go to sign-in instead of an error. */
export async function requireUserPage(next = "/account"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
