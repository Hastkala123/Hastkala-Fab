import ContentPage, { contentPageMetadata } from "@/components/content/ContentPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () => contentPageMetadata("privacy-policy");

export default function PrivacyPolicyPage() {
  return <ContentPage slug="privacy-policy" />;
}
