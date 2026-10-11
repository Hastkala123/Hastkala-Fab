# 01 — Tech stack

Every choice below is either already in the codebase (kept, to avoid a rewrite) or is the most common, best-supported option for an Indian D2C store. **Anything with a running cost is marked 💰 and needs the owner's OK before an account is created.**

## Application

| Layer | Choice | Version | Why |
|---|---|---|---|
| Framework | **Next.js** (App Router, Server Components, Route Handlers) | 16.3.x | Already used. Server rendering gives fast first paint on 4G and full SEO. One codebase for storefront, customer portal, admin and APIs. |
| UI | **React** + **Tailwind CSS** | 19.2 / 4.x | Already used. Tailwind tokens hold the Sanganeri palette (see 02). |
| Language | **TypeScript** (strict) | 5.9 | Already used. Catches whole classes of bugs before they ship. |
| Validation | **Zod** | 4.x | Already used for every request body; extended to settings, attributes and webhooks. |
| ORM | **Prisma** | 6.19 (stay on 6) | Already used. Prisma 7 changes the client/driver setup; upgrade later as its own task. |
| Auth | Custom (existing) + **phone OTP** + optional **Google sign-in** | — | The current session design (DB-backed, revocable, roles re-read every request) is solid; we extend it rather than swap in a library. |
| Rich text (admin) | **Tiptap** editor → sanitised HTML (allow-list) | — | Owner-friendly editing for product descriptions, pages and blog. |
| Drag-and-drop (admin) | **dnd-kit** | — | Re-ordering categories, photos, homepage sections, banners. |
| PDF | **@react-pdf/renderer** | — | GST invoices, credit notes, wholesale catalogue / line sheet. |
| Image processing | **sharp** (already a Next.js dependency) | — | Strip EXIF/GPS, resize, convert to WebP before upload (fixes M11). |

## Data & infrastructure

| Need | Choice | Notes |
|---|---|---|
| Database | **PostgreSQL 16+** — Neon or Supabase, **Mumbai region** 💰 (free tier to start) | Needs `pg_trgm` extension (typo-tolerant search). Daily backups + point-in-time recovery on. |
| Cache & rate limits | **Upstash Redis**, Mumbai region 💰 (free tier to start) | Atomic rate limiting (fixes H9), short-lived caches. Local dev falls back to in-memory. |
| Hosting | **Vercel Pro**, functions in Mumbai (`bom1`) 💰 | Vercel's free Hobby plan is for non-commercial use only, so a shop needs Pro. Alternative: a Mumbai VPS with Docker if you prefer a fixed monthly cost. |
| Background jobs | **Postgres `Job` table** + **Vercel Cron** hitting a protected `/api/cron/jobs` route every minute | No extra service. Handles notifications, expiring unpaid orders, tracking sync, reconciliation. |
| Media storage | **Cloudinary** 💰 (free tier to start) — or AWS S3 Mumbai + CloudFront | Fixes C5. Automatic WebP/AVIF and resizing. Private bucket (S3 or Cloudinary authenticated assets) for GST certificates and refund documents. |
| Error monitoring | **Sentry** 💰 (free tier to start) | Alerts on crashes and failed payments. |
| Bot protection | **Cloudflare Turnstile** (free) | Shown on login / sign-up / OTP only after repeated failures, so real users rarely see it. |

## Indian commerce integrations

| Need | Choice | Owner action needed |
|---|---|---|
| Online payments | **Razorpay** — UPI, cards, netbanking, wallets, EMI; Refunds API; webhooks 💰 (per-transaction fee) | Create a Razorpay business account and complete KYC. Activation needs the legal pages live (C6). |
| Shipping & tracking | **Shiprocket** — serviceability, rates, AWB, labels, pickups, tracking webhooks, NDR, RTO, reverse pickups 💰 (per shipment) | Create a Shiprocket account, add the Sanganer pickup address, and connect a courier mix. Delhivery direct is the alternative. |
| SMS (OTP, order updates) | **MSG91** 💰 | **TRAI DLT registration is mandatory** in India: register as a business entity, sender ID ("HSTKLA" or similar) and every SMS template. This takes a few days, so start early. |
| WhatsApp (order updates, support) | **WhatsApp Business Platform** via a BSP (Gupshup / Interakt / AiSensy) 💰 | Business verification on Meta, approved message templates, a dedicated number. |
| Email | **Resend** (or Amazon SES Mumbai) 💰 (free tier to start) | Verify the sending domain (SPF/DKIM) so emails don't land in spam. |
| Pincode → city/state | India Post pincode directory, imported into `PincodeInfo` | — |
| GST e-invoicing (IRN) | Pluggable module, **off by default** | Only needed above the turnover threshold. Your CA confirms if and when. |

## Analytics & marketing

| Need | Choice |
|---|---|
| Analytics | **Google Analytics 4** e-commerce events, behind cookie consent |
| Ads tracking | **Meta Pixel + Conversions API**, behind cookie consent |
| Search visibility | **Google Search Console**, **Bing Webmaster Tools**, **Google Merchant Center** product feed (free listings + Shopping ads) |
| Local | **Google Business Profile** for the Sanganer shop / workshop |

## Testing & quality (set up in Phase 5, used from Phase 2)

**Vitest** (unit/integration), **Playwright** (end-to-end, incl. mobile viewports), **axe** (accessibility), **Lighthouse CI** (performance/SEO), **k6** (load, on staging), **ESLint 9** (done in Step 0), **GitHub Actions** CI running typecheck + lint + tests + build on every push.

## Environments

| Env | Purpose | Data |
|---|---|---|
| Local | Development on your Mac | Local Postgres (Docker) or a Neon dev branch; Razorpay **test mode**; Shiprocket sandbox |
| Staging | Owner reviews every change before it goes live | Neon branch; test-mode payments |
| Production | The live shop | Live keys, backups, monitoring |
