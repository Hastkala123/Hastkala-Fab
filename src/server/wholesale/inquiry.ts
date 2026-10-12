import "server-only";

import { db } from "@/lib/db";

/** A lead from the public /wholesale pages (no account needed). */
export async function createInquiry(input: {
  name: string;
  phone: string;
  email: string | null;
  businessName: string | null;
  city: string | null;
  categoriesOfInterest: string[];
  message: string | null;
  source: string | null;
}): Promise<void> {
  // The same person sending the form twice in a row makes one lead, not two.
  const recent = await db.wholesaleInquiry.findFirst({
    where: { phone: input.phone, createdAt: { gte: new Date(Date.now() - 10 * 60_000) } },
    select: { id: true },
  });
  if (recent) {
    await db.wholesaleInquiry.update({
      where: { id: recent.id },
      data: { message: input.message, categoriesOfInterest: input.categoriesOfInterest },
    });
    return;
  }
  await db.wholesaleInquiry.create({ data: { ...input, status: "NEW" } });
}
