# Phase 2 progress

Each milestone ends with typecheck + lint + tests + production build passing, then a git commit.

| # | Milestone | Status |
|---|---|---|
| M1 | **Foundation:** PostgreSQL + new schema, GST/pricing/coupon/state-machine engines with tests, settings, seed, existing features ported, new URLs | 🔄 In progress |
| M2 | Payments: Razorpay (+ dev test gateway), webhooks, payment retry, expiry job, reconciliation | ⏳ |
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
- **Local development database:** PostgreSQL 16 from Homebrew, kept inside the project in `./.pgdata` on port 5433. Run `npm run db:start` / `npm run db:stop`.
