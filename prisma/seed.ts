import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { passwordSchema } from "../src/lib/validators";
import { blockPrint, encodePng, PALETTE, type Rgb } from "./png.js";

// `tsx` does not load .env on its own; Prisma only reads DATABASE_URL from it.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the real environment (CI, production shell).
}

const db = new PrismaClient();
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

/**
 * Seeds a realistic Hastkala Fab catalogue plus the two admin accounts.
 *
 * Idempotent: safe to re-run. Uses upserts keyed on natural unique columns so a
 * second run updates rather than duplicating.
 *
 * Credentials are never hard-coded. Admin accounts take their password from
 * SEED_ADMIN_PASSWORD; an existing admin's password is never overwritten.
 * Demo shopper accounts are created only outside production.
 */

const isProduction = process.env.NODE_ENV === "production";

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

type ColourWay = { ground: Rgb; primary: Rgb; secondary: Rgb; accent: Rgb };

const COLOURWAYS: Record<string, ColourWay> = {
  indigoCream: {
    ground: PALETTE.cream,
    primary: PALETTE.indigo,
    secondary: PALETTE.indigoLight,
    accent: PALETTE.turmeric,
  },
  madderCream: {
    ground: PALETTE.cream,
    primary: PALETTE.madder,
    secondary: PALETTE.madderLight,
    accent: PALETTE.indigo,
  },
  turmericCream: {
    ground: [253, 249, 237],
    primary: PALETTE.turmeric,
    secondary: PALETTE.madder,
    accent: PALETTE.indigo,
  },
  indigoGround: {
    ground: PALETTE.indigo,
    primary: PALETTE.cream,
    secondary: PALETTE.turmeric,
    accent: PALETTE.madderLight,
  },
  sageCream: {
    ground: PALETTE.creamDeep,
    primary: [74, 103, 78],
    secondary: [140, 168, 138],
    accent: PALETTE.madder,
  },
};

type Motif = "buti" | "floral" | "jaal" | "leaf" | "stripe";

let imageCounter = 0;

async function makeImage(
  colourway: keyof typeof COLOURWAYS,
  motif: Motif,
  width = 900,
  height = 1200,
): Promise<string> {
  const cw = COLOURWAYS[colourway];
  imageCounter += 1;
  const pixels = blockPrint(width, height, {
    ...cw,
    tile: motif === "stripe" ? 90 : 108,
    motif,
    seed: imageCounter * 7919,
  });
  const filename = `seed-${String(imageCounter).padStart(3, "0")}.png`;
  await writeFile(path.join(UPLOAD_DIR, filename), encodePng(width, height, pixels));
  return `/uploads/${filename}`;
}

// ---------------------------------------------------------------------------

const CATEGORY_TREE = [
  {
    name: "Kurtis",
    slug: "kurtis",
    description:
      "Hand-block Sanganeri print kurtis in pure cotton and mulmul — straight cuts, A-lines and anarkalis for daily wear and occasions.",
    metaTitle: "Sanganeri Print Kurtis Online | Cotton Block Print Kurtis",
    metaDescription:
      "Buy authentic Sanganeri hand block print cotton kurtis online. Straight, A-line & anarkali styles direct from Jaipur artisans. Free shipping above ₹999.",
    colourway: "indigoCream" as const,
    motif: "buti" as const,
    children: [
      { name: "Cotton Kurtis", slug: "cotton-kurtis" },
      { name: "Anarkali Kurtis", slug: "anarkali-kurtis" },
      { name: "Long Kurtis", slug: "long-kurtis" },
    ],
  },
  {
    name: "Sarees",
    slug: "sarees",
    description:
      "Sanganeri print sarees in mulmul, chanderi and pure cotton, with matching blouse pieces. Light enough for summer, formal enough for a wedding.",
    metaTitle: "Sanganeri Print Sarees | Hand Block Cotton Sarees Online",
    metaDescription:
      "Shop hand block printed Sanganeri sarees in cotton, mulmul and chanderi with blouse piece. Authentic Jaipur craftsmanship, delivered across India.",
    colourway: "madderCream" as const,
    motif: "floral" as const,
    children: [
      { name: "Cotton Sarees", slug: "cotton-sarees" },
      { name: "Mulmul Sarees", slug: "mulmul-sarees" },
    ],
  },
  {
    name: "Suits (Ladies)",
    slug: "suits",
    description:
      "Unstitched and ready-to-wear ladies suit sets — kurta, bottom and dupatta in coordinated Sanganeri prints.",
    metaTitle: "Ladies Sanganeri Print Suit Sets | Cotton Suits with Dupatta",
    metaDescription:
      "Buy Sanganeri print ladies suit sets online — cotton kurta, bottom and dupatta. Unstitched and ready-to-wear. Direct from Sanganer, Jaipur.",
    colourway: "turmericCream" as const,
    motif: "jaal" as const,
    children: [
      { name: "Unstitched Suits", slug: "unstitched-suits" },
      { name: "Ready-to-Wear Suits", slug: "ready-to-wear-suits" },
    ],
  },
  {
    name: "Bedsheets",
    slug: "bedsheets",
    description:
      "Pure cotton Sanganeri print bedsheets with pillow covers. Double, single and king sizes in traditional and contemporary motifs.",
    metaTitle: "Sanganeri Print Cotton Bedsheets | Jaipuri Block Print Bedsheets",
    metaDescription:
      "Jaipuri Sanganeri hand block print cotton bedsheets with pillow covers. Double, king & single sizes. Soft, breathable pure cotton.",
    colourway: "indigoGround" as const,
    motif: "leaf" as const,
    children: [
      { name: "Double Bedsheets", slug: "double-bedsheets" },
      { name: "Single Bedsheets", slug: "single-bedsheets" },
    ],
  },
  {
    name: "Dupattas & Stoles",
    slug: "dupattas",
    description:
      "Hand-block printed cotton and mulmul dupattas that lift any plain kurta into an outfit.",
    metaTitle: "Sanganeri Print Dupattas & Cotton Stoles Online",
    metaDescription:
      "Hand block print Sanganeri dupattas and stoles in cotton and mulmul. Lightweight, colourfast, made in Jaipur.",
    colourway: "sageCream" as const,
    motif: "stripe" as const,
    children: [],
  },
  {
    name: "Fabric by the Metre",
    slug: "fabric",
    description:
      "Running Sanganeri print cotton fabric sold by the metre — for tailors, boutiques and home projects.",
    metaTitle: "Sanganeri Print Cotton Fabric by the Metre | Wholesale Available",
    metaDescription:
      "Buy Sanganeri hand block print cotton fabric by the metre. Retail and wholesale lots direct from Sanganer, Jaipur.",
    colourway: "indigoCream" as const,
    motif: "jaal" as const,
    children: [],
  },
];

type ProductSeed = {
  title: string;
  slug: string;
  category: string;
  description: string;
  shortDesc: string;
  priceRetail: number;
  mrp: number;
  priceWholesale: number;
  sku: string;
  stock: number;
  fabric: string;
  workType: string;
  occasion: string;
  washCare: string;
  keywords: string;
  featured?: boolean;
  colourway: keyof typeof COLOURWAYS;
  motif: Motif;
  sizes?: string[];
  colours?: string[];
  soldCount?: number;
  rating?: [number, number];
};

// Prices in rupees here; converted to paise on insert.
const PRODUCTS: ProductSeed[] = [
  {
    title: "Indigo Buti Hand Block Cotton Straight Kurti",
    slug: "indigo-buti-cotton-straight-kurti",
    category: "cotton-kurtis",
    shortDesc: "Classic indigo buti print on breathable 100% cotton, straight cut with side slits.",
    description:
      "A everyday-wear kurti in the most recognisable of all Sanganeri motifs — the small repeating buti, printed in natural indigo on soft, unbleached cotton.\n\nThe straight silhouette sits easy over leggings or palazzos, with side slits to the hip for movement and a mandarin collar finished with a three-button placket. Three-quarter sleeves keep it practical for office and college wear alike.\n\nEach panel is printed by hand using teak blocks carved in Sanganer. Small variations in motif alignment are inherent to hand printing and are the mark of an authentic piece.",
    priceRetail: 1299,
    mrp: 1899,
    priceWholesale: 749,
    sku: "HF-KUR-IND-001",
    stock: 48,
    fabric: "100% Cotton",
    workType: "Hand Block Print",
    occasion: "Daily Wear, Office",
    washCare: "Hand wash separately in cold water. Do not bleach. Dry in shade.",
    keywords: "indigo kurti, sanganeri print kurti, cotton straight kurti, block print kurti online",
    featured: true,
    colourway: "indigoCream",
    motif: "buti",
    sizes: ["S", "M", "L", "XL", "XXL"],
    soldCount: 142,
    rating: [4.6, 38],
  },
  {
    title: "Madder Red Floral Anarkali Cotton Kurti",
    slug: "madder-red-floral-anarkali-kurti",
    category: "anarkali-kurtis",
    shortDesc: "Flared anarkali in madder-root red florals with a gathered yoke.",
    description:
      "A full-flare anarkali cut from hand-block printed cotton, dyed with madder root for that characteristic warm brick red that deepens rather than fades with washing.\n\nThe yoke is gathered under a piped neckline, releasing into a generous ghera that falls to mid-calf. Lined through the bodice, unlined below so it stays cool through a Rajasthani summer.\n\nPairs naturally with a plain churidar and one of our mulmul dupattas.",
    priceRetail: 2199,
    mrp: 3299,
    priceWholesale: 1299,
    sku: "HF-KUR-ANA-002",
    stock: 32,
    fabric: "100% Cotton",
    workType: "Hand Block Print",
    occasion: "Festive, Casual Outing",
    washCare: "First wash separately. Machine wash gentle, cold. Iron medium.",
    keywords: "anarkali kurti, red block print anarkali, sanganeri anarkali, cotton anarkali online",
    featured: true,
    colourway: "madderCream",
    motif: "floral",
    sizes: ["S", "M", "L", "XL"],
    soldCount: 96,
    rating: [4.7, 24],
  },
  {
    title: "Turmeric Jaal Print Long Cotton Kurti",
    slug: "turmeric-jaal-long-cotton-kurti",
    category: "long-kurtis",
    shortDesc: "Ankle-length kurti in a turmeric-gold jaal lattice print.",
    description:
      "The jaal — a continuous lattice of interlocking vines — is the most technically demanding Sanganeri layout, requiring the printer to register each block against the last across the full length of the fabric.\n\nThis ankle-length kurti carries it in turmeric gold over cream cotton, with a straight cut, deep side slits and a simple round neck. Understated enough for work, distinct enough for an evening out.",
    priceRetail: 1799,
    mrp: 2499,
    priceWholesale: 1049,
    sku: "HF-KUR-LNG-003",
    stock: 27,
    fabric: "Cotton Cambric",
    workType: "Hand Block Print",
    occasion: "Office, Daily Wear",
    washCare: "Hand wash cold. Do not tumble dry.",
    keywords: "long kurti, jaal print kurti, yellow cotton kurti, sanganeri long kurta",
    colourway: "turmericCream",
    motif: "jaal",
    sizes: ["M", "L", "XL", "XXL"],
    soldCount: 61,
    rating: [4.4, 17],
  },
  {
    title: "Sanganeri Floral Mulmul Saree with Blouse Piece",
    slug: "sanganeri-floral-mulmul-saree",
    category: "mulmul-sarees",
    shortDesc: "Feather-light mulmul saree, 6.3m with an unstitched blouse piece.",
    description:
      "Mulmul — the fine, loosely woven cotton muslin that Bengal and Rajasthan have traded for centuries — takes hand-block print beautifully because the open weave lets dye penetrate rather than sit on the surface.\n\nThis 6.3 metre saree carries a repeating floral butti across the body, a contrast printed border and a pallu with a wider block-printed band. Comes with a 0.8m unstitched blouse piece in a coordinating print.\n\nSo light it packs into a fist — the practical choice for Indian summers and for travel.",
    priceRetail: 2899,
    mrp: 4199,
    priceWholesale: 1749,
    sku: "HF-SAR-MUL-004",
    stock: 21,
    fabric: "Mulmul Cotton",
    workType: "Hand Block Print",
    occasion: "Festive, Daily Wear",
    washCare: "Dry clean recommended for first wash. Thereafter hand wash cold.",
    keywords: "mulmul saree, sanganeri saree, cotton saree with blouse, block print saree online",
    featured: true,
    colourway: "madderCream",
    motif: "floral",
    colours: ["Madder Red", "Indigo", "Turmeric"],
    soldCount: 78,
    rating: [4.8, 31],
  },
  {
    title: "Indigo Leaf Motif Pure Cotton Saree",
    slug: "indigo-leaf-pure-cotton-saree",
    category: "cotton-sarees",
    shortDesc: "Deep indigo ground with cream leaf motifs and a printed pallu.",
    description:
      "A reverse-ground saree: instead of printing dark motifs onto cream, the cotton is vat-dyed in indigo first and the leaf motifs discharged and over-printed in cream. It is a slower process and produces a far richer blue.\n\n6.3 metres with a 0.8m blouse piece. Starched lightly so it holds a crisp pleat.",
    priceRetail: 3299,
    mrp: 4799,
    priceWholesale: 1999,
    sku: "HF-SAR-COT-005",
    stock: 18,
    fabric: "100% Cotton",
    workType: "Hand Block Print, Discharge Print",
    occasion: "Festive, Formal",
    washCare: "Dry clean only for the first three washes to preserve the indigo.",
    keywords: "indigo saree, blue cotton saree, sanganeri cotton saree, discharge print saree",
    colourway: "indigoGround",
    motif: "leaf",
    soldCount: 44,
    rating: [4.5, 12],
  },
  {
    title: "Sanganeri Print Unstitched Cotton Suit Set (3 Piece)",
    slug: "sanganeri-unstitched-cotton-suit-set",
    category: "unstitched-suits",
    shortDesc: "2.5m kurta fabric, 2.5m bottom and a 2.25m printed dupatta.",
    description:
      "A complete unstitched suit set for anyone who prefers their clothes cut to their own measurements.\n\nIncludes 2.5 metres of hand-block printed cotton for the kurta, 2.5 metres of coordinated solid-dyed cotton for the salwar or palazzo, and a 2.25 metre block-printed mulmul dupatta.\n\nAll three pieces are pre-washed and colourfast, so shrinkage after tailoring is minimal.",
    priceRetail: 1699,
    mrp: 2599,
    priceWholesale: 999,
    sku: "HF-SUT-UNS-006",
    stock: 40,
    fabric: "100% Cotton + Mulmul Dupatta",
    workType: "Hand Block Print",
    occasion: "Daily Wear, Office",
    washCare: "Wash the fabric before stitching. Hand wash cold thereafter.",
    keywords: "unstitched suit, cotton suit material, sanganeri suit set, jaipuri suit piece",
    featured: true,
    colourway: "turmericCream",
    motif: "jaal",
    colours: ["Turmeric", "Indigo", "Sage Green"],
    soldCount: 118,
    rating: [4.6, 29],
  },
  {
    title: "Ready-to-Wear Sanganeri Cotton Suit with Palazzo & Dupatta",
    slug: "ready-to-wear-sanganeri-suit-palazzo",
    category: "ready-to-wear-suits",
    shortDesc: "Stitched kurta, matching palazzo and dupatta — ready to wear.",
    description:
      "For when you do not want to wait on a tailor. A straight-cut kurta with side slits, wide-leg palazzos with an elasticated drawstring waist, and a lightweight printed dupatta — all in coordinated Sanganeri prints.\n\nSized generously through the hip and thigh. If you are between sizes we recommend going up.",
    priceRetail: 2499,
    mrp: 3799,
    priceWholesale: 1499,
    sku: "HF-SUT-RTW-007",
    stock: 24,
    fabric: "100% Cotton",
    workType: "Hand Block Print",
    occasion: "Daily Wear, Festive",
    washCare: "Machine wash gentle, cold, separately. Do not bleach.",
    keywords: "ready to wear suit, palazzo suit set, cotton kurta palazzo dupatta, sanganeri suit",
    colourway: "sageCream",
    motif: "floral",
    sizes: ["S", "M", "L", "XL", "XXL"],
    soldCount: 87,
    rating: [4.5, 22],
  },
  {
    title: "Jaipuri Sanganeri Print Double Bedsheet with 2 Pillow Covers",
    slug: "jaipuri-sanganeri-double-bedsheet",
    category: "double-bedsheets",
    shortDesc: "90x108 inch double bedsheet in pure cotton with two pillow covers.",
    description:
      "The bedsheet that made Jaipur famous. 90 x 108 inches of 100% cotton, hand-block printed in a traditional all-over floral, with two matching 17 x 27 inch pillow covers.\n\nThe cotton is a 144 thread-count percale — substantial enough to last years of washing, light enough to stay cool. Pre-shrunk and colourfast, tested to 30 washes.\n\nFits a standard Indian double or queen mattress up to 8 inches deep.",
    priceRetail: 1499,
    mrp: 2299,
    priceWholesale: 899,
    sku: "HF-BED-DBL-008",
    stock: 65,
    fabric: "100% Cotton Percale",
    workType: "Hand Block Print",
    occasion: "Home, Gifting",
    washCare: "Machine wash cold. Tumble dry low. Iron on reverse.",
    keywords: "jaipuri bedsheet, sanganeri print bedsheet, cotton double bedsheet, block print bedsheet online",
    featured: true,
    colourway: "indigoCream",
    motif: "floral",
    colours: ["Indigo", "Madder Red", "Turmeric", "Sage Green"],
    soldCount: 213,
    rating: [4.7, 64],
  },
  {
    title: "Indigo Leaf Sanganeri Single Bedsheet with Pillow Cover",
    slug: "indigo-leaf-single-bedsheet",
    category: "single-bedsheets",
    shortDesc: "60x90 inch single bedsheet with one matching pillow cover.",
    description:
      "A single-bed version of our best-selling indigo leaf print. 60 x 90 inches with one 17 x 27 inch pillow cover, in the same 144 thread-count pure cotton percale.\n\nThe indigo is vat-dyed, which means the colour is in the fibre rather than on it — it will soften over years without going patchy.",
    priceRetail: 999,
    mrp: 1599,
    priceWholesale: 599,
    sku: "HF-BED-SGL-009",
    stock: 52,
    fabric: "100% Cotton Percale",
    workType: "Hand Block Print",
    occasion: "Home, Hostel, Gifting",
    washCare: "Machine wash cold, separately for the first two washes.",
    keywords: "single bedsheet cotton, indigo bedsheet, jaipuri single bedsheet, block print single bed",
    colourway: "indigoGround",
    motif: "leaf",
    soldCount: 134,
    rating: [4.4, 41],
  },
  {
    title: "Hand Block Print Mulmul Dupatta",
    slug: "hand-block-print-mulmul-dupatta",
    category: "dupattas",
    shortDesc: "2.25m feather-light mulmul dupatta with a printed border.",
    description:
      "The fastest way to make a plain kurta look considered. 2.25 metres of mulmul cotton, hand-block printed with a fine stripe through the body and a wider band at each end, finished with a hand-knotted tassel fringe.\n\nSo light it barely registers on the shoulder — which is the point in 42°C.",
    priceRetail: 649,
    mrp: 999,
    priceWholesale: 379,
    sku: "HF-DUP-MUL-010",
    stock: 88,
    fabric: "Mulmul Cotton",
    workType: "Hand Block Print",
    occasion: "Daily Wear, Festive",
    washCare: "Hand wash cold. Do not wring. Dry flat in shade.",
    keywords: "mulmul dupatta, cotton dupatta online, block print dupatta, sanganeri dupatta",
    colourway: "sageCream",
    motif: "stripe",
    colours: ["Sage Green", "Indigo", "Madder Red", "Turmeric"],
    soldCount: 176,
    rating: [4.5, 53],
  },
  {
    title: "Sanganeri Print Cotton Fabric — Per Metre",
    slug: "sanganeri-print-cotton-fabric-per-metre",
    category: "fabric",
    shortDesc: "44-inch wide hand-block printed cotton, sold by the metre.",
    description:
      "Running fabric for tailors, boutiques and home sewers. 44 inches wide, 100% cotton, hand-block printed in Sanganer.\n\nSold by the metre — order the quantity you need and it ships as one continuous length. Minimum retail order is 1 metre; wholesale lots start at 20 metres with a further discount on 50+.\n\nPre-washed and colourfast. Expect approximately 3% shrinkage on the first wash.",
    priceRetail: 449,
    mrp: 649,
    priceWholesale: 249,
    sku: "HF-FAB-COT-011",
    stock: 400,
    fabric: "100% Cotton, 44in width",
    workType: "Hand Block Print",
    occasion: "Tailoring, Home Furnishing",
    washCare: "Pre-wash before cutting. Hand or machine wash cold.",
    keywords: "cotton fabric per metre, block print fabric, sanganeri running material, wholesale cotton fabric jaipur",
    colourway: "indigoCream",
    motif: "jaal",
    colours: ["Indigo", "Madder Red", "Turmeric", "Sage Green"],
    soldCount: 302,
    rating: [4.6, 47],
  },
  {
    title: "Madder Buti Cotton A-Line Kurti",
    slug: "madder-buti-cotton-a-line-kurti",
    category: "cotton-kurtis",
    shortDesc: "A-line kurti with a fine madder buti print and wooden buttons.",
    description:
      "An A-line cut that skims rather than clings, in a fine madder-red buti print on cream cotton. Wooden button placket, three-quarter sleeves, in-seam pockets.\n\nPockets on a kurti should not be a luxury. These are deep enough for a phone.",
    priceRetail: 1399,
    mrp: 1999,
    priceWholesale: 799,
    sku: "HF-KUR-ALN-012",
    stock: 36,
    fabric: "100% Cotton",
    workType: "Hand Block Print",
    occasion: "Daily Wear, Office",
    washCare: "Hand wash cold, separately for the first wash.",
    keywords: "a-line kurti, red buti kurti, cotton kurti with pockets, sanganeri a line kurta",
    colourway: "madderCream",
    motif: "buti",
    sizes: ["S", "M", "L", "XL", "XXL"],
    soldCount: 71,
    rating: [4.3, 19],
  },
];

const FAQS = [
  {
    category: "Orders",
    question: "How long does delivery take?",
    answer:
      "Orders are dispatched from Jaipur within 24-48 hours. Metro cities typically receive delivery in 3-5 working days, and the rest of India in 5-8 working days. You will receive a tracking number by email and SMS as soon as your parcel is handed to the courier.",
  },
  {
    category: "Orders",
    question: "Can I modify or cancel my order after placing it?",
    answer:
      "Yes, as long as the order has not yet been packed. Go to My Orders, open the order and use Cancel Order. Once the status shows Packed or Shipped we can no longer stop it — but you can still refuse delivery or raise a return once it arrives.",
  },
  {
    category: "Orders",
    question: "Do you offer Cash on Delivery?",
    answer:
      "Yes, Cash on Delivery is available on retail orders up to ₹10,000 across most PIN codes in India. Wholesale orders require prepayment or an agreed credit arrangement.",
  },
  {
    category: "Products",
    question: "Why does the print look slightly different from the photo?",
    answer:
      "Because it is printed by hand. Each piece is pressed with carved wooden blocks by an artisan, so motif placement, colour depth and registration vary a little from piece to piece. This is the signature of genuine Sanganeri work — a perfectly uniform print would indicate machine screen printing, not hand block.",
  },
  {
    category: "Products",
    question: "Will the colours run in the wash?",
    answer:
      "Natural dyes release a small amount of excess colour in the first one or two washes. Wash the garment separately in cold water the first time, do not soak it, and dry it in shade. After that it is colourfast. Indigo pieces in particular will soften over time rather than fade patchily.",
  },
  {
    category: "Products",
    question: "How do I choose the right size?",
    answer:
      "Every product page has a size chart with garment measurements in inches — measure a garment you already own and compare, rather than going by your usual label size. Our cotton is pre-shrunk, but if you are between two sizes we recommend the larger one.",
  },
  {
    category: "Returns",
    question: "What is your return policy?",
    answer:
      "You have 7 days from delivery to request a return or exchange, provided the item is unused, unwashed and has its original tags attached. Raise the request from My Orders or through the Help Centre. Once we receive and inspect the item, refunds are issued to the original payment method within 5-7 working days.",
  },
  {
    category: "Returns",
    question: "Who pays for return shipping?",
    answer:
      "If the item is defective, damaged or not what you ordered, we cover return shipping entirely. For a change of mind or a size exchange, a flat ₹79 reverse-pickup fee is deducted from the refund.",
  },
  {
    category: "Returns",
    question: "Can I return fabric sold by the metre?",
    answer:
      "Cut fabric cannot be returned unless it arrived defective, since we cannot resell a cut length. Please order a sample first if you are unsure about the colour or weave — contact us through the Help Centre and we will arrange one.",
  },
  {
    category: "Wholesale",
    question: "How do I open a wholesale account?",
    answer:
      "Register at /signup and choose Wholesale as your account type, providing your business name and GSTIN. Our team verifies new trade accounts within one working day. Once approved, wholesale pricing appears automatically across the site when you are signed in.",
  },
  {
    category: "Wholesale",
    question: "What is the minimum order quantity?",
    answer:
      "MOQ is 10 pieces per design for garments and 20 metres for running fabric. Mixed sizes and colourways within the same design count toward the same MOQ. Larger slabs at 50+ and 100+ units carry further discounts — contact us for a quotation.",
  },
  {
    category: "Wholesale",
    question: "Do you take custom colourways or private label orders?",
    answer:
      "Yes. We can print existing blocks in your specified colours, and for orders above 300 pieces we can carve new blocks to your design. Lead time is typically 3-4 weeks for custom colours and 6-8 weeks for new blocks. Raise a Wholesale enquiry through the Help Centre to start.",
  },
  {
    category: "Payments",
    question: "What payment methods do you accept?",
    answer:
      "UPI, all major credit and debit cards, net banking, and Cash on Delivery on eligible retail orders. All online payments are processed through an encrypted, PCI-DSS compliant gateway — we never see or store your full card details.",
  },
  {
    category: "Payments",
    question: "Is GST included in the price shown?",
    answer:
      "Prices shown on product pages are exclusive of GST; the applicable tax is calculated and shown separately at checkout. Textiles under ₹1,000 per piece attract 5% GST and those at ₹1,000 or above attract 12%. A GST invoice is emailed with every order and is available for download from My Orders.",
  },
];

// ---------------------------------------------------------------------------

/**
 * Demo shopper + wholesale accounts for local testing. Never run in production.
 * Returns the password used for newly created demo accounts.
 */
async function seedDemoAccounts(): Promise<string> {
  // A random password is generated unless SEED_DEMO_PASSWORD is set, so no
  // shared, guessable credential exists in any database.
  const demoPassword =
    process.env.SEED_DEMO_PASSWORD
      ? readSeedPassword("SEED_DEMO_PASSWORD")
      : `Demo-${randomBytes(9).toString("base64url")}9a`;
  const customerPassword = await bcrypt.hash(demoPassword, 12);
  const customer = await db.user.upsert({
    where: { email: "demo@hastkalafab.com" },
    update: {},
    create: {
      email: "demo@hastkalafab.com",
      name: "Demo Customer",
      passwordHash: customerPassword,
      role: "CUSTOMER",
      phone: "9876543210",
      emailVerified: new Date(),
    },
  });

  await db.user.upsert({
    where: { email: "wholesale@hastkalafab.com" },
    update: {},
    create: {
      email: "wholesale@hastkalafab.com",
      name: "Meera Textiles",
      passwordHash: customerPassword,
      role: "WHOLESALE",
      phone: "9812345670",
      businessName: "Meera Textiles & Handloom",
      gstin: "08AABCU9603R1ZM",
      isApproved: true,
      emailVerified: new Date(),
    },
  });
  console.log("  ✓ demo customer + approved wholesale account");

  await db.address.upsert({
    where: { id: "seed-address-1" },
    update: {},
    create: {
      id: "seed-address-1",
      userId: customer.id,
      fullName: "Demo Customer",
      phone: "9876543210",
      line1: "42, Gopalbari, Near Ajmer Road",
      line2: "Opposite City Hospital",
      city: "Jaipur",
      state: "Rajasthan",
      pincode: "302001",
      type: "HOME",
      isDefault: true,
    },
  });

  return demoPassword;
}

async function main() {
  if (isProduction && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to seed a production database. Set SEED_ALLOW_PRODUCTION=true if you really mean it.",
    );
  }

  console.log("→ Seeding Hastkala Fab…");
  await mkdir(UPLOAD_DIR, { recursive: true });

  // --- Admins ------------------------------------------------------------
  // Only used when an admin account does not exist yet.
  const adminPassword = await bcrypt.hash(readSeedPassword("SEED_ADMIN_PASSWORD"), 12);

  const admins = [
    {
      email: "priyanshu@hastkalafab.com",
      name: "Priyanshu Khandelwal",
      role: "SUPERADMIN",
    },
    { email: "harsh@hastkalafab.com", name: "Harsh Khandelwal", role: "SUPERADMIN" },
  ];

  for (const admin of admins) {
    await db.user.upsert({
      where: { email: admin.email },
      update: { name: admin.name, role: admin.role, isApproved: true },
      create: {
        ...admin,
        passwordHash: adminPassword,
        isApproved: true,
        emailVerified: new Date(),
      },
    });
  }
  console.log(`  ✓ ${admins.length} admin accounts`);

  // --- Demo customers (development only) --------------------------------
  const demoPassword = isProduction ? null : await seedDemoAccounts();

  // --- Categories --------------------------------------------------------
  const categoryIds = new Map<string, string>();

  for (const [index, node] of CATEGORY_TREE.entries()) {
    const imageUrl = await makeImage(node.colourway, node.motif, 800, 600);
    const parent = await db.category.upsert({
      where: { slug: node.slug },
      update: {
        name: node.name,
        description: node.description,
        imageUrl,
        position: index,
        metaTitle: node.metaTitle,
        metaDescription: node.metaDescription,
      },
      create: {
        name: node.name,
        slug: node.slug,
        description: node.description,
        imageUrl,
        position: index,
        metaTitle: node.metaTitle,
        metaDescription: node.metaDescription,
      },
    });
    categoryIds.set(node.slug, parent.id);

    for (const [childIndex, child] of node.children.entries()) {
      const created = await db.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: parent.id, position: childIndex },
        create: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id,
          position: childIndex,
          description: `${child.name} — hand block printed in Sanganer, Jaipur.`,
        },
      });
      categoryIds.set(child.slug, created.id);
    }
  }
  console.log(`  ✓ ${categoryIds.size} categories`);

  // --- Products ----------------------------------------------------------
  for (const seed of PRODUCTS) {
    const categoryId = categoryIds.get(seed.category);
    if (!categoryId) throw new Error(`Unknown category slug: ${seed.category}`);

    const product = await db.product.upsert({
      where: { slug: seed.slug },
      update: {
        title: seed.title,
        description: seed.description,
        shortDesc: seed.shortDesc,
        categoryId,
        priceRetail: seed.priceRetail * 100,
        mrp: seed.mrp * 100,
        priceWholesale: seed.priceWholesale * 100,
        stock: seed.stock,
        isFeatured: seed.featured ?? false,
      },
      create: {
        title: seed.title,
        slug: seed.slug,
        description: seed.description,
        shortDesc: seed.shortDesc,
        categoryId,
        priceRetail: seed.priceRetail * 100,
        mrp: seed.mrp * 100,
        priceWholesale: seed.priceWholesale * 100,
        wholesaleMinQty: seed.category === "fabric" ? 20 : 10,
        sku: seed.sku,
        stock: seed.stock,
        fabric: seed.fabric,
        printType: "Sanganeri Hand Block Print",
        workType: seed.workType,
        occasion: seed.occasion,
        washCare: seed.washCare,
        isFeatured: seed.featured ?? false,
        metaTitle: `${seed.title} | Hastkala Fab`,
        metaDescription: seed.shortDesc,
        keywords: seed.keywords,
        ratingAvg: seed.rating?.[0] ?? 0,
        ratingCount: seed.rating?.[1] ?? 0,
        soldCount: seed.soldCount ?? 0,
      },
    });

    // Images — regenerate only when the product has none, so re-running the
    // seed does not pile up duplicate files.
    const existingImages = await db.productImage.count({
      where: { productId: product.id },
    });
    if (existingImages === 0) {
      const variantMotifs: Motif[] = [
        seed.motif,
        seed.motif === "buti" ? "floral" : "buti",
        "jaal",
      ];
      for (const [i, motif] of variantMotifs.entries()) {
        const url = await makeImage(seed.colourway, motif);
        await db.productImage.create({
          data: {
            productId: product.id,
            url,
            alt: `${seed.title} — view ${i + 1}`,
            position: i,
          },
        });
      }
    }

    // Variants
    const existingVariants = await db.productVariant.count({
      where: { productId: product.id },
    });
    if (existingVariants === 0) {
      if (seed.sizes) {
        for (const size of seed.sizes) {
          await db.productVariant.create({
            data: {
              productId: product.id,
              size,
              sku: `${seed.sku}-${size}`,
              stock: Math.max(2, Math.floor(seed.stock / seed.sizes.length)),
              priceDelta: size === "XXL" ? 10000 : 0,
            },
          });
        }
      } else if (seed.colours) {
        for (const colour of seed.colours) {
          await db.productVariant.create({
            data: {
              productId: product.id,
              color: colour,
              sku: `${seed.sku}-${colour.replace(/\s+/g, "").toUpperCase().slice(0, 6)}`,
              stock: Math.max(2, Math.floor(seed.stock / seed.colours.length)),
            },
          });
        }
      }
    }
  }
  console.log(`  ✓ ${PRODUCTS.length} products with images and variants`);

  // --- FAQs --------------------------------------------------------------
  const existingFaqs = await db.faqItem.count();
  if (existingFaqs === 0) {
    for (const [index, faq] of FAQS.entries()) {
      await db.faqItem.create({ data: { ...faq, position: index } });
    }
  }
  console.log(`  ✓ ${FAQS.length} FAQ entries`);

  // --- Coupons -----------------------------------------------------------
  const coupons = [
    {
      code: "WELCOME10",
      description: "10% off your first order",
      type: "PERCENT",
      value: 10,
      minOrderValue: 99900,
      maxDiscount: 50000,
      perUserLimit: 1,
      appliesTo: "RETAIL",
    },
    {
      code: "FESTIVE20",
      description: "20% off festive collection, max ₹1000",
      type: "PERCENT",
      value: 20,
      minOrderValue: 249900,
      maxDiscount: 100000,
      perUserLimit: 2,
      appliesTo: "RETAIL",
    },
    {
      code: "TRADE15",
      description: "15% off wholesale orders above ₹25,000",
      type: "PERCENT",
      value: 15,
      minOrderValue: 2500000,
      maxDiscount: 500000,
      perUserLimit: 5,
      appliesTo: "WHOLESALE",
    },
    {
      code: "FLAT200",
      description: "₹200 off orders above ₹1,499",
      type: "FLAT",
      value: 20000,
      minOrderValue: 149900,
      perUserLimit: 3,
      appliesTo: "RETAIL",
    },
  ];

  for (const coupon of coupons) {
    await db.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: coupon,
    });
  }
  console.log(`  ✓ ${coupons.length} coupons`);

  console.log("\n✅ Seed complete.\n");
  console.log(`   Admin login   : ${admins.map((a) => a.email).join(", ")}`);
  console.log("                   password = SEED_ADMIN_PASSWORD (new accounts only)");
  if (demoPassword) {
    console.log("   Demo accounts : demo@hastkalafab.com, wholesale@hastkalafab.com");
    console.log(
      process.env.SEED_DEMO_PASSWORD
        ? "                   password = SEED_DEMO_PASSWORD (new accounts only)"
        : `                   password = ${demoPassword} (generated for this run, new accounts only)`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
