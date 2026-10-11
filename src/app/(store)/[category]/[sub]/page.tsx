import type { Metadata } from "next";
import type { RawSearchParams } from "@/server/catalog/params";
import { CategoryListing, categoryMetadata } from "../category-listing";

type Props = { params: Promise<{ category: string; sub: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { category, sub } = await params;
  return categoryMetadata(sub, category, await searchParams);
}

export default async function SubCategoryPage({ params, searchParams }: Props) {
  const { category, sub } = await params;
  return <CategoryListing slug={sub} parentSlug={category} raw={await searchParams} />;
}
