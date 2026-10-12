/**
 * Seeds the Hastkala Fab database.
 *
 *   Always (dev and production): staff roles, owner accounts, the default
 *   wholesale price tier, HSN codes with PLACEHOLDER tax rules, launch
 *   categories and their product fields, and starting about / contact /
 *   policy pages for the owner to review.
 *
 *   Development only: the sample catalogue, sample coupons, active FAQs and
 *   demo shopper + wholesale accounts.
 *
 * Idempotent: every write is an upsert keyed on a natural unique column, and
 * existing passwords, stock and photos are never overwritten.
 */
import { PrismaClient, type AttributeType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { passwordSchema } from "../src/lib/validators";
import { gstinCheckCharacter } from "../src/lib/gstin";
import { SYSTEM_ROLES } from "../src/server/auth/permissions";
import { blockPrint, encodePng } from "./png.js";
import { CATEGORY_TREE, COLOURWAYS, FAQS, PAGES, PRODUCTS, type Motif } from "./seed-data.js";

// `tsx` does not load .env on its own; Prisma only reads DATABASE_URL from it.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the real environment (CI, production shell).
}

const db = new PrismaClient();
const isProduction = process.env.NODE_ENV === "production";
const MEDIA_ROOT = path.join(process.cwd(), "storage", "media");

const OWNER_TO_CONFIRM =
  "OWNER_TO_CONFIRM: development placeholder — confirm this HSN code and GST rate with your CA before going live.";

function readSeedPassword(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Add a strong password for the seeded accounts to .env (see .env.example).`,
    );
  }
  const result = passwordSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`${name} is too weak: ${result.error.issues[0]?.message}`);
  }
  return value;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// Sample images (development only): generated block-print patterns
// ---------------------------------------------------------------------------

async function makeImage(
  name: string,
  colourway: keyof typeof COLOURWAYS,
  motif: Motif,
  width = 900,
  height = 1200,
): Promise<{ url: string; storageKey: string; width: number; height: number }> {
  const cw = COLOURWAYS[colourway]!;
  const pixels = blockPrint(width, height, {
    ...cw,
    tile: motif === "stripe" ? 90 : 108,
    motif,
    seed: [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7),
  });
  const storageKey = `seed/${name}.png`;
  await mkdir(path.join(MEDIA_ROOT, "seed"), { recursive: true });
  await writeFile(path.join(MEDIA_ROOT, storageKey), encodePng(width, height, pixels));
  return { url: `/media/${storageKey}`, storageKey, width, height };
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/** Placeholder HSN codes per top-level category; the owner's CA confirms them. */
const HSN_CODES = [
  {
    code: "6204",
    description: "Women's suits, ensembles, dresses (kurtis, salwar suits) — placeholder",
    bands: [
      { minUnitValue: 0, maxUnitValue: 250_000, rateBps: 500 },
      { minUnitValue: 250_001, maxUnitValue: null, rateBps: 1800 },
    ],
  },
  {
    code: "6302",
    description: "Bed linen (bedsheets, pillow covers) — placeholder",
    bands: [
      { minUnitValue: 0, maxUnitValue: 250_000, rateBps: 500 },
      { minUnitValue: 250_001, maxUnitValue: null, rateBps: 1800 },
    ],
  },
  {
    code: "6214",
    description: "Shawls, stoles, dupattas — placeholder",
    bands: [
      { minUnitValue: 0, maxUnitValue: 250_000, rateBps: 500 },
      { minUnitValue: 250_001, maxUnitValue: null, rateBps: 1800 },
    ],
  },
  {
    code: "5208",
    description: "Woven cotton fabric (sarees, fabric by the metre) — placeholder",
    bands: [{ minUnitValue: 0, maxUnitValue: null, rateBps: 500 }],
  },
] as const;

const CATEGORY_HSN: Record<string, string> = {
  kurtis: "6204",
  "salwar-suits": "6204",
  sarees: "5208",
  bedsheets: "6302",
  dupattas: "6214",
  fabric: "5208",
};

type AttributeSeed = {
  key: string;
  label: string;
  type: AttributeType;
  unit?: string;
  options?: string[];
  filterable?: boolean;
  category?: string; // top-level category slug; omitted = every category
};

const ATTRIBUTES: AttributeSeed[] = [
  // Every category
  { key: "fabric", label: "Fabric", type: "SELECT", filterable: true, options: ["100% Cotton", "Cotton Cambric", "Mulmul Cotton", "Cotton Percale", "Chanderi", "Kota Doria", "Rayon"] },
  { key: "print_style", label: "Print style", type: "SELECT", filterable: true, options: ["Sanganeri", "Bagru", "Dabu", "Indigo"] },
  { key: "motif", label: "Motif", type: "MULTI_SELECT", filterable: true, options: ["Buti", "Floral", "Jaal", "Leaf", "Paisley", "Geometric", "Stripe"] },
  { key: "colour_family", label: "Colour", type: "MULTI_SELECT", filterable: true, options: ["Indigo / Blue", "Red / Maroon", "Yellow / Mustard", "Green", "Pink", "White / Cream", "Black", "Multicolour"] },
  { key: "occasion", label: "Occasion", type: "MULTI_SELECT", filterable: true, options: ["Daily Wear", "Office", "Festive", "Casual Outing", "Formal", "Gifting", "Home"] },
  { key: "dye_type", label: "Dye type", type: "SELECT", options: ["Natural dyes", "Azo-free dyes", "Other"] },
  // Kurtis
  { key: "silhouette", label: "Silhouette", type: "SELECT", filterable: true, category: "kurtis", options: ["Straight", "A-line", "Anarkali", "Flared", "Kaftan"] },
  { key: "set_type", label: "Set type", type: "SELECT", filterable: true, category: "kurtis", options: ["Kurti only", "Kurti with pant", "Kurti, pant and dupatta"] },
  { key: "kurti_length", label: "Length", type: "SELECT", filterable: true, category: "kurtis", options: ["Short", "Hip length", "Knee length", "Calf length", "Ankle length"] },
  { key: "sleeve", label: "Sleeve", type: "SELECT", filterable: true, category: "kurtis", options: ["Sleeveless", "Short", "Elbow", "Three-quarter", "Full"] },
  { key: "neck", label: "Neck", type: "SELECT", category: "kurtis", options: ["Round", "V-neck", "Mandarin collar", "Boat", "Square", "Keyhole"] },
  { key: "lining", label: "Lined", type: "BOOLEAN", category: "kurtis" },
  { key: "pockets", label: "Pockets", type: "BOOLEAN", category: "kurtis" },
  // Salwar suits
  { key: "stitch_type", label: "Stitch type", type: "SELECT", filterable: true, category: "salwar-suits", options: ["Unstitched", "Semi-stitched", "Stitched"] },
  { key: "top_length_m", label: "Top fabric length", type: "NUMBER", unit: "m", category: "salwar-suits" },
  { key: "bottom_length_m", label: "Bottom fabric length", type: "NUMBER", unit: "m", category: "salwar-suits" },
  { key: "dupatta_fabric", label: "Dupatta", type: "SELECT", filterable: true, category: "salwar-suits", options: ["Mulmul", "Cotton", "Chiffon", "Chanderi", "Kota Doria", "No dupatta"] },
  { key: "dupatta_length_m", label: "Dupatta length", type: "NUMBER", unit: "m", category: "salwar-suits" },
  // Sarees
  { key: "saree_length_m", label: "Saree length", type: "NUMBER", unit: "m", filterable: true, category: "sarees" },
  { key: "blouse_piece", label: "Blouse piece included", type: "BOOLEAN", filterable: true, category: "sarees" },
  { key: "blouse_length_m", label: "Blouse piece length", type: "NUMBER", unit: "m", category: "sarees" },
  { key: "blouse_stitching", label: "Blouse", type: "SELECT", category: "sarees", options: ["Unstitched", "Stitched"] },
  { key: "border", label: "Border", type: "TEXT", category: "sarees" },
  // Bedsheets
  { key: "bed_size", label: "Bed size", type: "SELECT", filterable: true, category: "bedsheets", options: ["Single", "Double", "King", "Super King"] },
  { key: "dimensions", label: "Bedsheet size", type: "TEXT", category: "bedsheets" },
  { key: "thread_count", label: "Thread count", type: "NUMBER", unit: "TC", filterable: true, category: "bedsheets" },
  { key: "pillow_covers", label: "Pillow covers", type: "NUMBER", filterable: true, category: "bedsheets" },
  { key: "pillow_cover_size", label: "Pillow cover size", type: "TEXT", category: "bedsheets" },
  { key: "sheet_type", label: "Sheet type", type: "SELECT", category: "bedsheets", options: ["Flat", "Fitted"] },
];

const FABRIC_MAP: Record<string, string> = {
  "100% Cotton": "100% Cotton",
  "Cotton Cambric": "Cotton Cambric",
  "Mulmul Cotton": "Mulmul Cotton",
  "100% Cotton Percale": "Cotton Percale",
  "100% Cotton + Mulmul Dupatta": "100% Cotton",
  "100% Cotton, 44in width": "100% Cotton",
};

const COLOUR_FAMILY: Record<string, string> = {
  indigoCream: "Indigo / Blue",
  indigoGround: "Indigo / Blue",
  madderCream: "Red / Maroon",
  turmericCream: "Yellow / Mustard",
  sageCream: "Green",
};

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function seedStaff(): Promise<void> {
  for (const role of SYSTEM_ROLES) {
    await db.staffRole.upsert({
      where: { name: role.name },
      update: { description: role.description, isSystem: true },
      create: { ...role, isSystem: true },
    });
  }

  const adminPassword = await bcrypt.hash(readSeedPassword("SEED_ADMIN_PASSWORD"), 12);
  const owners = [
    { email: "priyanshu@hastkalafab.com", name: "Priyanshu Khandelwal" },
    { email: "harsh@hastkalafab.com", name: "Harsh Khandelwal" },
  ];
  for (const owner of owners) {
    await db.user.upsert({
      where: { email: owner.email },
      update: { name: owner.name, isStaff: true, isOwner: true },
      create: {
        ...owner,
        passwordHash: adminPassword,
        isStaff: true,
        isOwner: true,
        emailVerifiedAt: new Date(),
      },
    });
  }
  console.log(`  ✓ ${SYSTEM_ROLES.length} staff roles, ${owners.length} owner accounts`);
}

async function seedTax(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const hsn of HSN_CODES) {
    const row = await db.hsnCode.upsert({
      where: { code: hsn.code },
      update: {},
      create: { code: hsn.code, description: hsn.description },
    });
    ids.set(hsn.code, row.id);
    const existing = await db.taxRule.count({ where: { hsnCodeId: row.id } });
    if (existing === 0) {
      await db.taxRule.createMany({
        data: hsn.bands.map((band) => ({
          hsnCodeId: row.id,
          ...band,
          effectiveFrom: new Date("2025-09-22T00:00:00+05:30"),
          note: OWNER_TO_CONFIRM,
        })),
      });
    }
  }
  console.log(`  ✓ ${HSN_CODES.length} HSN codes with PLACEHOLDER tax rules (confirm with your CA)`);
  return ids;
}

async function seedPriceTier(): Promise<string> {
  const tier = await db.priceTier.upsert({
    where: { name: "Standard" },
    update: { isDefault: true },
    create: { name: "Standard", description: "Default prices for approved wholesale buyers.", isDefault: true },
  });
  return tier.id;
}

type CategoryRef = { id: string; root: string };

async function seedCategories(hsnIds: Map<string, string>, withImages: boolean): Promise<Map<string, CategoryRef>> {
  const categories = new Map<string, CategoryRef>();

  for (const [index, node] of CATEGORY_TREE.entries()) {
    const image = withImages
      ? await makeImage(`category-${node.slug}`, node.colourway, node.motif, 800, 1000)
      : null;
    const hsnCodeId = hsnIds.get(CATEGORY_HSN[node.slug] ?? "") ?? null;
    const parent = await db.category.upsert({
      where: { slug: node.slug },
      update: { hsnCodeId },
      create: {
        name: node.name,
        slug: node.slug,
        description: node.description,
        metaTitle: node.metaTitle,
        metaDescription: node.metaDescription,
        imageUrl: image?.url ?? null,
        position: index,
        hsnCodeId,
      },
    });
    categories.set(node.slug, { id: parent.id, root: node.slug });

    for (const [childIndex, child] of node.children.entries()) {
      const row = await db.category.upsert({
        where: { slug: child.slug },
        update: { parentId: parent.id, hsnCodeId },
        create: { name: child.name, slug: child.slug, parentId: parent.id, position: childIndex, hsnCodeId },
      });
      categories.set(child.slug, { id: row.id, root: node.slug });
    }
  }
  console.log(`  ✓ ${categories.size} categories`);
  return categories;
}

async function seedAttributes(categories: Map<string, CategoryRef>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const [position, attr] of ATTRIBUTES.entries()) {
    const categoryId = attr.category ? (categories.get(attr.category)?.id ?? null) : null;
    const row = await db.attributeDefinition.upsert({
      where: { key: attr.key },
      update: {},
      create: {
        key: attr.key,
        label: attr.label,
        type: attr.type,
        unit: attr.unit ?? null,
        options: attr.options ?? [],
        categoryId,
        isFilterable: attr.filterable ?? false,
        position,
      },
    });
    ids.set(attr.key, row.id);
  }
  console.log(`  ✓ ${ATTRIBUTES.length} product fields (editable in Admin → Product fields)`);
  return ids;
}

async function seedSampleCatalogue(
  categories: Map<string, CategoryRef>,
  attributeIds: Map<string, string>,
  hsnIds: Map<string, string>,
  tierId: string,
): Promise<void> {
  const views = ["front view", "print close-up", "fabric detail"];
  const occasionOptions = new Set(ATTRIBUTES.find((a) => a.key === "occasion")!.options);
  let created = 0;

  for (const [position, seed] of PRODUCTS.entries()) {
    const category = categories.get(seed.category);
    if (!category) throw new Error(`Unknown category slug: ${seed.category}`);
    const existing = await db.product.findUnique({ where: { slug: seed.slug }, select: { id: true } });
    if (existing) continue; // never overwrite edits made in admin

    const hsnCodeId = hsnIds.get(CATEGORY_HSN[category.root] ?? "") ?? null;
    const wholesaleMinQty = category.root === "fabric" ? 20 : 10;

    const options: { size: string | null; colorName: string | null; sku: string }[] = seed.sizes?.length
      ? seed.sizes.map((size) => ({ size, colorName: null, sku: `${seed.sku}-${size}` }))
      : seed.colours?.length
        ? seed.colours.map((colour) => ({ size: null, colorName: colour, sku: `${seed.sku}-${slugify(colour).toUpperCase()}` }))
        : [{ size: null, colorName: null, sku: seed.sku }];

    const perVariant = Math.floor(seed.stock / options.length);
    const remainder = seed.stock - perVariant * options.length;

    const motifs: Motif[] = [seed.motif, seed.motif === "buti" ? "floral" : "buti", "jaal"];
    const media = [];
    for (const [i, motif] of motifs.entries()) {
      media.push({ ...(await makeImage(`${seed.slug}-${i + 1}`, seed.colourway, motif)), i });
    }

    const attributeValues: { attributeId: string; value: string }[] = [];
    const add = (key: string, value: string | undefined) => {
      const attributeId = attributeIds.get(key);
      if (attributeId && value) attributeValues.push({ attributeId, value });
    };
    add("fabric", FABRIC_MAP[seed.fabric]);
    add("print_style", "Sanganeri");
    add("motif", seed.motif[0]!.toUpperCase() + seed.motif.slice(1));
    add("colour_family", COLOUR_FAMILY[seed.colourway]);
    for (const occasion of seed.occasion.split(",").map((o) => o.trim())) {
      if (occasionOptions.has(occasion)) add("occasion", occasion);
    }

    const product = await db.product.create({
      data: {
        title: seed.title,
        slug: seed.slug,
        shortDescription: seed.shortDesc,
        description: seed.description,
        categoryId: category.id,
        status: "ACTIVE",
        printTechnique: "HAND_BLOCK",
        hsnCodeId,
        mrp: seed.mrp * 100,
        price: seed.priceRetail * 100,
        wholesaleEnabled: true,
        wholesaleMinQty,
        careInstructions: seed.washCare,
        isFeatured: seed.featured ?? false,
        isNewArrival: position >= PRODUCTS.length - 4,
        position,
        metaTitle: `${seed.title} | Hastkala Fab`,
        metaDescription: seed.shortDesc,
        searchKeywords: seed.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        variants: {
          create: options.map((option, i) => ({
            sku: option.sku,
            size: option.size,
            colorName: option.colorName,
            stock: perVariant + (i === 0 ? remainder : 0),
            position: i,
          })),
        },
        media: {
          create: media.map((m) => ({
            url: m.url,
            storageKey: m.storageKey,
            width: m.width,
            height: m.height,
            alt: `${seed.title} — ${views[m.i]}`,
            position: m.i,
          })),
        },
        wholesalePrices: {
          create: [{ priceTierId: tierId, minQuantity: wholesaleMinQty, unitPrice: seed.priceWholesale * 100 }],
        },
        attributeValues: { create: attributeValues },
      },
      select: { id: true, variants: { select: { id: true, stock: true } } },
    });

    // Opening stock goes into the ledger like any other movement.
    await db.inventoryMovement.createMany({
      data: product.variants.map((v) => ({
        variantId: v.id,
        change: v.stock,
        stockAfter: v.stock,
        reason: "INITIAL" as const,
        note: "Sample catalogue",
      })),
    });
    created += 1;
  }
  console.log(`  ✓ ${created} SAMPLE products created (replace with your real catalogue)`);
}

async function seedSampleCoupons(categories: Map<string, CategoryRef>): Promise<void> {
  type CouponSeed = {
    code: string;
    description: string;
    type: "PERCENT" | "FLAT" | "FREE_SHIPPING";
    value: number;
    minOrderValue: number;
    maxDiscount?: number;
    perUserLimit: number;
    audience: "RETAIL" | "WHOLESALE";
    firstOrderOnly?: boolean;
    categorySlugs?: string[];
  };
  const coupons: CouponSeed[] = [
    { code: "WELCOME10", description: "10% off your first order (max ₹500)", type: "PERCENT", value: 10, minOrderValue: 99_900, maxDiscount: 50_000, perUserLimit: 1, audience: "RETAIL", firstOrderOnly: true },
    { code: "FESTIVE20", description: "20% off sarees, max ₹1,000", type: "PERCENT", value: 20, minOrderValue: 249_900, maxDiscount: 100_000, perUserLimit: 2, audience: "RETAIL", categorySlugs: ["sarees"] },
    { code: "TRADE15", description: "15% off wholesale orders above ₹25,000", type: "PERCENT", value: 15, minOrderValue: 2_500_000, maxDiscount: 500_000, perUserLimit: 5, audience: "WHOLESALE" },
    { code: "FLAT200", description: "₹200 off orders above ₹1,499", type: "FLAT", value: 20_000, minOrderValue: 149_900, perUserLimit: 3, audience: "RETAIL" },
    { code: "FREESHIP", description: "Free shipping on any order", type: "FREE_SHIPPING", value: 0, minOrderValue: 0, perUserLimit: 2, audience: "RETAIL" },
  ];
  for (const { categorySlugs, ...coupon } of coupons) {
    await db.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: {
        ...coupon,
        categories: categorySlugs
          ? { create: categorySlugs.map((slug) => ({ categoryId: categories.get(slug)!.id })) }
          : undefined,
      },
    });
  }
  console.log(`  ✓ ${coupons.length} sample coupons`);
}

async function seedFaqs(): Promise<void> {
  if ((await db.faq.count()) > 0) return;
  await db.faq.createMany({
    data: FAQS.map((faq, position) => ({
      question: faq.question,
      answer: faq.answer,
      group: faq.category,
      position,
      // Policies in these answers must match the owner's real policies first.
      isActive: !isProduction,
    })),
  });
  console.log(`  ✓ ${FAQS.length} FAQs${isProduction ? " (hidden until reviewed)" : ""}`);
}

/**
 * About, contact and policy pages, published so the links across the shop
 * (footer, checkout, sign-up) work from day one. Their values (shipping fee,
 * return days, contact details) come from Settings. Only missing pages are
 * added, so the owner's edits are kept; Admin → Pages flags pages still on
 * this starting text.
 */
async function seedPages(): Promise<void> {
  const existing = new Set((await db.page.findMany({ select: { slug: true } })).map((p) => p.slug));
  const fresh = PAGES.filter((p) => !existing.has(p.slug));
  const now = new Date();
  for (const [position, page] of fresh.entries()) {
    await db.page.create({ data: { ...page, status: "PUBLISHED", publishedAt: now, position } });
  }
  console.log(`  ✓ ${fresh.length} pages`);
}

/**
 * Words shoppers use for the same thing. Editable in Admin → Search; the
 * seed only adds terms that aren't there yet, so owner edits are kept.
 */
const SYNONYMS: { term: string; synonyms: string[] }[] = [
  { term: "bedsheet", synonyms: ["bed sheet", "bedsheets", "chadar", "chaddar", "chadder", "bedcover", "bed cover", "bedspread"] },
  { term: "kurti", synonyms: ["kurta", "kurtis", "kurtas", "tunic", "kurtiya"] },
  { term: "salwar suit", synonyms: ["suit", "suits", "salwar", "shalwar", "suit set", "dress material", "churidar", "ladies suit"] },
  { term: "saree", synonyms: ["sari", "sarees", "saris", "saaree", "sadi"] },
  { term: "sanganeri", synonyms: ["sanganer", "jaipuri", "jaipur print", "rajasthani print"] },
  { term: "hand block", synonyms: ["block print", "handblock", "hand-block", "block printed", "chhapai", "haath chhapai"] },
  { term: "dabu", synonyms: ["daabu", "dabu print", "mud resist"] },
  { term: "cotton", synonyms: ["sooti", "pure cotton", "cotton fabric"] },
  { term: "fabric", synonyms: ["running fabric", "material", "kapda", "yardage", "cloth"] },
  { term: "dupatta", synonyms: ["chunni", "chunari", "odhni", "stole"] },
];

async function seedSynonyms(): Promise<void> {
  const existing = new Set((await db.searchSynonym.findMany({ select: { term: true } })).map((s) => s.term));
  const fresh = SYNONYMS.filter((s) => !existing.has(s.term));
  if (fresh.length) await db.searchSynonym.createMany({ data: fresh });
  console.log(`  ✓ ${fresh.length} search synonym groups`);
}

/** Demo shopper + approved wholesale buyer for local testing. */
async function seedDemoAccounts(tierId: string): Promise<string> {
  const demoPassword = process.env.SEED_DEMO_PASSWORD
    ? readSeedPassword("SEED_DEMO_PASSWORD")
    : `Demo-${randomBytes(9).toString("base64url")}9a`;
  const passwordHash = await bcrypt.hash(demoPassword, 12);

  const customer = await db.user.upsert({
    where: { email: "demo@hastkalafab.com" },
    update: {},
    create: {
      email: "demo@hastkalafab.com",
      phone: "+919876543210",
      name: "Demo Customer",
      passwordHash,
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });
  if ((await db.address.count({ where: { userId: customer.id } })) === 0) {
    await db.address.create({
      data: {
        userId: customer.id,
        fullName: "Demo Customer",
        phone: "+919876543210",
        line1: "42, Gopalbari, Near Ajmer Road",
        line2: "Opposite City Hospital",
        city: "Jaipur",
        state: "Rajasthan",
        stateCode: "08",
        pincode: "302001",
        isDefault: true,
      },
    });
  }

  // A clearly fake GSTIN (dummy PAN ABCDE1234F) with a valid check digit.
  const gstinBase = "08ABCDE1234F1Z";
  const gstin = gstinBase + gstinCheckCharacter(gstinBase);

  const wholesaler = await db.user.upsert({
    where: { email: "wholesale@hastkalafab.com" },
    update: {},
    create: {
      email: "wholesale@hastkalafab.com",
      phone: "+919812345670",
      name: "Meera Textiles",
      passwordHash,
      customerType: "WHOLESALE",
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
    },
  });
  await db.wholesaleProfile.upsert({
    where: { userId: wholesaler.id },
    update: {},
    create: {
      userId: wholesaler.id,
      businessName: "Meera Textiles & Handloom (demo)",
      gstin,
      gstinVerifiedAt: new Date(),
      businessType: "Boutique",
      city: "Jaipur",
      state: "Rajasthan",
      status: "APPROVED",
      reviewedAt: new Date(),
      priceTierId: tierId,
    },
  });
  if ((await db.address.count({ where: { userId: wholesaler.id } })) === 0) {
    await db.address.create({
      data: {
        userId: wholesaler.id,
        label: "SHOP",
        fullName: "Meera Textiles",
        phone: "+919812345670",
        line1: "12, Johari Bazaar",
        city: "Jaipur",
        state: "Rajasthan",
        stateCode: "08",
        pincode: "302003",
        gstin,
        isDefault: true,
      },
    });
  }

  console.log("  ✓ demo shopper + approved wholesale buyer");
  return demoPassword;
}

// ---------------------------------------------------------------------------

async function main() {
  if (isProduction && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to seed a production database. Set SEED_ALLOW_PRODUCTION=true if you really mean it.",
    );
  }

  console.log(`→ Seeding Hastkala Fab (${isProduction ? "production: structure only" : "development"})…`);

  await seedStaff();
  const hsnIds = await seedTax();
  const tierId = await seedPriceTier();
  const categories = await seedCategories(hsnIds, !isProduction);
  const attributeIds = await seedAttributes(categories);
  await seedFaqs();
  await seedPages();
  await seedSynonyms();

  let demoPassword: string | null = null;
  if (!isProduction) {
    await seedSampleCatalogue(categories, attributeIds, hsnIds, tierId);
    await seedSampleCoupons(categories);
    demoPassword = await seedDemoAccounts(tierId);
  }

  console.log("\n✅ Seed complete.\n");
  console.log("   Owner login   : priyanshu@hastkalafab.com, harsh@hastkalafab.com");
  console.log("                   password = SEED_ADMIN_PASSWORD (new accounts only)");
  if (demoPassword) {
    console.log("   Demo accounts : demo@hastkalafab.com, wholesale@hastkalafab.com");
    console.log(
      process.env.SEED_DEMO_PASSWORD
        ? "                   password = SEED_DEMO_PASSWORD (new accounts only)"
        : `                   password = ${demoPassword} (generated for this run, new accounts only)`,
    );
  }
  console.log("\n   ⚠  Tax rules are placeholders. Confirm HSN codes and GST rates with your CA.\n");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
