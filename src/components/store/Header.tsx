import { getCurrentUser, isAdminRole } from "@/lib/auth";
import { getCartCount } from "@/lib/cart";
import { db } from "@/lib/db";
import HeaderClient from "./HeaderClient";

/**
 * Server component: resolves the signed-in user, live cart count and the
 * category menu, then hands them to the interactive shell. Rendering this on
 * the server means the correct nav appears in the first paint with no
 * authentication flicker.
 */
export default async function Header() {
  const [user, cartCount, categories] = await Promise.all([
    getCurrentUser(),
    getCartCount(),
    db.category.findMany({
      where: { isActive: true, parentId: null },
      orderBy: { position: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        children: {
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: { id: true, name: true, slug: true },
        },
      },
    }),
  ]);

  return (
    <HeaderClient
      user={
        user
          ? {
              name: user.name,
              email: user.email,
              role: user.role,
              isAdmin: isAdminRole(user.role),
            }
          : null
      }
      cartCount={cartCount}
      categories={categories}
    />
  );
}
