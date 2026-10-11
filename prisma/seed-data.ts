/**
 * Demo catalogue for development: the categories, products and FAQs from the
 * original build. Products here are SAMPLES — the owner replaces them with the
 * real catalogue in Admin → Products. They carry no ratings or sales counts:
 * invented social proof would be misleading on a live shop.
 */
import { PALETTE, type Rgb } from "./png.js";

export type ColourWay = { ground: Rgb; primary: Rgb; secondary: Rgb; accent: Rgb };

export const COLOURWAYS: Record<string, ColourWay> = {
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

export type Motif = "buti" | "floral" | "jaal" | "leaf" | "stripe";

export const CATEGORY_TREE = [
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
    name: "Salwar Suits",
    slug: "salwar-suits",
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

export type ProductSeed = {
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
};

// Prices in rupees here; converted to paise on insert.
export const PRODUCTS: ProductSeed[] = [
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
  },
];

export const FAQS = [
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
