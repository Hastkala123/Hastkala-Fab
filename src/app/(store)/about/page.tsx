import ContentPage, { contentPageMetadata } from "@/components/content/ContentPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () => contentPageMetadata("about");

export default function AboutPage() {
  return <ContentPage slug="about" />;
}
