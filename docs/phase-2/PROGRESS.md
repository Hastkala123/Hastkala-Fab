# Phase 2 progress

Each milestone ends with typecheck + lint + tests + production build passing, then a git commit.

| # | Milestone | Status |
|---|---|---|
| M1 | **Foundation:** PostgreSQL + new schema, GST/pricing/coupon/state-machine engines with tests, settings, seed, existing features ported, new URLs | ✅ Done (12 Oct 2026) |
| M2 | Payments: Razorpay (+ dev test gateway), webhooks, payment retry, expiry job, reconciliation | ✅ Done (12 Oct 2026) |
| M3 | GST invoices + credit notes (PDF), GSTR-1 export | ⏳ |
| M4 | Shipping: Shiprocket (+ manual mode), labels, tracking timeline, public `/track`, NDR/RTO | ⏳ |
| M5 | Returns, exchanges, refunds, store credit | ⏳ |
| M6 | Notifications (email / SMS / WhatsApp, editable templates) + background job runner | ⏳ |
| M7 | Phone OTP login, guest checkout, forgot password, staff 2FA, sign out other devices | ⏳ |
| M8 | Wholesale: application + documents, approval, tiers, quick order, catalogue PDF, ledger | ⏳ |
| M9 | Full admin panel: settings, content (pages, banners, homepage sections, FAQs, blog), inventory, staff and roles, audit log, drag-and-drop ordering | ⏳ |
| M10 | Missing pages + new design across the site, `next/font`, sitemap, robots, structured data | ⏳ |

## Engineering decisions made during Phase 2

- **Rate limiting uses PostgreSQL** (an atomic `INSERT … ON CONFLICT … RETURNING` counter) instead of Redis. One fewer paid service, and it fixes the race in H9. Redis can be swapped in later behind the same interface.
- **Every outside service sits behind an interface with a development stand-in:** a test payment gateway, manual shipping, notifications written to the log, files saved to `./storage`. The site is fully usable and testable before any keys exist, and the stand-ins are blocked in production.
- **Uploaded files are served by a route handler** (`/media/…`) instead of `public/`, so they work after deployment (fixes C5). Cloudinary/S3 plugs in later.
- **The browser's "payment succeeded" is checked with the gateway, not trusted.** The doc said only the webhook marks an order paid. In practice webhooks can't reach a laptop, and they're sometimes late, so after the payment window closes our server verifies the signature and then asks Razorpay itself for the payment. The browser never decides; the gateway's own record does, through the same idempotent code the webhook uses.
- **Background work without a new service:** the `Job` table plus `/api/cron/jobs` (Vercel Cron, `CRON_SECRET`), or a timer inside the web server (on in development, `IN_PROCESS_SCHEDULER=true` for one-server hosting). Jobs are claimed with `FOR UPDATE SKIP LOCKED`, retried with back-off, and given up on with a clear failure.
- **Times in raw SQL are always UTC** (`timezone('utc', now())`). Prisma stores UTC in its date columns, while plain `now()`, and dates passed into raw SQL, follow the database's time zone. On a database set to IST, rate limits never reset the window properly, and jobs ran 5½ hours early. Found by the M2 tests; the local test database stays on IST on purpose so this can't come back unnoticed.
- **Local development database:** PostgreSQL 16 from Homebrew, kept inside the project in `./.pgdata` on port 5433. Run `npm run db:start` / `npm run db:stop`.

## M1 — what was built

**Shop**
- New addresses: `/kurtis`, `/kurtis/cotton-kurtis`, `/products/{slug}`, `/search`, `/order/{number}/thank-you`. Old addresses (`/category/…`, `/product/…`, `/products`, `/order-confirmed/…`) redirect permanently, so links and rankings carry over.
- Search understands synonyms and Hindi words ("chadar" → bedsheets, "sari" → sarees), plurals, and typos ("indgo" → indigo). Synonyms are data (seeded, editable).
- Filters come from attributes the owner marks "filterable" (fabric, print style, motif, colour, occasion…), plus size, colour, price and in-stock.
- Product page: size and colour picker on real variants, per-variant price and stock, wholesale price breaks for approved buyers ("+ GST"), size chart, real reviews only, safe structured data.
- Bag and checkout: prices recomputed on the server every time; coupon box with clear reasons; free-shipping progress; COD offered only when allowed; GST shown as CGST+SGST or IGST by delivery state.
- Account: dashboard, orders with tracking steps and history, cancel before preparation, addresses (with landmark and GSTIN), wishlist, support tickets (new-ticket form), password change with "sign out other devices".

**Admin**
- Staff see only the sections their role allows.
- Products: one editor for details, photos (drag to reorder), sizes/colours with stock (stock history kept), price per size, wholesale price breaks, filter attributes, policies, scheduling, SEO and search words. Products are archived, never deleted. Drag-and-drop order per category ("Recommended").
- Categories: HSN code, menu visibility, banner, SEO text, drag-and-drop menu order.
- Coupons: percent / flat / free shipping, dates, audience, first order only, per-category, limits.
- Orders: status changes checked against the rules and protected against two people editing at once; cancellation puts stock back and releases the coupon; internal notes; full timeline.
- Customers: block/unblock, approve/reject/suspend wholesale buyers.
- Reviews moderation (ratings recalculated from approved reviews), support ticket replies and internal notes.
- **Settings:** business details, shipping, COD, returns, GST options, checkout limits, wholesale rules, SEO defaults — all editable, validated, and audited. The dashboard lists sections still on starting values.

**Safety checks proven by tests (real PostgreSQL)**
- Two shoppers, one last piece: exactly one order.
- A coupon limited to 1 use, three shoppers at once: used once.
- The same checkout submitted twice: one order.
- One shopper, two tabs: one order.
- Two cancellations at once: stock restored once.
- Stale status change: refused. Order numbers: no gaps, no repeats.

Run them with `npm run db:start` then `npm test` (83 tests: 71 unit, 12 integration).

**Known limits until later milestones**
- ~~Online payment records the order as "awaiting payment"~~ — done in M2.
- Tracking numbers are written in the order note until courier integration in **M4**.
- Newsletter sign-ups stay "pending" until confirmation emails exist (**M6**). COD phone verification arrives with OTP in **M7**.
- Home page sections, info pages and legal pages are built in **M9/M10**. Some home page wording (history claims) still needs the owner's confirmation.

## M2 — what was built

**For shoppers**
- UPI, card and net banking through Razorpay Checkout. "Place order and pay" opens the payment window straight away; the stock is held while they pay.
- Payment failed or window closed? The order page and thank-you page show **Pay now** with a countdown of how long the items are held. Retries reuse the same Razorpay order, so Razorpay itself refuses a second successful payment.
- If the bank is slow, the thank-you page says "Confirming your payment…" and updates by itself.
- Unpaid orders are cancelled when the window ends (owner's setting, 30 minutes, plus 3 minutes' grace), and the stock and the coupon are given back. Before cancelling, the shop asks Razorpay once more, in case the payment went through and its message was lost.
- **Automatic refunds** to the original payment method when a paid order is cancelled, when a payment arrives after the order expired, or when someone pays twice. The order page shows each refund (RFD-100001…) and its progress.

**For staff**
- Order page: every payment attempt (method, failure reason, Razorpay ids), refunds, **Check with gateway**, **Retry refund**.
- **Admin → Payments**: anything needing a look (amount mismatch, double payment, refund failed, customer dispute), refunds in progress, failed webhooks, all attempts. The dashboard shows the count, and warns while Razorpay isn't set up.
- **Settings → Checkout → Accept online payment** switches UPI/cards off during a gateway outage (COD still works).

**Safety, proven by tests (32 integration, 83 unit, 115 total)**
- Webhook signature checked on the raw body; a forged one is refused and nothing is stored. The same event delivered twice, or the same payment reported by webhook, browser and reconciliation, is counted once.
- A payment and the expiry racing each other always end consistent: confirmed with the stock taken, or cancelled with the stock back and the money refunded.
- A missed webhook doesn't cancel a paid order. A late payment is refunded in full.
- Refunds can never add up to more than was paid. A refund the gateway rejects is released and flagged; a temporary failure is retried with back-off; a refund made in the Razorpay dashboard is added to our books.
- Every hour the shop compares the last 3 days of payments with Razorpay and flags any mismatch.

**Going live with Razorpay (owner)**
1. Finish Razorpay KYC (needs the legal pages from M10 live).
2. Dashboard → API keys: put `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in the server's environment (test keys first: `rzp_test_…`).
3. Dashboard → Webhooks: add `https://<domain>/api/webhooks/razorpay` with events `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`, `payment.dispute.created`, and the same secret as `RAZORPAY_WEBHOOK_SECRET`.
4. Set `CRON_SECRET` and schedule `/api/cron/jobs` every minute (Vercel Cron), or set `IN_PROCESS_SCHEDULER=true` on a single server.
5. Place a test order with Razorpay's test UPI id / test card, cancel it, and check the refund appears in Admin → Payments.

Until the keys are set, development uses a built-in **test gateway** (Pay / Make it fail / Close buttons, no real money). It sends the same signed messages Razorpay does, and production never uses it: online payment stays switched off there until the keys exist.
