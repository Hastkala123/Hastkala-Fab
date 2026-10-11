import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

/**
 * Storefront shell. The CSRF cookie every form depends on is seeded by
 * src/proxy.ts, because server components are not allowed to set cookies.
 */
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
