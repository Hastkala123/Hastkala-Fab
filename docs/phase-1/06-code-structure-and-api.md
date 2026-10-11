# 06 — Code structure and API map

## Folder layout

The current structure is kept and extended. New business logic moves out of route handlers into `src/server/`, so each rule (pricing, tax, stock, transitions) exists in exactly one tested place.

```
src/
├─ app/
│  ├─ (store)/                    Storefront pages
│  │  ├─ page.tsx                 Home (renders HomeSection rows)
│  │  ├─ [category]/              /kurtis, /kurtis/[sub]
│  │  ├─ products/[slug]/         Product page
│  │  ├─ collections/[slug]/
│  │  ├─ search/  new-arrivals/  bestsellers/
│  │  ├─ wholesale/  our-craft/  journal/  faq/  contact/  track/
│  │  ├─ cart/  checkout/  order/[number]/thank-you/
│  │  ├─ login/  signup/  forgot-password/  reset-password/
│  │  └─ (legal)/[page]/          terms, privacy-policy, … (from Page table)
│  ├─ account/                    Customer portal (+ wholesale/ sub-section)
│  ├─ admin/                      Admin portal (one folder per section in 03)
│  ├─ api/                        Route handlers (map below)
│  ├─ sitemap.ts  robots.ts  manifest.ts
│  └─ feeds/google-merchant.xml/route.ts
├─ components/
│  ├─ ui/                         Design-system primitives
│  ├─ store/  account/  admin/    Feature components
├─ server/                        Domain services (server-only, unit-tested)
│  ├─ auth/        otp, sessions, google, totp, permissions
│  ├─ catalog/     products, variants, attributes, search, collections
│  ├─ pricing/     price resolution (retail / wholesale tiers), coupons
│  ├─ tax/         GST engine (rate selection, extraction, CGST/SGST/IGST split)
│  ├─ inventory/   reserve, release, adjust, ledger
│  ├─ orders/      checkout, transitions, manual orders, numbering
│  ├─ payments/    razorpay client, webhook handler, reconciliation
│  ├─ invoices/    numbering, PDF, credit notes, GSTR-1 export
│  ├─ shipping/    shiprocket client, serviceability, tracking sync, NDR
│  ├─ returns/     requests, QC, exchanges
│  ├─ refunds/     refunds, store credit
│  ├─ notifications/ templates, email/sms/whatsapp senders
│  ├─ settings/    typed settings (Zod) + cache
│  ├─ content/     pages, banners, home sections, blog, faqs
│  ├─ jobs/        queue, worker, job handlers
│  └─ privacy/     consent, export, anonymise
├─ integrations/                  Thin HTTP clients: razorpay, shiprocket, msg91, whatsapp, resend, cloudinary, turnstile
├─ lib/                           Existing helpers (api guard, csrf, money, validators, utils)
└─ proxy.ts                       CSRF cookie + headers only (no auth decisions)
tests/
├─ unit/        tax, pricing, coupons, transitions, numbering, validators
├─ integration/ API routes against a test Postgres
└─ e2e/         Playwright journeys (mobile + desktop)
```

## API map

**Auth key:** P = public · C = signed-in customer · W = approved wholesale · S(perm) = staff with permission · H = verified webhook signature · K = cron secret.
All mutating routes need the CSRF token, except webhooks and cron. Rate-limit budgets are per IP + per account + per phone, with the exact numbers set in Phase 4.

### Auth and account
| Method | Path | Auth | Rate-limit bucket |
|---|---|---|---|
| POST | `/api/auth/otp/send` | P | `otp-send` (strict) |
| POST | `/api/auth/otp/verify` | P | `otp-verify` (max 3 tries per code) |
| POST | `/api/auth/login` (email + password) | P | `login` |
| POST | `/api/auth/signup` | P | `signup` |
| GET | `/api/auth/google/start`, `/api/auth/google/callback` | P | `oauth` |
| POST | `/api/auth/password/forgot`, `/api/auth/password/reset` | P | `password-reset` |
| POST | `/api/auth/logout`, `/api/auth/sessions/revoke-others` | C | `write` |
| POST | `/api/auth/2fa/setup`, `/api/auth/2fa/verify` | S | `2fa` |
| PATCH | `/api/account/profile`, `/api/account/password` | C | `write` / `password` |
| POST/PATCH/DELETE | `/api/account/addresses` | C | `write` |
| POST | `/api/account/privacy/export`, `/api/account/privacy/delete` | C | `privacy` |
| PATCH | `/api/account/consents` | C | `write` |

### Catalogue and discovery
| Method | Path | Auth | Bucket |
|---|---|---|---|
| GET | `/api/search/suggest?q=` | P | `search` |
| GET | `/api/pincode/{pin}` (city/state, serviceable, COD, delivery estimate) | P | `pincode` |
| POST | `/api/back-in-stock` | P | `write` |
| POST | `/api/wishlist` | C | `write` |
| POST/PATCH | `/api/reviews` (+ photo upload) | C | `review` |

### Cart, checkout, payment
| Method | Path | Auth | Bucket |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/api/cart` | P | `cart` |
| POST | `/api/cart/coupon` | P/C | `coupon` |
| POST | `/api/checkout/quote` (server-calculated totals for the review step) | P/C | `checkout` |
| POST | `/api/checkout/place` (idempotency key required) | C / guest-OTP | `checkout` (strict) |
| POST | `/api/payments/razorpay/order` (retry payment for an order) | C | `checkout` |
| POST | `/api/payments/razorpay/verify` (checks status only) | C | `checkout` |
| POST | `/api/webhooks/razorpay` | H | none (signature + replay protection) |

### Orders, tracking, returns
| Method | Path | Auth | Bucket |
|---|---|---|---|
| POST | `/api/orders/{number}/cancel` | C | `write` |
| GET | `/api/orders/{number}/invoice` (PDF, signed URL) | C | `download` |
| POST | `/api/track` (order number + phone) | P | `track` (strict, anti-enumeration) |
| POST | `/api/returns` (+ photos) | C | `return` |
| POST | `/api/returns/{number}/cancel` | C | `write` |
| POST | `/api/webhooks/shiprocket` | H | none (token + dedupe) |

### Wholesale and support
| Method | Path | Auth | Bucket |
|---|---|---|---|
| POST | `/api/wholesale/apply` (+ documents, private bucket) | C | `wholesale-apply` |
| POST | `/api/wholesale/inquiry` | P | `inquiry` (+ Turnstile) |
| POST | `/api/wholesale/quick-order` | W | `cart` |
| GET | `/api/wholesale/catalogue.pdf` | W | `download` |
| POST/PATCH | `/api/support/tickets` (+ attachments) | C | `ticket` |
| POST | `/api/newsletter` + `/api/newsletter/confirm` + `/api/newsletter/unsubscribe` | P | `newsletter` |

### Admin (all `S(permission)`, 2FA-verified session, audit-logged)
| Area | Paths |
|---|---|
| Orders | `/api/admin/orders` (list/detail/transition/edit/notes), `/api/admin/orders/manual`, `/api/admin/orders/bulk` |
| Shipping | `/api/admin/shipments` (create on Shiprocket, label, pickup, manifest, cancel, NDR action) |
| Returns & refunds | `/api/admin/returns`, `/api/admin/refunds`, `/api/admin/store-credit` |
| Invoices & GST | `/api/admin/invoices`, `/api/admin/credit-notes`, `/api/admin/reports/gstr1`, `/api/admin/tax` (HSN + rules) |
| Catalogue | `/api/admin/products` (+ `/bulk-import`, `/export`, `/reorder`), `/api/admin/variants`, `/api/admin/categories` (+ `/reorder`), `/api/admin/collections`, `/api/admin/attributes`, `/api/admin/size-charts`, `/api/admin/synonyms`, `/api/admin/media` |
| Inventory | `/api/admin/inventory` (adjust, history) |
| Customers | `/api/admin/customers`, `/api/admin/wholesale` (applications, tiers, terms), `/api/admin/inquiries` |
| Marketing & content | `/api/admin/coupons`, `/api/admin/banners`, `/api/admin/home-sections` (+ `/reorder`), `/api/admin/pages`, `/api/admin/faqs`, `/api/admin/blog`, `/api/admin/redirects`, `/api/admin/notification-templates` |
| Reviews & support | `/api/admin/reviews`, `/api/admin/tickets` |
| Settings & staff | `/api/admin/settings/{key}`, `/api/admin/staff`, `/api/admin/roles`, `/api/admin/audit` |

### System
| Method | Path | Auth |
|---|---|---|
| POST | `/api/cron/jobs` (runs due jobs: notifications, expiry, tracking sync, reconciliation, abandoned cart, back-in-stock) | K |
| GET | `/api/health` | P (no details) |

## Staff permissions (seed roles, all editable)

| Role | Permissions |
|---|---|
| **Owner** | Everything, including staff, roles, settings, refunds |
| **Manager** | Everything except staff/roles and integration settings |
| **Catalog** | Products, categories, collections, attributes, inventory, media, content |
| **Dispatch** | View orders, pack, shipments, labels, NDR/RTO, returns pickup/QC |
| **Support** | View orders and customers, tickets, reviews, create returns, add notes |
| **Accounts** | Payments, refunds, invoices, credit notes, GST reports, verify bank transfers, store credit |
