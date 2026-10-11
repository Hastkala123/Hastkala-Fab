# Hastkala Fab — Phase 0 Codebase Audit

**Date:** 11 October 2026
**Scope:** every file in `src/`, `prisma/`, and the project config (106 source files, ~18,400 lines), checked against `HASTKALA_FAB_MASTER_PROMPT.md`.
**What changed:** nothing. This is a read-only audit. No code was modified.

---

## 1. Summary for the owner

**The foundation is good, so we don't need to start over.** The code that exists is careful in the places that matter most:
- Prices are stored in paise (no rounding errors).
- Order totals are recalculated on the server, so customers can't change prices from their browser.
- Customers can't see other people's orders or addresses.
- Forms are protected against cross-site attacks.
- Uploaded images are checked properly.
- Admin actions are logged.

**But it is not ready to take real orders.** The biggest gaps:

1. **Online payment doesn't exist.** If a customer picks UPI (the default), the order is saved as "payment pending" and no one is asked to pay. The stock stays locked forever.
2. **GST is wrong.** It's added *on top of* the shown price, even though the page says "inclusive of all taxes". It uses an old tax rule and doesn't split CGST/SGST/IGST. There are no invoices at all.
3. **The Next.js version installed has critical security holes**, including remote code execution through the image optimizer, which this site uses. Fixing it is a one-command upgrade.
4. **13 links lead to "page not found"**, including Terms, Privacy, Returns, Shipping, Contact, Track Order and Wholesale. Indian e-commerce rules require the legal pages, and Razorpay won't activate an account without them.
5. **Product photos uploaded from the admin panel won't show on the live site.** They are saved in a way that only works on your laptop.
6. **There's no shipping, tracking, returns, refunds, or customer notifications** (email, SMS or WhatsApp).
7. **Your project folder is on the iCloud-synced Desktop.** iCloud has moved 15,744 files off your Mac, so builds and checks hang. The database file being in iCloud also risks corruption.

Section 4 lists **55 specific bugs and risks**: 7 critical, 13 high, 22 medium and 13 low.

---

## 2. Environment and tooling findings

| Check | Result |
|---|---|
| Next.js version | 16.3.2 — `npm audit` reports **1 critical + 2 high** vulnerabilities (Next.js, sharp, source-map-js), including *"Unauthenticated Remote Code Execution in Image Optimization API when AVIF files are used"*. `next.config.ts` enables AVIF. **Fix: `npm audit fix` / upgrade Next.js.** |
| Typecheck (`tsc --noEmit`) | **Could not complete** — hung for 6+ minutes at ~0% CPU because iCloud had offloaded `node_modules/typescript/lib/typescript.js` (and 15,743 other files, which are now cloud-only placeholders). |
| Lint (`npm run lint`) | **Broken** — the script calls `next lint`, which Next.js 16 removed. ESLint is not installed. |
| Tests (`npm test`) | **None** — the script is the npm placeholder (`echo "Error: no test specified"`). No Vitest, Jest or Playwright. |
| Node.js | v26.0.0 |
| Database | SQLite (`prisma/dev.db`) holds **seed data only**: 4 users, 12 products, 41 variants, 15 categories, 4 coupons, 0 orders. No real customer data, so moving to PostgreSQL is simple. |
| Secrets | `.env` is in `.gitignore` ✔. `.env.example` has placeholders ✔. The folder is **not a git repository**, so there is no history or backup of the code. |

---

## 3. Gap report — master prompt vs. current code

Legend: ✅ Exists · 🟡 Partial · ❌ Missing

### Sign-up and sign-in
| Feature | Status | Where / notes |
|---|---|---|
| Email + password sign-up / login / logout | ✅ | `src/app/api/auth/*`, `src/lib/auth.ts` |
| DB-backed revocable sessions | ✅ | `Session` model, `getCurrentUser()` |
| "Logged-in devices" list | 🟡 | `account/security/page.tsx` — lists devices, but there's no way to sign out other devices |
| Phone + OTP login | ❌ | — |
| Google sign-in | ❌ | — |
| Email verification | ❌ | `emailVerified` column exists but is never set (except by the seed) |
| Forgot / reset password | ❌ | — |
| Guest checkout | ❌ | `/api/checkout` requires login |
| Wholesale application → admin approval | 🟡 | Signup flag + Approve button in `admin/customers/CustomerRoleControl.tsx`. No GSTIN requirement, no documents, no rejection reason, no notification |
| Staff roles (packer, accounts, support…) | ❌ | Only `ADMIN` / `SUPERADMIN` |
| Admin 2FA | ❌ | — |

### Catalogue and discovery
| Feature | Status | Where / notes |
|---|---|---|
| Category tree (1 level) | ✅ | `Category` model, `admin/categories` |
| Product CRUD with variants and images | ✅ | `components/admin/ProductForm.tsx`, `api/admin/products` |
| Category-specific attributes (saree length, blouse piece, bedsheet size, thread count, pillow covers, stitched/unstitched…) | ❌ | Only generic `fabric`, `printType`, `workType`, `occasion`, `washCare` |
| HSN code, weight, dimensions (for GST and shipping) | ❌ | — |
| Header category menu | 🟡 | `HeaderClient.tsx` — category dropdown with sub-categories; "Wholesale" link is a 404 |
| Filters | 🟡 | `FilterSidebar.tsx` — single fabric, single occasion, price. No colour, size, print technique, motif, set type, bedsheet size |
| Search | 🟡 | `lib/products.ts` — plain `LIKE`; no typo tolerance, synonyms (chadar → bedsheet) or Hindi |
| Product page (gallery, variants, stock, reviews, wishlist) | ✅ | `product/[slug]/page.tsx`, `BuyBox.tsx` |
| Size chart | ❌ | — |
| Pincode check / delivery estimate / COD availability | ❌ | — |
| Reviews with moderation | ✅ | No photo reviews; no edit |
| Wishlist | ✅ | — |
| Back-in-stock alerts | ❌ | — |
| Collections / curated landing pages | ❌ | — |
| Bulk CSV import / export | ❌ | — |

### Cart, checkout, payment
| Feature | Status | Where / notes |
|---|---|---|
| Cart (guest cart merged on login) | ✅ | `lib/cart.ts`, `api/cart` |
| Server-side totals | ✅ | Tax logic is wrong (see C4) |
| Coupons | ✅ | Limits can be bypassed (see H3) |
| Address book | ✅ | No pincode → city/state autofill |
| Stock reservation with timeout | ❌ | Stock is held forever by unpaid orders (C3) |
| Configurable shipping / COD rules | 🟡 | Hard-coded in `lib/money.ts` and duplicated in `CheckoutView.tsx` |
| Razorpay (UPI, cards, netbanking) | ❌ | UI offers these, but there's no gateway (C2) |
| Payment webhooks / reconciliation | ❌ | — |
| Wholesale advance / bank transfer | ❌ | — |

### Invoice and GST
| Feature | Status |
|---|---|
| Invoice model, numbering per financial year, PDF | ❌ |
| HSN per line, CGST + SGST vs IGST, place of supply | ❌ |
| Buyer GSTIN on B2B invoice | ❌ (stored on user only, not on the order) |
| Credit notes | ❌ |
| GSTR-1 export | ❌ |

### Fulfilment, delivery, tracking
| Feature | Status | Where / notes |
|---|---|---|
| Order status flow | 🟡 | 7 states, manual admin changes, transitions enforced (`api/admin/orders`) |
| Tracking number / courier | 🟡 | Typed in by hand; no link, no live updates |
| Courier integration (Shiprocket / Delhivery) | ❌ | — |
| Public `/track-order` page | ❌ | Linked from the header, gives a 404 |
| Email / SMS / WhatsApp notifications | ❌ | None at all, but checkout promises "A GST invoice will be emailed to you" |

### Cancellation, returns, refunds
| Feature | Status | Where / notes |
|---|---|---|
| Customer cancel before packing | ✅ | `api/orders/cancel` — has a race bug (H2) |
| Return / exchange requests | ❌ | "7-day returns" is advertised on every product page |
| Refunds (gateway or store credit) | ❌ | Status changes to "REFUNDED" without any money moving (H8) |

### Customer portal
| Feature | Status |
|---|---|
| Dashboard, orders, order detail with progress stepper, addresses, wishlist, profile, security, support tickets | ✅ |
| Invoice download, returns, refunds tracker, store credit, notification preferences, delete my account | ❌ |
| Wholesale extras (tiers, bulk order grid, reorder, catalogue PDF, ledger) | ❌ |

### Admin portal
| Feature | Status | Where / notes |
|---|---|---|
| Dashboard, products, categories, coupons, orders, customers, reviews, ticket list | ✅ | `src/app/admin/*` |
| Ticket detail page | ❌ | `admin/tickets/[ticketNumber]/` folder is **empty**, so links give a 404 |
| Audit log viewer | ❌ | `admin/audit/` folder is **empty** (the `AuditLog` table exists) |
| Inventory ledger / stock adjustments | ❌ | — |
| Shipments, returns, refunds, invoices, GST reports | ❌ | — |
| CMS (banners, homepage, blog), SEO redirects, settings | ❌ | — |

### SEO
| Feature | Status | Where / notes |
|---|---|---|
| Per-page title / description / canonical | ✅ | Home, products, category, product pages |
| Product JSON-LD | ✅ | `product/[slug]/page.tsx` — has an escaping issue (M2) |
| `sitemap.xml`, `robots.txt` | ❌ | Linked from the footer, but don't exist |
| Organization / LocalBusiness / Breadcrumb / FAQ JSON-LD | ❌ | — |
| Curated keyword landing pages, blog, "Our Craft" page | ❌ | — |
| Google Merchant Center feed, GA4, Meta Pixel | ❌ | — |

### Security baseline (already good)
CSRF double-submit + Origin check ✅ · bcrypt (12 rounds) ✅ · revocable sessions ✅ · roles re-read from DB on every request ✅ · Zod validation on every API ✅ · JSON body size cap ✅ · ownership checks on orders / addresses / tickets / cart ✅ · upload magic-byte sniffing, UUID names, SVG blocked ✅ · audit log with secret redaction ✅ · security headers ✅ (CSP is weak — M19).

---

## 4. Bugs and risks found

Severity: **Critical** = blocks launch, loses money or allows takeover · **High** = will hurt customers or the business soon · **Medium** = wrong behaviour in some cases · **Low** = polish / latent.

### Critical (7)

| ID | Problem | Where | What happens | Fix |
|---|---|---|---|---|
| C1 | Next.js 16.3.2, sharp and source-map-js have published critical/high vulnerabilities, including RCE in the image optimizer with AVIF (enabled in config) | `package.json`, `next.config.ts:58` | An attacker could run code on the server | Upgrade (`npm audit fix`), re-test |
| C2 | No payment gateway. UPI / Card / Netbanking create an order with `paymentStatus: PENDING`, and UPI is the default choice | `api/checkout/route.ts:148-158`, `CheckoutView.tsx:35-36, 237-244` | Customers "place" orders they never pay for; staff must chase every one by hand | Razorpay integration (Phase 2-D) |
| C3 | Unpaid prepaid orders hold stock with no expiry | `api/checkout/route.ts:118-139` | Anyone can make products look sold out by placing UPI orders and never paying | Reserve stock with a timeout; release on payment failure or expiry |
| C4 | GST is added on top of the shown price ("MRP inclusive of all taxes" says otherwise); it's calculated *before* the coupon discount; the old rule (5% below ₹1,000, else 12%) is hard-coded — GST on clothing and textiles was restructured in September 2025 and the 12% slab removed; there's no CGST/SGST/IGST split | `lib/money.ts:46-68`, `lib/cart.ts:203-206`, `api/checkout/route.ts:88-91`, `product/[slug]/page.tsx:261-263` | Customers pay more than the price shown (possibly above MRP — a Legal Metrology problem); tax is over-charged when a coupon is used; filings are wrong | Tax-inclusive pricing with GST extracted per line after discount; rates per HSN in admin settings, confirmed by your CA |
| C5 | Admin image uploads are written into `public/uploads` at runtime | `lib/upload.ts:27, 139-140` | In production, Next.js only serves `public/` files that existed at build time, and hosts like Vercel have no writable disk → new product photos are broken | Cloudinary or S3 storage |
| C6 | 13 linked pages don't exist: `/terms`, `/privacy-policy`, `/returns-policy`, `/shipping-policy`, `/contact`, `/about`, `/faq`, `/help`, `/track-order`, `/wholesale`, `/sitemap.xml`, `/admin/audit`, `/admin/tickets/[ticketNumber]` | Header, footer, checkout, signup, admin nav | 404s everywhere; legal pages are mandatory under the Consumer Protection (E-Commerce) Rules, 2020, and Razorpay won't activate without them | Build the pages (Phases 2, 3 and 7) |
| C7 | The seed creates two `SUPERADMIN` accounts for real owner emails with the hard-coded password `Hastkala@2026`; no admin 2FA | `prisma/seed.ts:569-590` | If the seed ever runs on the production database, anyone who sees the code owns the store | Seed reads the admin password from env (or forces a reset); mandatory 2FA for staff |

### High (13)

| ID | Problem | Where | What happens | Fix |
|---|---|---|---|---|
| H1 | Two stock counts: `Product.stock` *and* `ProductVariant.stock` are both reduced at checkout. Admin must keep product stock ≥ the sum of variant stock by hand | `api/checkout/route.ts:118-139`, `ProductForm.tsx:377` | The product page says "in stock" but checkout says "just went out of stock" | One source of truth: stock lives on variants only (every product gets ≥1 variant) |
| H2 | Cancel checks the status *outside* the database transaction | `api/orders/cancel/route.ts:38-92`, `api/admin/orders/route.ts:45-104` | A double-click, or customer and admin cancelling together, puts stock back twice → overselling later | Conditional update inside the transaction (`where: { status: in [...] }`) |
| H3 | Coupon `usageLimit` and `perUserLimit` are checked outside the transaction; `usedCount` increments unconditionally | `api/checkout/route.ts:64-86, 141-146` | A "one per customer" or "first 100" coupon can be used more times than allowed with parallel checkouts | Redemption table with unique constraint + conditional increment in the transaction |
| H4 | Order number = date + random 4 digits | `lib/utils.ts:20-29` | ~12% chance of a duplicate at 50 orders/day, ~39% at 100 → checkout fails with "Something went wrong"; numbers are guessable | Sequence-based numbers (e.g., `HF-2610-000123`) |
| H5 | No email, SMS or WhatsApp sending anywhere | — | Customers get no confirmation, shipping or delivery updates; "A GST invoice will be emailed to you" (`CheckoutView.tsx:382`) is false | Notification service (Phase 2-F) |
| H6 | No invoices, no HSN codes, no GSTIN on the order | Schema | Wholesale buyers can't claim input tax credit; non-compliant B2B sales | Invoice module (Phase 2-E) |
| H7 | No courier integration or pincode check; COD offered to every pincode | — | Orders to unserviceable areas; manual AWB entry; no tracking timeline | Shiprocket integration (Phase 2-F) |
| H8 | No returns flow, although "7-day returns" is advertised; admin "RETURNED" restocks immediately with no quality check and flips `PAID → REFUNDED` with no money moving | `api/admin/orders/route.ts:59-93`, `api/orders/cancel/route.ts:79` | Damaged returns go back on sale; refund records are fiction | Return requests + QC + Razorpay refunds (Phase 2-G) |
| H9 | The rate limiter reads then writes (not atomic); login is limited to 5 tries per 15 min **per IP** | `lib/ratelimit.ts:31-57`, `lib/api.ts:122` | Parallel requests get past the limits; Indian mobile networks put many users behind one IP (CGNAT), so genuine customers get blocked | Atomic Redis limiter keyed by IP + account + phone |
| H10 | An approved wholesale buyer can change their GSTIN and business name with no re-verification | `api/account/profile/route.ts:39-47` | Approval for one business silently transfers to another | GSTIN change → back to "pending review" |
| H11 | Product edit upserts variants by SKU and sets `productId` | `api/admin/products/route.ts:170-189` | Typing another product's variant SKU *moves* that variant to this product; variants removed in the form but previously ordered stay live and buyable | Match variants by id; archive removed variants |
| H12 | No tests, no working linter, no CI | `package.json` | Every change is untested; regressions go unnoticed | Vitest + Playwright + ESLint (Phase 5) |
| H13 | The project lives on the iCloud-synced Desktop | `~/Desktop/Hastkala Fab` | 15,744 dependency files are offloaded → typecheck/build hang; SQLite in iCloud can corrupt; no git history | Move to e.g. `~/Projects/hastkala-fab`, `git init`, reinstall dependencies |

### Medium (22)

| ID | Problem | Where |
|---|---|---|
| M1 | The size/colour picker can't handle variants that have **both** a size and a colour (M/Red and M/Blue show as two identical "M" buttons) | `components/store/BuyBox.tsx:47-54` |
| M2 | Product JSON-LD is injected with `JSON.stringify` and no `<` escaping — a title or description containing `</script>` breaks the page or injects script | `product/[slug]/page.tsx:191-194` |
| M3 | Dates use the server's timezone (UTC on most hosts). A coupon set to expire "31 Oct" stops working at 05:30 IST that morning; order dates can show the wrong day | `lib/utils.ts:38-54`, `api/admin/coupons/route.ts:24` |
| M4 | Search uses `contains` with no case-insensitive mode, so it will become case-sensitive on PostgreSQL ("Saree" ≠ "saree"); no synonyms or Hindi | `lib/products.ts:50-60` |
| M5 | Filters: single-select fabric/occasion only; the price filter ignores variant price differences | `lib/products.ts`, `FilterSidebar.tsx` |
| M6 | Checkout UI hard-codes ₹999 / ₹79 / ₹10,000 separately from the server — they will drift | `CheckoutView.tsx:50-54`, `lib/money.ts:46-47` |
| M7 | "N verified reviews" counts *all* approved reviews, including non-verified ones | `product/[slug]/page.tsx:229` |
| M8 | Error says "Edit your existing review instead", but there's no edit feature | `api/reviews/route.ts:34` |
| M9 | Product JSON-LD claims free returns; availability uses the product pool, not variant stock | `product/[slug]/page.tsx:127, 155-162` |
| M10 | Phone numbers aren't normalised (`+91 98…` vs `98…`), so the same phone can be registered twice | `lib/validators.ts:24-27` |
| M11 | Uploaded photos keep EXIF data (including GPS location of the workshop or home) and aren't resized | `lib/upload.ts` |
| M12 | The product page is `force-dynamic` with ~6 DB queries per view — slow during festive sales | `product/[slug]/page.tsx:16` |
| M13 | The ₹10,000 COD cap plus no online payment = large wholesale orders can't be paid | `api/checkout/route.ts:96` |
| M14 | Wholesale has one price and one MOQ — no tiers, sets or bulk order; quantity is capped at 100 per add | `schema.prisma:146-147`, `validators.ts:235` |
| M15 | 8 wrong passwords lock any account for 15 min (anyone can lock out a customer); the "locked" message reveals that the email is registered | `api/auth/login/route.ts:43-79` |
| M16 | Category edit allows nesting deeper than one level and gives a 500 error for an unknown parent | `api/admin/categories/route.ts:116-124` |
| M17 | Editing a coupon to an existing code gives a 500 error instead of a message | `api/admin/coupons/route.ts:93` |
| M18 | Admin cancel doesn't release the coupon use (customer cancel does) | `api/admin/orders/route.ts:57-104` |
| M19 | CSP allows `'unsafe-inline'` scripts (weak XSS protection); HSTS `preload` + `includeSubDomains` is set before the domain is decided | `next.config.ts:9-46` |
| M20 | Wholesale sign-up doesn't require a GSTIN; the GSTIN check digit isn't validated | `lib/validators.ts:78-112` |
| M21 | No "sign out of other devices" action | `account/security/page.tsx` |
| M22 | No `sitemap.xml` / `robots.txt` / Organization / LocalBusiness / Breadcrumb structured data | `src/app` |

### Low (13)

| ID | Problem | Where |
|---|---|---|
| L1 | Root layout sets `canonical: "/"`, so any future page that forgets its own canonical tells Google it's a copy of the homepage | `src/app/layout.tsx:52` |
| L2 | Fonts load via a Google Fonts `<link>` instead of `next/font` (slower first paint) | `src/app/layout.tsx:66-71` |
| L3 | Newsletter has no confirmation email and no unsubscribe | `api/newsletter/route.ts` |
| L4 | Cart unique constraints don't stop duplicates when `variantId` is null (NULLs are distinct) | `schema.prisma:242-243` |
| L5 | Two sign-ups with the same email at the same moment → 500 instead of a friendly message | `api/auth/signup/route.ts:23-66` |
| L6 | `X-XSS-Protection` header is obsolete | `next.config.ts:20` |
| L7 | Address "302029", dispatch time and delivery promises are hard-coded in the product page | `product/[slug]/page.tsx:306-363` |
| L8 | The CSRF cookie expires after 24 h — a tab left open overnight fails its next action until refreshed | `src/proxy.ts:37`, `lib/csrf.ts:33` |
| L9 | Coupon soft-delete isn't written to the audit log | `api/admin/coupons/route.ts:124-131` |
| L10 | `Session.lastSeenAt` is never updated, so "last active" on the devices list is meaningless | `lib/auth.ts` |
| L11 | Clearing a product's wholesale price in the editor has no effect (`undefined` is ignored by Prisma) | `api/admin/products/route.ts:146-149` |
| L12 | Reviews show only the newest 8 with no "see more" | `product/[slug]/page.tsx:80` |
| L13 | The `keywords` meta tag is ignored by Google (harmless, but gives a false sense of SEO) | `layout.tsx:18-28`, product `keywords` field |

---

## 5. Migration plan: SQLite → PostgreSQL

Because the dev database holds **seed data only (0 orders, 4 users)**, no data migration is needed. We re-seed.

1. **Provision** managed PostgreSQL (Neon or Supabase; Mumbai region for low latency) for `dev`, `staging` and `production`.
2. **Schema changes** while switching `provider = "postgresql"`:
   - Status/role strings → native Prisma `enum`s.
   - `keywords String?` → `String[]`; `shippingSnapshot` / `AuditLog.metadata` → `Json`.
   - Add `mode: "insensitive"` to every text search (M4); add `pg_trgm` indexes for search.
   - Add composite indexes for filter and sort paths (e.g., `[isActive, categoryId, priceRetail]`).
3. **Migrations:** delete the SQLite migration history and create a fresh PostgreSQL baseline (`prisma migrate dev --name init`). SQLite migration SQL isn't portable.
4. **Rate limiting** moves from the `RateLimitEntry` table to Redis (Upstash). The table can be dropped.
5. **Seed:** idempotent, reads the admin email and password from env, never ships demo customers to production.
6. **Verify:** typecheck, build, full test suite against PostgreSQL in CI (a Postgres service container).
7. **Backups:** daily automated backups + point-in-time recovery enabled; one restore drill before launch.

---

## 6. Hard-coded business facts found (need your confirmation)

These values are written directly into the code today. They will move into admin **Settings**, marked `OWNER_TO_CONFIRM`:

| Value in code | Where |
|---|---|
| Free shipping above **₹999**, otherwise **₹79** | `lib/money.ts:46-47`, `CheckoutView.tsx:51`, product page |
| Wholesale shipping **₹0** ("freight on delivery") | `lib/money.ts:55` |
| COD limit **₹10,000** | `api/checkout/route.ts:96` |
| GST **5% / 12%**, slab at **₹1,000** per item | `lib/money.ts:49-51` |
| **7-day** returns, "unused, tags intact", free reverse pickup on defects | Product page, JSON-LD |
| "Dispatched from Jaipur in 24–48 hours", "3–5 days metros, 5–8 elsewhere" | Product page |
| "Marketed by Hastkala Fab, Sanganer, Jaipur — 302029" | Product page |
| Default wholesale MOQ **10** | `schema.prisma:147` |
| Admin accounts: Priyanshu Khandelwal, Harsh Khandelwal (`@hastkalafab.com`) | `prisma/seed.ts:572-577` |

---

### Owner requirement (11 Oct 2026): everything editable from the admin panel

Nothing a shop owner might want to change should need a developer. Every value in the table above, and all of the following, must be **addable, editable and re-orderable from the admin panel**:

- **Products:** add, edit, duplicate, hide/show, drag to reorder photos, variants, prices (retail + wholesale tiers), stock, SEO text.
- **Categories and collections:** add, edit, drag to reorder in the menu and on the homepage.
- **Orders:** create a manual order (for phone / WhatsApp customers), edit address or items before packing, change status, add tracking, cancel, refund, print invoice and label.
- **Customers and wholesale buyers:** edit details, approve/reject, assign price tier.
- **Store settings:** shipping charges, free-shipping limit, COD limit and fee, GST rates per HSN, return window, dispatch time, business address, GSTIN, phone, WhatsApp, email.
- **Website content:** homepage banners and sections (drag to reorder), announcement bar, FAQs, policy pages, blog, "Our Craft" page.
- **Coupons, reviews, support tickets:** as today, plus edit everywhere.

Every admin change is saved in the audit log (who changed what, and when).

## 7. Recommended order of work

**Step 0 — quick safety fixes (about 1 hour, before anything else):**
1. Move the project out of iCloud Desktop → `git init` → reinstall dependencies (H13).
2. Upgrade Next.js and the vulnerable dependencies (C1).
3. Seed reads the admin password from env (C7).
4. Restore a working `lint` script, and run typecheck + build to get a clean baseline.

**Then Phase 1 (Architect):** redesign the schema around variants-only stock, tax-inclusive pricing, invoices, payments, shipments, returns, refunds, wholesale tiers, OTP, and roles. Then switch to PostgreSQL.

**Then Phase 2 (Build):** payments → invoices → shipping/tracking → returns/refunds → notifications → missing pages → wholesale portal → admin modules.

Critical and high bugs that touch code being rebuilt (C2–C5, H1–H8) are fixed *as part of* those phases rather than patched twice.

---

## 8. Step 0 results (11 October 2026)

| Item | Result |
|---|---|
| Project moved out of iCloud | Copied to `~/Projects/hastkala-fab` (all 165 files downloaded locally; 0 cloud-only placeholders). The old `~/Desktop/Hastkala Fab` folder is untouched and can be deleted once you've confirmed the new one works. |
| Version history | `git init` on `main`; baseline commit `c0c7307` holds the original code exactly as found. |
| **C1** Next.js vulnerabilities | **Fixed.** `next` 16.3.2 → **16.3.8** (latest patch of the same line). `npm audit --omit=dev` → **0 vulnerabilities** in what ships to the website. 5 "high" advisories remain in the dev-only ESLint toolchain (`braces` via `fast-glob`); they never reach the live site and have no fix available yet. |
| **C7** Hard-coded admin password | **Fixed.** `prisma/seed.ts` now reads `SEED_ADMIN_PASSWORD` from `.env` (validated by the same password rules as sign-up), never overwrites an existing admin's password, refuses to run when `NODE_ENV=production` unless `SEED_ALLOW_PRODUCTION=true`, and creates demo shoppers only outside production with a random password. Tested on a fresh database: the env password works and `Hastkala@2026` does not. A strong random local password was added to your `.env`. |
| **H12** Lint | **Fixed.** `npm run lint` now runs ESLint 9 with the official Next.js rules (`eslint.config.mjs`). Initial run: 3 errors + 6 warnings → fixed to **0 errors, 1 warning** (Google Fonts `<link>`, fixed with `next/font` in Phase 2 — L2). Tests are still missing (Phase 5). |
| **New bug found — B1 (Critical): production build was broken** | `next build` failed type-checking on **all 22 API routes** because the shared `handler()` wrapper typed the route context as `never`. The site could not have been built for a live server. **Fixed** in `src/lib/api.ts` (`RouteContext` type). |
| Lint fixes made | Unescaped apostrophe on the homepage; impure `Date.now()` in the admin dashboard; header menus closed via `setState` inside an effect (now adjusted during render); ternary-as-statement in `FilterSidebar`; unused `MOTIFS` value and stale lint-disable comments. |
| Typecheck | ✅ `tsc --noEmit` passes (4 s). |
| Lint | ✅ 0 errors, 1 warning. |
| Production build | ✅ `next build` passes (51 routes). |
| Smoke test of the built site | ✅ Home, product listing, category, product, cart, login and signup return 200. `/admin` and `/account` redirect logged-out visitors to `/login`. A cart write without the CSRF token is rejected (403). Security headers present. `/terms` and `/track-order` still 404 (C6, Phase 2). |
| New low-priority note — L14 | Visiting `/admin` or `/account` while logged out redirects correctly but also prints `AuthError: Authentication required` to the server log as an error (log noise). |
