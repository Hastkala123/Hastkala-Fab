import "server-only";

import { cache } from "react";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Storefront search. Synonyms come from Admin → Search synonyms, so the owner
 * can teach the search that "chadar" means bedsheet without a developer.
 *
 * Every word the shopper types must match something (title, keywords,
 * category or an attribute such as fabric), where each word also matches its
 * synonyms and singular/plural. Close misspellings of a title match through
 * trigram similarity (pg_trgm).
 */

const STOPWORDS = new Set([
  "a", "an", "and", "the", "for", "of", "in", "on", "with", "to", "by",
  "buy", "online", "shop", "best", "new", "latest", "women", "womens", "woman",
  "ladies", "lady", "girls", "girl", "price", "low", "cheap", "sale", "india",
]);

const MAX_RESULTS = 500;

type SynonymIndex = { phrases: string[]; groups: Map<string, Set<string>> };

const getSynonymIndex = cache(async (): Promise<SynonymIndex> => {
  const rows = await db.searchSynonym.findMany({ select: { term: true, synonyms: true } });
  const groups = new Map<string, Set<string>>();
  for (const row of rows) {
    const words = [row.term, ...row.synonyms].map(normalise).filter(Boolean);
    for (const word of words) {
      const group = groups.get(word) ?? new Set<string>();
      words.forEach((w) => group.add(w));
      groups.set(word, group);
    }
  }
  const phrases = [...groups.keys()].filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length);
  return { phrases, groups };
});

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(word: string): string | null {
  if (word.length > 4 && word.endsWith("es") && !word.endsWith("sses")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return null;
}

/** Splits a query into word groups; a product must match one word from every group. */
export async function expandQuery(query: string): Promise<string[][]> {
  const { phrases, groups } = await getSynonymIndex();
  let text = ` ${normalise(query).slice(0, 100)} `;
  const result: string[][] = [];

  for (const phrase of phrases) {
    if (text.includes(` ${phrase} `)) {
      result.push([...groups.get(phrase)!]);
      text = text.replace(` ${phrase} `, " ");
    }
  }

  for (const word of text.split(" ")) {
    if (!word || STOPWORDS.has(word)) continue;
    const alts = new Set<string>([word]);
    const one = singular(word);
    if (one) alts.add(one);
    for (const w of [...alts]) groups.get(w)?.forEach((g) => alts.add(g));
    result.push([...alts]);
    if (result.length >= 8) break;
  }
  return result;
}

const likePattern = (word: string) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Ids of products matching the query, best match first. Returns null when the
 * query has no meaningful words (show everything instead).
 */
export async function searchProductIds(query: string): Promise<string[] | null> {
  const groups = await expandQuery(query);
  if (groups.length === 0) return null;
  const whole = normalise(query).slice(0, 100);

  const groupClauses = groups.map((alts) => {
    const patterns = alts.map(likePattern);
    return Prisma.sql`(
      p."title" ILIKE ANY(${patterns})
      OR array_to_string(p."searchKeywords", ' ') ILIKE ANY(${patterns})
      OR c."name" ILIKE ANY(${patterns})
      OR EXISTS (SELECT 1 FROM "ProductAttributeValue" v
                  WHERE v."productId" = p."id" AND v."value" ILIKE ANY(${patterns}))
      OR EXISTS (SELECT 1 FROM "ProductVariant" pv
                  WHERE pv."productId" = p."id" AND (pv."sku" ILIKE ANY(${patterns}) OR pv."colorName" ILIKE ANY(${patterns})))
    )`;
  });

  const rows = await db.$queryRaw<{ id: string }[]>`
    SELECT p."id"
      FROM "Product" p
      JOIN "Category" c ON c."id" = p."categoryId"
     WHERE (${Prisma.join(groupClauses, " AND ")})
        OR word_similarity(${whole}, lower(p."title")) >= 0.5
     ORDER BY word_similarity(${whole}, lower(p."title")) DESC, p."position" ASC, p."createdAt" DESC
     LIMIT ${MAX_RESULTS}`;
  return rows.map((r) => r.id);
}
