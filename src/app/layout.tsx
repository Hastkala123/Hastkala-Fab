import type { Metadata, Viewport } from "next";
import { env } from "@/lib/env";
import { ToastProvider } from "@/components/ui/Toast";
import "./globals.css";

/**
 * Root metadata. `metadataBase` makes every relative OG/canonical URL in child
 * pages resolve to an absolute one, which is what social crawlers require.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Hastkala Fab — Authentic Sanganeri Print Kurtis, Sarees, Suits & Bedsheets",
    template: "%s | Hastkala Fab",
  },
  description:
    "Shop authentic hand-block Sanganeri print kurtis, sarees, ladies suits and cotton bedsheets direct from Sanganer, Jaipur. Retail and wholesale. Free shipping over ₹999.",
  keywords: [
    "sanganeri print",
    "sanganeri print kurti",
    "sanganeri saree",
    "hand block print bedsheet",
    "jaipuri cotton suit",
    "wholesale sanganeri print fabric",
    "block print kurti online",
    "cotton kurti Jaipur",
    "Hastkala Fab",
  ],
  authors: [{ name: "Hastkala Fab" }],
  creator: "Hastkala Fab",
  publisher: "Hastkala Fab",
  formatDetection: { telephone: true, address: false, email: false },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Hastkala Fab",
    title: "Hastkala Fab — Authentic Sanganeri Hand Block Prints",
    description:
      "Kurtis, sarees, ladies suits and bedsheets in traditional Sanganeri block print. Direct from the artisans of Jaipur.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hastkala Fab — Authentic Sanganeri Hand Block Prints",
    description:
      "Kurtis, sarees, ladies suits and bedsheets in traditional Sanganeri block print.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a5f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
