import type { Metadata } from "next";
import type { RawSearchParams } from "@/server/catalog/params";
import { CategoryListing, categoryMetadata } from "./category-listing";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category } = await params;
  return categoryMetadata(category, null, await searchParams);
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  return <CategoryListing slug={category} parentSlug={null} raw={await searchParams} />;
}
