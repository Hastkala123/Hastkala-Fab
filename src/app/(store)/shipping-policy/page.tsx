import ContentPage, { contentPageMetadata } from "@/components/content/ContentPage";

export const dynamic = "force-dynamic";

export const generateMetadata = () => contentPageMetadata("shipping-policy");

export default function ShippingPolicyPage() {
  return <ContentPage slug="shipping-policy" />;
}
