import { notFound, permanentRedirect } from "next/navigation";
import ContentPage, { contentPageMetadata } from "@/components/content/ContentPage";
import { isFixedPage, pagePath } from "@/server/content/pages";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const validSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 120;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return validSlug(slug) ? contentPageMetadata(slug) : { title: "Page not found" };
}

/** Pages the owner adds in Admin → Content. The fixed ones keep their own short address. */
export default async function OwnerPage({ params }: Props) {
  const { slug } = await params;
  if (!validSlug(slug)) notFound();
  if (isFixedPage(slug)) permanentRedirect(pagePath(slug));
  return <ContentPage slug={slug} />;
}
