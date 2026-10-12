import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth";
import type { FaqInput, PageInput } from "@/lib/validators";
import { NotFoundError, UserError } from "@/server/errors";
import { isFixedPage } from "./pages";

/** Admin → Content: pages and FAQs. Every change is audited. */

const slugTaken = () =>
  new UserError("Please correct the highlighted fields", 422, { slug: "Another page already uses this web address." });

export async function savePage(staff: SessionUser, input: PageInput, pageId?: string) {
  const existing = pageId ? await db.page.findUnique({ where: { id: pageId } }) : null;
  if (pageId && !existing) throw new NotFoundError("Page not found");
  if (existing && isFixedPage(existing.slug) && input.slug !== existing.slug) {
    throw new UserError("Please correct the highlighted fields", 422, {
      slug: "This page is linked from the footer and checkout, so its web address can't change.",
    });
  }
  if (!existing && isFixedPage(input.slug) && (await db.page.count({ where: { slug: input.slug } })) > 0) throw slugTaken();

  const data = {
    ...input,
    // Fixed pages are linked from the footer already.
    showInFooter: isFixedPage(input.slug) ? false : input.showInFooter,
    publishedAt: input.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : existing?.publishedAt ?? null,
    updatedById: staff.id,
  };
  try {
    const page = existing
      ? await db.page.update({ where: { id: existing.id }, data, select: { id: true, slug: true } })
      : await db.page.create({
          data: { ...data, position: ((await db.page.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1 },
          select: { id: true, slug: true },
        });
    await audit({
      actor: staff,
      action: existing ? "page.update" : "page.create",
      entityType: "Page",
      entityId: page.id,
      before: existing ? { title: existing.title, slug: existing.slug, status: existing.status } : undefined,
      after: { title: input.title, slug: input.slug, status: input.status },
    });
    return page;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw slugTaken();
    throw error;
  }
}

export async function deletePage(staff: SessionUser, pageId: string): Promise<void> {
  const page = await db.page.findUnique({ where: { id: pageId }, select: { id: true, slug: true, title: true } });
  if (!page) throw new NotFoundError("Page not found");
  if (isFixedPage(page.slug)) {
    throw new UserError("This page is linked from across the shop, so it can't be deleted. Set it to Draft to hide it.", 409);
  }
  await db.page.delete({ where: { id: page.id } });
  await audit({ actor: staff, action: "page.delete", entityType: "Page", entityId: page.id, before: page });
}

export async function saveFaq(staff: SessionUser, input: FaqInput, faqId?: string) {
  const existing = faqId ? await db.faq.findUnique({ where: { id: faqId } }) : null;
  if (faqId && !existing) throw new NotFoundError("Question not found");
  const faq = existing
    ? await db.faq.update({ where: { id: existing.id }, data: input, select: { id: true } })
    : await db.faq.create({
        data: { ...input, position: ((await db.faq.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1 },
        select: { id: true },
      });
  await audit({
    actor: staff,
    action: existing ? "faq.update" : "faq.create",
    entityType: "Faq",
    entityId: faq.id,
    before: existing ? { question: existing.question, isActive: existing.isActive } : undefined,
    after: { question: input.question, isActive: input.isActive },
  });
  return faq;
}

export async function deleteFaq(staff: SessionUser, faqId: string): Promise<void> {
  const faq = await db.faq.findUnique({ where: { id: faqId }, select: { id: true, question: true } });
  if (!faq) throw new NotFoundError("Question not found");
  await db.faq.delete({ where: { id: faq.id } });
  await audit({ actor: staff, action: "faq.delete", entityType: "Faq", entityId: faq.id, before: faq });
}

export async function reorderFaqs(staff: SessionUser, ids: string[]): Promise<void> {
  await db.$transaction(ids.map((id, position) => db.faq.updateMany({ where: { id }, data: { position } })));
  await audit({ actor: staff, action: "faq.reorder", entityType: "Faq", after: { ids } });
}
