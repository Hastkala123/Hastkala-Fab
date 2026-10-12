import ContentPage, { contentPageMetadata } from "@/components/content/ContentPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () => contentPageMetadata("returns-policy");

export default function ReturnsPolicyPage() {
  return <ContentPage slug="returns-policy" />;
}
