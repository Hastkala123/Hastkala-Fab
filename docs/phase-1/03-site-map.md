# 03 — Site map (three portals)

The site isn't live yet, so we can pick the best URLs now without losing any Google ranking. Short, keyword-rich, stable URLs:

- **Categories at the top level:** `/kurtis`, `/sarees`, `/salwar-suits`, `/bedsheets`, with sub-categories at `/kurtis/cotton-kurtis`. Category slugs are checked against a reserved list (`cart`, `account`, `admin`, `api`, `products`, …), so they can never clash with a page.
- **Products** at `/products/{slug}`, e.g. `/products/indigo-sanganeri-hand-block-print-mulmul-saree`. A product keeps its URL even if it moves category.
- **Old paths** (`/category/x`, `/product/x`) permanently redirect to the new ones.

## A. Storefront (public)

| URL | Page | Indexed by Google |
|---|---|---|
| `/` | Home — built from admin-arranged sections (hero, categories, collections, bestsellers, craft story, testimonials, wholesale call-to-action, Instagram) | ✅ |
| `/{category}` and `/{category}/{sub}` | Category listing: SEO intro, filters, sort, grid, FAQs | ✅ |
| `/collections/{slug}` | Curated landing pages ("Jaipuri king-size bedsheets", "Summer mulmul sarees", "Kurtis under ₹999") | ✅ |
| `/products/{slug}` | Product page | ✅ |
| `/search?q=` | Search results | ❌ noindex |
| `/new-arrivals`, `/bestsellers` | Auto lists | ✅ |
| `/wholesale` | Wholesale landing: how it works, MOQs, catalogue, inquiry form, WhatsApp | ✅ |
| `/wholesale/{category}` | Wholesale pages per category ("Jaipuri kurti wholesale") | ✅ |
| `/our-craft` | The Sanganer hand-block story, artisans, process video | ✅ |
| `/journal` and `/journal/{slug}` | Blog | ✅ |
| `/faq`, `/contact`, `/about` | Info pages (editable in admin) | ✅ |
| `/track` | Public order tracking (order number + phone, rate-limited) | ❌ |
| `/cart`, `/checkout`, `/checkout/payment`, `/order/{number}/thank-you` | Purchase flow | ❌ |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth (phone OTP first, email / Google as alternatives) | ❌ |
| `/terms`, `/privacy-policy`, `/shipping-policy`, `/returns-policy`, `/cancellation-refund-policy`, `/grievance` | Legal pages required for Indian e-commerce and Razorpay | ✅ |
| `/sitemap.xml`, `/robots.txt`, `/feeds/google-merchant.xml` | Machine files | — |

**Filters that stay out of Google's index:** filter combinations are `noindex, follow` with a canonical tag. Only curated combinations become real pages, as **collections**. That stops thousands of near-duplicate URLs while still ranking for "cotton kurti", "king size bedsheet" and similar searches.

## B. Customer portal (`/account`, signed-in)

| URL | What the customer can do |
|---|---|
| `/account` | Dashboard: recent orders, live shipment status, store-credit balance, wholesale status |
| `/account/orders` | All orders, with filters |
| `/account/orders/{number}` | Timeline (placed → paid → packed → shipped → out for delivery → delivered), courier tracking, **download GST invoice**, cancel (before packing), **request return / exchange**, reorder, help |
| `/account/returns` and `/account/returns/{number}` | Return and exchange requests with photos; pickup status; refund status and timeline |
| `/account/addresses` | Address book with pincode autofill |
| `/account/wishlist` | Saved items, move to bag, back-in-stock alerts |
| `/account/reviews` | Write and edit reviews (with photos) for delivered items |
| `/account/credit` | Store-credit balance and history |
| `/account/support` and `/account/support/{number}` | Tickets with attachments, plus a WhatsApp chat link |
| `/account/profile` | Name, phone (OTP to change), email (verify), GSTIN for business invoices |
| `/account/security` | Password, signed-in devices, **sign out other devices** |
| `/account/privacy` | Communication preferences (consent), download my data, delete my account (DPDP) |
| **Wholesale buyers also get:** | |
| `/account/wholesale` | Application status, tier, payment terms, documents |
| `/account/wholesale/quick-order` | Bulk order grid: pick designs, enter quantity per size / set, see the tier price live |
| `/account/wholesale/catalogue` | Download a PDF catalogue / line sheet with wholesale prices |
| `/account/wholesale/ledger` | Advance paid, balance due, invoices, credit notes |

## C. Admin portal (`/admin`, staff only, 2FA required)

Each section shows only if the staff member's role allows it. **Everything here is add / edit / delete / re-order. Nothing about the shop is hard-coded.**

| Section | Pages |
|---|---|
| **Dashboard** | Today / 7-day / 30-day sales, orders, average order value, retail vs wholesale, top products, low stock, to-do counts (to pack, to ship, returns, refunds, wholesale approvals, tickets, reviews) |
| **Orders** | List with filters and search · order detail (timeline, edit address or items before packing, notes, change status, cancel, refund, print invoice and label) · **create manual order** (phone / WhatsApp) · bulk actions (print pick list, mark packed) |
| **Shipping** | Ready to ship → create shipment on Shiprocket → AWB, label, pickup → manifest · in-transit board · NDR (failed delivery) queue · RTO queue |
| **Returns & refunds** | Return requests (approve / reject with reason, schedule pickup, QC pass/fail, restock) · refunds (issue, retry, status) · store credit (add / deduct with reason) |
| **Invoices & GST** | Invoices and credit notes (view, download, re-send) · GST reports export (GSTR-1: B2B, B2C, HSN summary, credit notes) · HSN codes and tax rules |
| **Catalogue** | Products (add, edit, duplicate, draft/publish/schedule, variants, prices, wholesale tiers, photos drag-to-order, SEO) · bulk CSV import/export · categories (drag-to-order, menu visibility) · collections · attributes (add your own fields) · size charts · search synonyms |
| **Inventory** | Stock by SKU, quick edit, adjustments with reason, movement history, low-stock alerts |
| **Customers** | Search, profile, orders, addresses, notes, block/unblock · **wholesale applications** (review documents, approve/reject with reason, assign tier and payment terms) · wholesale inquiries (lead list) · price tiers |
| **Marketing** | Coupons · banners and announcement bar · homepage sections (drag-and-drop) · newsletter subscribers export · abandoned-cart reminders on/off |
| **Content** | Pages (legal, about, craft) · FAQs · blog · redirects · notification message templates (email / SMS / WhatsApp) |
| **Reviews & support** | Review moderation (approve/reject, reply) · support tickets (assign, reply, internal notes) |
| **Settings** | Store profile (legal name, GSTIN, Sanganer address, phone, WhatsApp, email, grievance officer) · shipping (free-shipping limit, fees) · COD (limit, fee, OTP threshold, blocked pincodes) · returns (window, non-returnable rules) · tax (price-inclusive rules, invoice trigger, rounding) · wholesale (minimum order, advance %) · checkout (payment timeout) · SEO defaults and social links · integrations status (keys stay in env, never shown) |
| **Staff & security** | Staff members, roles and permissions, 2FA status, audit log (who changed what, when) |
