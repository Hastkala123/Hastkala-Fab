import { getCurrentUser, isApprovedWholesale } from "@/lib/auth";
import { getCartCount } from "@/server/cart";
import { getCategories } from "@/server/catalog/products";
import HeaderClient from "./HeaderClient";

/**
 * Server component: resolves the signed-in user, live bag count and the
 * category menu (Admin → Categories, in the owner's order), then hands them
 * to the interactive shell — so the right menu is in the first paint.
 */
export default async function Header() {
  const [user, cartCount, all] = await Promise.all([getCurrentUser(), getCartCount(), getCategories()]);
  const menu = all.filter((c) => c.showInMenu);
  const categories = menu
    .filter((c) => c.parentId === null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      children: menu.filter((child) => child.parentId === c.id).map(({ id, name, slug }) => ({ id, name, slug })),
    }));

  return (
    <HeaderClient
      user={
        user
          ? { name: user.name, email: user.email, isStaff: user.isStaff, isWholesale: isApprovedWholesale(user) }
          : null
      }
      cartCount={cartCount}
      categories={categories}
    />
  );
}
