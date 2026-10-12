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

/**
 * Starting FAQs and pages. Text in {{braces}} is filled from Settings when
 * shown (see src/lib/content-text.ts), so a policy can't drift from what
 * checkout actually does. The owner reviews and edits all of it in
 * Admin → Content before launch.
 */
export const FAQS = [
  {
    category: "Orders",
    question: "How long does delivery take?",
    answer: "{{dispatchText}}.\nDelivery then takes {{deliveryText}}.\nFollow your order in [My orders](/account/orders) or on the [Track order](/track) page.",
  },
  {
    category: "Orders",
    question: "Can I change or cancel my order?",
    answer:
      "You can cancel an order from [My orders](/account/orders) until it is packed. If you paid online, the refund starts automatically. To change an order, cancel it and place a new one, or [contact us](/contact) quickly.",
  },
  {
    category: "Orders",
    question: "Do you offer Cash on Delivery?",
    answer: "{{codAvailability}}\nWholesale orders have their own payment options, shown at checkout.",
  },
  {
    category: "Products",
    question: "Why does the print look slightly different from the photo?",
    answer:
      "Because it is printed by hand. Each piece is pressed with carved wooden blocks, one impression at a time, so motif placement and colour depth vary a little from piece to piece. That is the mark of real hand-block printing, not a fault.",
  },
  {
    category: "Products",
    question: "How should I wash hand-block prints?",
    answer:
      "Hand-block prints can release a little colour in the first washes. Wash them separately in cold water the first few times, don't soak them, and dry them in the shade.",
  },
  {
    category: "Products",
    question: "How do I choose the right size?",
    answer:
      "Where a product has a size chart, you'll find it on the product page. Compare it with a garment you own that fits you well. If you're between two sizes, choose the larger one.",
  },
  {
    category: "Returns",
    question: "What is your return policy?",
    answer:
      "You can ask for a return within {{returnDays}} days of delivery.\n{{returnConditions}}\nStart from the [Help Centre](/account/support), choosing the order. Read the full [returns policy](/returns-policy).",
  },
  {
    category: "Returns",
    question: "What if my item arrives damaged or wrong?",
    answer:
      "Tell us through the [Help Centre](/account/support) as soon as you can, with photos, and we'll replace it or refund it in full.",
  },
  {
    category: "Wholesale",
    question: "How do I open a wholesale account?",
    answer:
      "[Apply here](/account/wholesale) with your business details and GSTIN. We review every application and switch on trade prices once your account is approved. See [Wholesale](/wholesale) for how it works.",
  },
  {
    category: "Wholesale",
    question: "Is there a minimum order quantity?",
    answer:
      "Each design shows its minimum quantity once your account is approved. Sizes and colours of the same design count together.",
  },
  {
    category: "Payments",
    question: "What payment methods do you accept?",
    answer:
      "UPI, debit and credit cards, and net banking, processed securely by Razorpay — we never see or store your card details.\n{{codAvailability}}",
  },
  {
    category: "Payments",
    question: "Are prices inclusive of GST?",
    answer: "Retail prices include GST.\n{{wholesaleGst}}",
  },
];

type StartingPage = {
  slug: string;
  title: string;
  type: "POLICY" | "INFO";
  metaDescription: string;
  body: string;
};

export const PAGES: StartingPage[] = [
  {
    slug: "about",
    title: "Our story",
    type: "INFO",
    metaDescription:
      "Hastkala Fab brings hand-block printed kurtis, suits, sarees and cotton bedsheets from Sanganer, Jaipur — for you and for retailers across India.",
    body: `{{storeName}} brings hand-block printed kurtis, salwar suits, sarees and cotton bedsheets from Sanganer, Jaipur, to you.

## The craft
Sanganer, on the southern edge of Jaipur, has printed cloth by hand for generations. Each design is carved into wooden blocks. A printer dips a block in colour and presses it onto the fabric by hand, one impression at a time, lining each one up by eye. A design with several colours needs a block for every colour, so each piece passes through many hands before it is finished.

That is why no two pieces are exactly alike. A slight shift in a motif, a little more or less colour — these are the marks of hand printing, not faults.

## What we make
- Kurtis
- Salwar suits
- Sarees
- Cotton bedsheets

## Retail and wholesale
Shop single pieces here, delivered across India. Boutiques, retailers and resellers can [apply for a wholesale account](/wholesale) for trade prices and GST invoices.

## Talk to us
Questions about a print, a size or an order? [Contact us](/contact) — we're happy to help.`,
  },
  {
    slug: "contact",
    title: "Contact us",
    type: "INFO",
    metaDescription: "Contact Hastkala Fab, Sanganer, Jaipur — about an order, a print, a size or wholesale buying.",
    body: `We'd love to hear from you — about a print, a size, an order, or buying for your shop.

**About an order?** Sign in and raise it from the [Help Centre](/account/support), choosing the order, so we can see its details straight away. You can also [track an order](/track) without signing in.

**Buying for a shop?** Send a [wholesale enquiry](/wholesale#enquiry) and we'll call you back.`,
  },
  {
    slug: "shipping-policy",
    title: "Shipping & Delivery",
    type: "POLICY",
    metaDescription: "Shipping charges, dispatch and delivery times, Cash on Delivery and order tracking at Hastkala Fab.",
    body: `We ship across India from Jaipur, Rajasthan.

## Dispatch and delivery
- {{dispatchText}}.
- Delivery then takes {{deliveryText}}.
- These are our courier partners' usual times. Remote areas, festivals and bad weather can add a few days.

## Shipping charges
- {{shippingCharges}}
- The shipping charge is shown at checkout before you pay.
- {{codAvailability}}
- {{wholesaleShipping}}

## Tracking your order
Follow your order in [My orders](/account/orders), or on the [Track order](/track) page with your order number and the email or mobile number you ordered with. Once it ships, the tracking details appear there.

## If a delivery fails
If the courier can't deliver after their attempts, the parcel comes back to us and we'll contact you to send it again. A second dispatch may be charged. If you no longer want a prepaid order, we refund the order value once the parcel is back with us.

## Damaged or wrong parcel
If your parcel arrives damaged or with the wrong item, tell us through the [Help Centre](/account/support) as soon as you can, with photos, and we'll put it right. See our [returns policy](/returns-policy).

Questions? [Contact us](/contact).`,
  },
  {
    slug: "returns-policy",
    title: "Returns, Exchanges & Refunds",
    type: "POLICY",
    metaDescription: "How returns, exchanges, cancellations and refunds work at Hastkala Fab.",
    body: `We want you to love what you ordered. If something isn't right, here is how returns work.

## Returns and exchanges
- You can ask for a return within {{returnDays}} days of delivery.
- {{returnConditions}}
- {{exchangeNote}}
- Each piece is printed by hand, so small variations in print and colour are part of the craft, not a fault.

## How to return
- Sign in, open the [Help Centre](/account/support) and raise a request for the order, telling us which item and why.
- We'll confirm the return and how to send the item back.
- Once it reaches us and we've checked it, we send your refund or exchange.

## Refunds
- Online payments are refunded to the original payment method. Banks usually show the money within 5–7 working days of the refund.
- Cash on Delivery orders are refunded to a bank account or UPI ID you give us.
- {{returnShippingDeduction}} is kept from refunds of returns that aren't due to a fault on our side, to cover return shipping.

## Damaged, faulty or wrong items
If an item arrives damaged, faulty or isn't what you ordered, tell us through the [Help Centre](/account/support) as soon as you can, with photos. We'll replace it or refund it in full.

## Cancelling an order
You can cancel an order from [My orders](/account/orders) until it is packed. If you paid online, the refund starts automatically.

## Wholesale orders
Returns on wholesale orders follow the terms agreed with you. [Contact us](/contact) if something is wrong with a delivery.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    type: "POLICY",
    metaDescription: "What personal data Hastkala Fab collects, why, who it is shared with, and your rights.",
    body: `This policy explains what personal data {{storeName}} collects, why, and the choices you have. It applies to this website and to orders placed with us.

Business: {{legalName}}
Address: {{address}}

## What we collect
- **Account details:** your name, email address, mobile number and password (stored only as a secure hash — nobody can read it).
- **Order details:** delivery and billing addresses, what you bought, and the status of your orders and payments.
- **Wholesale details:** if you apply for a wholesale account — business name, GSTIN, address and the documents you upload.
- **Messages:** what you send us through the Help Centre, enquiries and reviews.
- **Security records:** a scrambled (hashed) form of your IP address and your browser type, kept to protect accounts and stop abuse.

## Payments
Online payments are handled by our payment partner, Razorpay. You enter card, UPI and bank details with them; we never see or store your full card number.

## Why we use it
- To take, deliver and support your orders, and to issue invoices.
- To run your account and, for wholesale buyers, to review and manage the trade account.
- To keep the website secure and prevent fraud.
- To send new prints and offers by email — only if you agreed, and you can stop at any time.
- To meet our legal duties, such as GST and accounting records.

## Who we share it with
Only what each needs to do its job:
- Courier partners — your name, address and mobile number, to deliver your parcel.
- Razorpay — to process payments and refunds.
- The services that host this website and send our order emails and messages.
- Government authorities, when the law requires it.

We do not sell your personal data.

## Cookies
We use only the cookies this website needs to work: one keeps you signed in, one remembers your bag, and one protects forms against misuse. We don't use advertising or tracking cookies.

## How long we keep it
Account details are kept while your account is open. Orders and invoices are kept for as long as tax and accounting laws require. Security records are kept only for a short time.

## Your rights
You can ask to see, correct or delete your personal data, or withdraw a consent you gave. Some records, such as invoices, must be kept by law even after you close your account.
Write to us at {{email}}.

## Grievance officer
- Name: {{grievanceOfficer}}
- Email: {{grievanceEmail}}
- Phone: {{grievancePhone}}

We acknowledge complaints within 48 hours and aim to resolve them within one month. If you are not satisfied with our answer, you can approach the Data Protection Board of India.

## Changes
When we change this policy, we update this page and its date.`,
  },
  {
    slug: "terms",
    title: "Terms & Conditions",
    type: "POLICY",
    metaDescription: "The terms for using the Hastkala Fab website and buying from us, retail and wholesale.",
    body: `These terms apply when you use this website or buy from {{storeName}}. By placing an order you agree to them.

## About us
This website is run by {{legalName}}.
Address: {{address}}
GSTIN: {{gstin}}
Email: {{email}}

## Your account
Keep your password private; you are responsible for orders placed from your account. Tell us at once if you think someone else has used it. We may suspend accounts that are misused.

## Products and prices
- Our products are printed by hand, so colours and motifs vary a little from piece to piece and from the photos.
- Prices are in Indian rupees. Retail prices include GST. {{wholesaleGst}}
- We work to keep every price and description right. If we find a mistake in the price of something you ordered, we'll contact you before dispatch; if you don't want to go ahead, we cancel the order and refund any payment in full.

## Orders and payment
- An online order is accepted once its payment is received; a Cash on Delivery order once it is placed.
- We may decline or cancel an order — for example if an item has run out or a payment looks fraudulent. Anything you paid is refunded in full.
- Online payments are processed by Razorpay.

## Delivery, returns and refunds
See our [shipping policy](/shipping-policy) and [returns policy](/returns-policy).

## Wholesale accounts
Wholesale prices are for businesses we approve, and we may decline or withdraw an approval. Payment terms, such as advance or credit, are as agreed with you and shown in your account. Returns on wholesale orders follow the terms agreed with you.

## Reviews and our content
Reviews must be your own honest experience of a product you bought. We may remove reviews that are abusive, off-topic or misleading. The designs, photos and text on this website belong to us; please don't copy them without permission.

## Liability
To the extent the law allows, our liability for an order is limited to the amount you paid for it. Nothing in these terms takes away your rights as a consumer under Indian law.

## Law and disputes
These terms are governed by the laws of India, and the courts at Jaipur, Rajasthan have jurisdiction. Please [contact us](/contact) first — most problems are quickly sorted out.

## Changes
We may update these terms. The version on this page when you place an order applies to that order.`,
  },
];
