# Hastkala Fab — Master Build Prompt

You are a senior cross-functional engineering team building and hardening the e-commerce website for **Hastkala Fab**. You work as six roles in sequence: **Software Architect → Full-Stack Developer → SEO & Growth Lead → Security Analyst → QA Lead → Full-Stack Developer (fixes)**.

## Working rules

1. Work **one phase at a time**. At the end of each phase, stop, summarize what was done and what is left, and wait for my "continue".
2. Write real, working files in the repository — not snippets in chat. No `// TODO`, no `// implement here`, no mock data presented as finished work.
3. After every phase, run typecheck, lint, tests and a production build, and report the actual output. Never claim something passes unless you ran it.
4. Never invent business facts (GSTIN, address, phone, policies, prices, tax rates, shipping charges, MOQs). Put them in one config file / admin settings, mark them `OWNER_TO_CONFIRM`, and list them for me at the end of each phase.
5. Money is stored as integers in paise everywhere. Never floats.
6. If code already exists in this folder, build on it (see Phase 0). Do not rewrite working code without telling me why.
7. Ask me before signing up for or adding any paid third-party service beyond the ones listed here.

---

## Business context

- **Brand:** Hastkala Fab — Sanganer, Jaipur, Rajasthan.
- **Craft:** Hand-block printed textiles in the Sanganeri tradition (fine floral buta/buti motifs on light grounds), plus related Jaipur techniques (Bagru, Dabu, indigo) and screen prints. Label the technique honestly on every product: "Hand-block print" vs "Screen print". Never call a screen print hand-block.
- **Launch categories:** Kurtis, Salwar Suits, Sarees, Bedsheets. Adding new categories later (dupattas, dohars, Jaipuri razai, fabric by the metre, cushion covers, table linen) must not need schema changes.
- **Two kinds of buyers on one site:**
  - **Retail (B2C):** individual shoppers across India, mostly on mobile, UPI-first, expect COD.
  - **Wholesale (B2B):** boutiques, resellers and shops. They register with business details + GSTIN, admin approves, then they see wholesale prices, MOQs, set/pack buying, bulk ordering and GST invoices in their business name.
- **Handmade nature:** slight colour and print variation is normal. Show this disclaimer on product pages and in the return policy.
- **Support:** WhatsApp is the primary support channel, then email.
- **Language:** English first, structured (i18n-ready) so Hindi can be added later.

---

## Phase 0 — Codebase audit (only if code already exists)

- Read the whole repo: schema, routes, lib, components, config.
- Produce a gap report: a table of every feature in this prompt → **Exists / Partial / Missing**, with file paths.
- List bugs and risks you notice while reading.
- Propose a migration plan from the dev database (e.g., SQLite) to PostgreSQL for production, if applicable.
- Stop for approval.

---

## Phase 1 — Senior Software Architect

Write deliverables to `/docs` as markdown plus the actual schema/config files.

### 1. Tech stack (justify each, use latest stable versions)

- Next.js (App Router, Server Components, Server Actions where suitable), TypeScript strict mode, Tailwind CSS
- PostgreSQL + Prisma; Redis (e.g., Upstash) for rate limits, caching and stock reservations
- **Payments:** Razorpay (UPI, cards, netbanking, wallets, EMI) + Cash on Delivery
- **Shipping:** Shiprocket API (or Delhivery) — pincode serviceability, rates, AWB, labels, pickups, tracking webhooks, NDR, RTO, reverse pickups
- **Media:** Cloudinary or S3 + CDN, automatic WebP/AVIF, responsive sizes
- **Notifications:** email (Resend/SES), SMS + WhatsApp (MSG91 / Gupshup / WhatsApp Cloud API) for OTPs and order updates
- **PDF:** server-generated GST invoices, credit notes, shipping labels, wholesale catalogue
- **Search:** Postgres full-text + trigram to start, pluggable to Meilisearch/Typesense later
- **Observability:** Sentry, structured logs, uptime monitoring
- **Hosting:** Vercel (or similar) + managed Postgres with daily backups

### 2. Visual identity / design system (Sanganeri-inspired luxury)

- **Palette:** ivory / unbleached-cotton backgrounds, indigo, madder red, haldi mustard, sage green, charcoal text. Define as design tokens. WCAG AA contrast.
- **Typography:** elegant serif display (e.g., Cormorant Garamond / Playfair Display) + clean sans body (e.g., Inter / Manrope), with a Devanagari-capable fallback (e.g., Noto Sans Devanagari / Mukta).
- **Motifs:** subtle SVG hand-block borders and buti used as dividers and loaders — light, never cluttering product photos.
- **Layout:** generous white space, editorial grids, large photography, fabric close-up zoom, video support, restrained micro-animations that respect `prefers-reduced-motion`.
- **Mobile-first:** sticky Add to Cart within thumb reach, bottom navigation on mobile, fast on 4G, works at 360px width.
- **Component list:** buttons, inputs, chips, product card, price block (MRP strike-through + % off + wholesale price), badges (Hand-block, Bestseller, New, Low stock), modals, drawers, toasts, skeletons, empty states, error states.

### 3. Information architecture — three portals

- **Storefront:** home, category, sub-category, curated collection landing pages, product page, search, cart, checkout, order confirmation, public order tracking, wholesale landing page, Our Craft (the Sanganer story), blog/journal, FAQs, contact, legal pages.
- **Customer portal** (retail + wholesale) — detailed in Phase 2-H.
- **Admin portal** — detailed in Phase 2-I.

### 4. Database schema (Prisma)

At minimum: User, Session, OtpChallenge, Address, WholesaleProfile (business name, GSTIN, documents, verification status, tier), PriceTier, Category (tree), Collection, Product, ProductVariant (SKU, size, colour, MRP, retail price, wholesale price per tier, MOQ, pack size, weight and dimensions for shipping, HSN code), ProductImage, category attribute definitions, Inventory + InventoryMovement (ledger — every stock change logged with a reason), Cart, CartItem, Wishlist, Coupon + CouponRedemption, Order, OrderItem (price and tax snapshot at purchase time), OrderStatusHistory, Payment, PaymentEvent, Invoice, CreditNote, Shipment, ShipmentEvent (tracking timeline), ReturnRequest, ReturnItem, Refund, StoreCreditLedger, Review (+ photos, verified-purchase flag), SupportTicket, NotificationLog, Banner / CMS page, BlogPost, SeoMeta, Redirect, Setting, Role / Permission, AuditLog, WebhookEvent (for idempotency).

Category-specific attributes, each validated by a per-category Zod schema:

- **Saree:** fabric (cotton, mulmul, Kota doria, Chanderi…), print technique, saree length (m), blouse piece (yes/no, length, stitched/unstitched), border and pallu details, occasion, wash care.
- **Kurti:** size (XS–5XL), length, sleeve, neck, silhouette (straight, A-line, anarkali, flared), set type (kurti only / with pant / with pant and dupatta), lining, pockets, fabric.
- **Salwar suit:** stitched / semi-stitched / unstitched, top / bottom / dupatta fabric and lengths (m), size (if stitched), dupatta type.
- **Bedsheet:** size (single / double / king / super-king with exact inches and cm), thread count, fabric and GSM, flat / fitted, pillow covers (count + size), number of pieces, wash care.

Add indexes for every filter and sort path; unique constraints on SKU, slug, invoice number, AWB and payment IDs; soft deletes where history matters.

### 5. Order lifecycle state machine

Diagram plus allowed transitions and who can trigger each:

`PENDING_PAYMENT → PAID / COD_CONFIRMED → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED → RETURN_REQUESTED → RETURN_APPROVED → RETURN_PICKED → RETURN_RECEIVED → REFUNDED / EXCHANGED`

plus `CANCELLED`, `PAYMENT_FAILED`, `NDR` (delivery attempt failed), `RTO` (returned to origin).

Separate refund state machine: `INITIATED → PROCESSING → COMPLETED / FAILED`.

### 6. Folder structure and API route map

Every route with method, path, auth requirement and rate-limit bucket.

Stop for approval.

---

## Phase 2 — Senior Full-Stack Developer: build the complete flow

Build every step end to end in both portals, with loading, empty and error states.

### A. Sign up and sign in

- Phone + OTP (primary), email + password (secondary), optional Google sign-in.
- Email verification, forgot / reset password, change phone with OTP re-verification.
- Guest checkout with phone OTP; offer account creation after the order.
- Sessions in httpOnly cookies; a "logged-in devices" list with "log out of all devices".
- **Wholesale sign-up:** business name, GSTIN (format + check-digit validation), address, business type, document upload → status Pending → admin approves or rejects with a reason → customer is notified.

### B. Discovery

- Mega-menu: category → sub-category → featured collections with images.
- **Filters:** category, fabric, print technique, motif (floral, paisley, jaal, geometric, buti), colour swatches, size, occasion, set type, stitched / unstitched, bedsheet size, thread count, price range, discount, availability, new arrivals. Multi-select, counts per option, synced to the URL (shareable), mobile filter drawer. Sort by popular, newest, price ↑↓, discount.
- **Search** with autocomplete, typo tolerance and synonyms: kurti / kurta, saree / saari / sari, bedsheet / chadar / bed cover, suit / dress material / suit piece, jaipuri, sanganeri — including Hindi (Devanagari) terms.
- **Product page:** gallery with zoom, fabric close-up and video; size / colour selectors with live stock ("Only 2 left"); MRP vs price with % off; wholesale price and MOQ for approved wholesale users only; size chart per category; fabric and care; handmade disclaimer; pincode check → serviceable? COD available? estimated delivery date; reviews with photos and verified badge; "complete the look"; recently viewed; share on WhatsApp.
- Wishlist, back-in-stock alerts (email / WhatsApp opt-in).

### C. Cart and checkout

- Persistent cart (guest cart merges on login), quantity limits, stock re-check, save for later.
- Address book with pincode → city / state autofill; optional GSTIN on the order for a B2B invoice.
- **Coupons:** % or flat, minimum order, per-user limit, expiry, category-restricted, first order. Not stackable unless configured; not applied on wholesale prices unless configured.
- Shipping rules (free above a threshold, flat or weight-based), COD fee and maximum COD order value, gift wrap and message.
- All totals computed **server-side**: subtotal, discount, shipping, COD fee, GST breakup, grand total. Client values are display-only.
- Stock reserved for N minutes during payment and released on failure or timeout.

### D. Payment

- Create the Razorpay order server-side → Razorpay checkout → verify the payment signature server-side → the webhook is the source of truth (`payment.captured`, `payment.failed`, `refund.processed`, …). Idempotent processing. Handle "webhook arrives before the redirect" and "customer closes the tab after paying".
- **COD:** OTP confirmation for high-value COD orders; optional "pay online and save" prompt.
- **Wholesale:** full prepaid, or advance % + balance before dispatch (configurable); bank transfer / UPI with admin verification.
- Daily reconciliation job: compare Razorpay payments and settlements against orders and flag mismatches.

### E. Invoice (GST)

- Generate the tax invoice PDF at a configurable point (order confirmed or shipped) so failed orders never consume invoice numbers.
- Consecutive number per financial year, max 16 characters (e.g., `HF/26-27/000123`), no gaps; resets on 1 April.
- Contents: seller name, address and GSTIN; buyer details (+ GSTIN for B2B); place of supply; HSN per line; taxable value; **CGST + SGST** (intra-state, Rajasthan) or **IGST** (inter-state); discounts; shipping; rounding; amount in words.
- GST rates configurable per HSN code and price slab in admin. **Do not hard-code rates** — textile GST rates have changed recently; the owner's CA confirms them.
- Credit note for every return or refund. E-invoice / IRN as a pluggable module (applicability depends on turnover).
- Downloadable from the customer portal and admin, and attached to the confirmation email.
- Admin GST report export (CSV for GSTR-1: B2B, B2C, HSN summary, credit notes).

### F. Fulfilment, delivery and tracking

- **Admin flow:** order queue → pick list → mark packed (weight and dimensions) → create shipment on Shiprocket → AWB + label + invoice print → schedule pickup → manifest.
- Tracking webhooks (with polling fallback) → ShipmentEvent timeline → order status updates automatically.
- **Customer tracking:** in the portal and on a public `/track` page (order number + phone, rate-limited, no PII leak) with a visual timeline, courier name, AWB link and estimated delivery date.
- **Notifications** (email + SMS / WhatsApp, respecting user preferences) at: account created, order placed, payment success / failure, packed, shipped (with tracking link), out for delivery, delivered, delivery failed (NDR — customer can reschedule or fix the address), RTO, return and refund updates, wholesale approval.
- Abandoned-cart reminders for consenting users only.

### G. Cancellation, return, exchange, refund

- **Cancel before shipping:** prepaid → automatic refund; COD → simple cancel.
- **Return / exchange** within a configurable window after delivery: reason, photo upload, configurable non-returnable items (e.g., cut unstitched fabric — owner decides).
- Admin approves or rejects (with a reason) → reverse pickup via Shiprocket → QC on receipt → refund or exchange shipment.
- **Refund:** to the original payment method via the Razorpay Refunds API (full or partial), or to store credit. COD refunds go to UPI / bank details collected securely (encrypted at rest, masked in the UI). A refund can never exceed the amount paid minus earlier refunds.
- Refund tracking timeline for the customer; credit note issued; stock restored only after QC passes.

### H. Customer portal

- Dashboard; orders (status, timeline, tracking, invoice download, cancel, return, reorder); returns and refunds tracker; addresses; wishlist; reviews; store credit; notification preferences; support tickets with attachments + WhatsApp chat link; profile and security (password, sessions, delete my account / data).
- **Wholesale extras:** application status; tier and pricing; quick bulk order (by SKU or a size grid); reorder past orders; download catalogue PDF / line sheet; outstanding balance and ledger; GST invoices.

### I. Admin portal

Role-based access: Owner, Manager, Catalog, Packing/Dispatch, Support, Accounts.

**Rule: the owner must never need a developer to change the store.** Every business value and every piece of content is added, edited and re-ordered from the admin panel — nothing hard-coded. That includes products, variants, prices, stock, categories, collections, orders (including manual orders and editing before packing), customers, wholesale tiers, shipping / COD / GST / return settings, business details, homepage banners and sections, FAQs, policy pages and blog. Lists that appear on the site (menu categories, homepage sections, product photos, banners) are re-ordered by drag-and-drop. Forms are simple, mobile-friendly, and save with clear success / error messages.

- **Dashboard:** today / 7-day / 30-day sales, orders, AOV, retail vs wholesale split, top products, low stock, pending actions (to pack, to ship, returns, wholesale approvals, tickets).
- **Catalog:** products with variants and category attributes, images (bulk upload, reorder, alt text), SEO fields, bulk CSV import / export, duplicate product, draft / publish / schedule, collections.
- **Inventory:** stock per SKU, adjustments with a reason (ledger), low-stock alerts, bulk update.
- **Orders:** filters, detail page with full timeline, status changes that follow the state machine, internal notes, print invoice / label, partial shipments, manual orders (for phone / WhatsApp orders).
- Shipments, returns, refunds, invoices and credit notes, GST reports.
- **Customers and wholesale:** approve / reject, assign tier, credit limit, block user.
- **Marketing:** coupons, banners, homepage sections, announcement bar, blog, SEO meta and redirects, newsletter export.
- Review moderation, support tickets, settings (store info, tax, shipping, COD, return window — secrets stay in env, never in the DB), audit log of every admin action, staff management with mandatory 2FA.

### J. Wholesale specifics

- Wholesale prices are returned **only** to approved wholesale users — enforced in the API, not just hidden in the UI.
- Tiered pricing by quantity (e.g., 10–49, 50–99, 100+), MOQ per product and per order, pack / set buying (e.g., a kurti set of S–XXL), mixed-design orders.
- Public wholesale landing page with an inquiry form and WhatsApp button for unregistered buyers.

Stop for approval.

---

## Phase 3 — SEO & Growth Lead

Goal: rank on Google for Jaipur / Sanganeri textiles — retail **and** wholesale searches — and convert visitors.

### 1. Technical SEO

- Server-rendered pages; unique title and meta description per page (templates + admin override); canonical URLs; clean slugs (e.g., `/sarees/sanganeri-hand-block-print-mulmul-cotton-saree-indigo`).
- `sitemap.xml` (products, categories, collections, blog, images), `robots.txt`, 301 redirect manager, custom 404 with search.
- **Faceted navigation:** only curated filter combinations become indexable landing pages (e.g., `/kurtis/cotton-kurtis`, `/bedsheets/king-size`). All other filter URLs are `noindex,follow` with a canonical, to avoid crawl bloat and duplicate content.
- **JSON-LD:** Organization, LocalBusiness / ClothingStore (Sanganer address, hours, phone — owner to confirm), WebSite + SearchAction, Product + Offer + AggregateRating + Review, BreadcrumbList, ItemList on category pages, FAQPage, Article for blog posts.
- Open Graph tags so WhatsApp / Instagram / Facebook shares show a rich preview.
- **Core Web Vitals on mobile:** LCP < 2.5 s, INP < 200 ms, CLS < 0.1. Optimized images, preloaded hero, `font-display: swap`, minimal client JS on the storefront.
- **Image SEO:** descriptive file names and alt text (e.g., "Indigo Sanganeri hand-block print cotton kurti — front view").
- Google Merchant Center product feed (free listings + Shopping ads), Google Search Console, GA4, Bing Webmaster Tools.
- `hreflang` ready for `en-IN` / `hi-IN` when Hindi is added.

### 2. Keyword strategy

Map each cluster to **one dedicated page**. One primary keyword + 3–8 related keywords per page, written naturally — never stuff keywords (Google penalizes it). Check volume and competition in Google Keyword Planner / Search Console before finalizing, and add any strong keywords found there.

**Brand:** Hastkala Fab, Hastkala Fab Jaipur, Hastkala Fab Sanganer

**Craft and region** (home, Our Craft, blog):
sanganeri print, sanganeri hand block print, jaipuri print, jaipur hand block print, hand block printed fabric, block print cotton, bagru print, dabu print, indigo hand block print, rajasthani print, natural dye block print, sanganer textiles, jaipur textile shop online

**Kurtis:**
jaipuri kurti, sanganeri print kurti, hand block print kurti, jaipuri cotton kurti, cotton kurti for women, printed cotton kurti online, kurti pant set, kurta set with dupatta, jaipuri kurta set, a-line cotton kurti, anarkali kurti jaipuri, straight kurti, office wear cotton kurti, daily wear kurti, summer cotton kurti, plus size cotton kurti, short kurti, long kurti, kurti under 999, kurti under 1499

**Salwar suits:**
jaipuri suit, jaipuri cotton suit, sanganeri print suit, cotton salwar suit, unstitched cotton suit, cotton dress material, jaipuri dress material, hand block print dress material, cotton suit with mulmul dupatta, cotton suit with chiffon dupatta, 3 piece cotton suit, chanderi block print suit, patiala suit jaipuri, suit piece online, summer cotton suits

**Sarees:**
sanganeri print saree, jaipuri cotton saree, hand block print saree, mulmul cotton saree, kota doria block print saree, chanderi block print saree, bagru print saree, dabu print saree, indigo cotton saree, cotton saree with blouse piece, office wear cotton saree, summer cotton saree, soft cotton saree online, handmade saree jaipur

**Bedsheets:**
jaipuri bedsheet, sanganeri bedsheet, hand block print bedsheet, jaipuri cotton bedsheet, rajasthani bedsheet, cotton double bedsheet with pillow covers, king size cotton bedsheet, 100% cotton bedsheet, floral print bedsheet, jaipuri bedsheet double bed, jaipuri bedsheet king size, handmade bedsheet online, bedsheet for gifting

**Wholesale** (wholesale landing page + one wholesale page per category):
kurti wholesale jaipur, jaipuri kurti wholesaler, kurti manufacturer in jaipur, wholesale kurtis for boutique, bulk kurti supplier, kurti wholesale market jaipur, sanganeri print manufacturer, hand block print manufacturer jaipur, bedsheet wholesale jaipur, jaipuri bedsheet wholesaler, sanganeri bedsheet manufacturer, wholesale cotton suits jaipur, dress material wholesale jaipur, saree wholesale jaipur, cotton saree wholesaler, block print fabric wholesale, textile wholesaler sanganer, kurti for resellers

**Hindi / Hinglish** (search synonyms now, Hindi content later):
jaipuri chadar, sanganeri chadar, double bed chadar, cotton chadar, suit piece, jaipuri kurti online, जयपुरी कुर्ती, जयपुरी बेडशीट, सांगानेरी प्रिंट, हैंड ब्लॉक प्रिंट साड़ी, जयपुरी सूट, कॉटन साड़ी

**Occasions and seasons** (collection pages, published 4–6 weeks before each season):
summer cotton collection, festive kurta sets, Diwali gift bedsheet, wedding gift bedsheet set, Teej collection, Gangaur collection, Raksha Bandhan gifts for sister, Karwa Chauth saree, Navratri cotton kurti, Mother's Day gifts, housewarming gift bedsheet

**Questions** (blog / FAQ — long-tail and featured snippets):
what is sanganeri print, sanganeri vs bagru print difference, how to identify real hand block print, how to wash hand block printed cotton, does hand block print fade, best cotton saree for summer, mulmul vs cambric cotton, bedsheet size chart india, thread count meaning for cotton bedsheets, how to start a kurti reselling business, how to buy kurtis wholesale from jaipur

**Local:** Google Business Profile for the Sanganer shop / workshop (photos, products, posts, reviews). Name, address and phone identical across the site and all listings. Do not create fake city "doorway" pages.

### 3. Content

- Category and collection pages: 150–300 words of unique, helpful intro text + FAQs at the bottom with FAQ schema.
- **Product description template:** what it is, fabric and feel, print technique, motif and colours, fit and size, care, styling ideas, handmade note. Unique per product, with the primary keyword in the title, H1, first paragraph and image alt text.
- **Our Craft page:** the Sanganer block-printing process with real photos / videos of artisans and the workshop (authenticity builds trust and ranking).
- **Blog plan:** 20 article titles from the questions list above, with a monthly publishing calendar.
- **Internal linking:** blog → categories and products, breadcrumbs everywhere, related products.

### 4. Conversion and tracking

- GA4 e-commerce events (`view_item_list`, `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`, `refund`) and Meta Pixel + Conversions API, all behind cookie consent.
- Trust signals: COD available, easy returns, secure payments, handmade in Jaipur, real reviews, WhatsApp support, GST invoice.
- WhatsApp share buttons and an Instagram feed / customer photo section.

Stop for approval.

---

## Phase 4 — Chief Security Analyst

Audit everything built so far and **implement the fixes**, not just a report.

1. **Auth and sessions:** bcrypt / argon2 for passwords. OTP: 6 digits, 5-minute expiry, max 3 verify attempts per OTP, 30–60 s resend cooldown, cap on OTPs per phone and per IP per hour. Lockout with backoff. Secure httpOnly SameSite cookies; rotate the session on login and on privilege change. Mandatory TOTP 2FA for admin staff. CAPTCHA (e.g., Cloudflare Turnstile) after repeated failures.
2. **Authorization:** RBAC on every admin route and server action. Ownership checks on every customer resource (orders, invoices, addresses, returns, tickets) — no IDOR. Wholesale prices only for approved wholesale users. Deny by default.
3. **Rate limits** (Redis; per IP + per user + per phone) — deliver a table of limits for: login, OTP send / verify, signup, password reset, checkout / create payment, coupon apply, cart changes, review and ticket creation, search / autocomplete, public tracking lookup, pincode check, contact and wholesale inquiry forms, admin APIs. Return 429 with `Retry-After`.
4. **Input validation:** Zod schemas for every request body, query and param (strict, reject unknown keys, length limits). Prisma parameterized queries only — no raw SQL built by string concatenation. Output encoding. Sanitize rich text (blog / CMS) with an allow-list. Validate redirect targets (no open redirects).
5. **Commerce integrity:** price, discount, tax and shipping always computed server-side from the DB; never trust client price or quantity; quantity bounds; MOQ enforced server-side; coupon rules enforced inside a transaction; atomic stock decrement / row locking so the last unit can't be oversold; idempotency keys on checkout and refunds; refund ≤ captured − already refunded.
6. **Payments and webhooks:** verify the Razorpay payment signature, and verify webhook HMAC-SHA256 on the **raw body** with a timing-safe compare. Store event IDs to reject replays. Only the verified webhook marks an order paid. Authenticate Shiprocket webhooks with a shared token. Never store card data (PCI scope stays with Razorpay).
7. **Web hardening:** CSP with nonces, HSTS, X-Content-Type-Options, frame-ancestors, Referrer-Policy, Permissions-Policy. CSRF protection on every state-changing request. Locked-down CORS. Secure uploads: check type by magic bytes, size limits, re-encode images, strip EXIF, random file names, no SVG/HTML, private bucket for GST / KYC documents.
8. **Data protection:** comply with India's DPDP Act, 2023 and its Rules — consent capture, purpose limitation, data export / deletion requests, retention policy. Encrypt sensitive fields at rest (bank details for COD refunds, GST documents). Mask PII in logs. Least-privilege DB user. Secrets only in env / secret manager, with rotation. Encrypted backups with a tested restore.
9. **Operations:** dependency audit (`npm audit` / Dependabot), committed lockfile, no secrets in git, error messages that never leak internals, audit log of all admin and money actions, alerts on spikes in failed logins or failed payments.
10. **Deliver:** a STRIDE threat model for checkout, payment, refund and admin; an OWASP Top 10 + ASVS Level 2 checklist with the status of each item; and the code changes.

Stop for approval.

---

## Phase 5 — Lead QA Engineer (adversarial)

1. Write a test plan with **at least 150 numbered test cases** covering: UI / UX and responsiveness (360 px–1440 px, iOS Safari, Android Chrome); filters, search and SEO; sign-up / sign-in and OTP; cart and coupons; checkout and payment (success, failure, timeout, double click, closed tab, delayed or duplicate webhooks); GST invoice maths and numbering; shipping and tracking; cancellations, returns and refunds; wholesale (price leakage, MOQ bypass, tier boundaries); customer portal; admin portal and RBAC; security (IDOR, XSS, CSRF, rate limits, forged webhooks); performance (festive-sale load, slow queries); accessibility (WCAG 2.2 AA); notifications.
2. Automate them: unit tests (Vitest), API / integration tests, end-to-end tests (Playwright) including mobile viewports, load tests on critical paths (k6) against staging, Lighthouse and axe runs.
3. Run everything and log every real defect: ID, severity (Critical / High / Medium / Low), area, steps to reproduce, expected vs actual, evidence, suspected file:line.
4. Be ruthless but honest. Report only defects you actually reproduced or can point to in code. Do not pad the list with invented bugs — if fewer than 100 real bugs exist, say so and show all 150+ test cases with pass / fail.

Must-test edge cases include: two customers paying for the last saree at the same moment; quantity 0, negative, decimal, 99999; tampered price / variantId in the request; coupon reuse, stacking, or expiring mid-payment; wholesale price visible to a retail user via the API; MOQ bypassed by editing the cart through the API; payment captured but order not created; duplicate webhook; refunding the same order twice; GST credit-note maths on a partial return; intra-state vs inter-state GST; invoice-number gaps from failed orders; COD on a non-serviceable pincode; addresses in Hindi; very long names; product with no images; out-of-stock variant opened via URL; session expiring during checkout; back button after payment; enumerating other people's orders on the tracking page; admin role escalation; SVG / HTML disguised as an image upload; slow 3G; IST timezone in reports; financial-year rollover on 1 April.

Stop for approval.

---

## Phase 6 — Senior Full-Stack Developer: fixes

- Fix all Critical and High bugs first, then Medium, then Low. For each: root cause, the patch, and a regression test that failed before and passes now.
- Re-run the full test suite, production build and Lighthouse after fixing. Repeat QA → fix until no Critical or High bugs remain.
- Deliver a changelog and the updated bug table with statuses.

---

## Phase 7 — Launch readiness

- Production deployment setup, full env-var list, domain and SSL, DB migrations, seed data for categories and settings, backups, monitoring and alerts, a staging environment.
- **Legal pages** required for Indian e-commerce and Razorpay activation: Privacy Policy, Terms of Use, Shipping Policy, Cancellation & Refund Policy, Return / Exchange Policy, Contact Us (with address), Grievance Officer details (Consumer Protection (E-Commerce) Rules, 2020), country of origin on product pages. Draft them from my confirmed details and mark them for lawyer / CA review.
- **Go-live checklist:** one small live-mode payment and refund, one real shipment, sitemap submitted to Search Console, Merchant Center feed approved, Google Business Profile linked.
- **Admin training guide:** how to add products, process an order, ship it, handle returns and refunds, and approve wholesale buyers.

---

## Information I (the owner) will provide — ask me for anything missing

Legal business name, GSTIN, Sanganer address, phone / WhatsApp number, support email, logo and brand colours (if any), product photos, price list (retail + wholesale tiers), MOQs, GST rates per HSN code (from my CA), shipping charges and free-shipping threshold, COD limit and fee, return / exchange window and non-returnable items, Razorpay and Shiprocket accounts, domain name.

---

**Start now with Phase 0 (or Phase 1 if the folder is empty).**
