import ContentPage, { contentPageMetadata } from "@/components/content/ContentPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () => contentPageMetadata("terms");

export default function TermsPage() {
  return <ContentPage slug="terms" />;
}
