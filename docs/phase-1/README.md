# Phase 1: Architecture (summary for the owner)

**Status:** finished and **approved on 11 Oct 2026**: all six recommended options below (new URLs, wholesale prices "+ GST", invoice on order confirmation, 30-minute payment window, Hindi after launch, services as listed).
**Visual preview:** https://claude.ai/artifact/K3JzuooLvaRMZNCM6FiVcH (style guide, homepage, phone product page, admin "edit product" screen). It's private to your account. Use its Share menu if you want family or staff to see it.

## What's in this folder

| File | What it covers |
|---|---|
| [01-tech-stack.md](01-tech-stack.md) | Software and services: what each is for, which cost money, and what you need to sign up for |
| [02-design-system.md](02-design-system.md) | Colours, fonts, buttons, photo rules, mobile-first rules, accessibility |
| [03-site-map.md](03-site-map.md) | Every page of the shop, the customer portal and the admin panel, with web addresses |
| [04-data-model.md](04-data-model.md) | How data is stored: stock, prices, GST maths, invoices, numbering |
| [05-state-machines.md](05-state-machines.md) | The step-by-step life of an order, payment, shipment, return, refund and wholesale application |
| [06-code-structure-and-api.md](06-code-structure-and-api.md) | Folder layout, every API route, staff roles and permissions |
| [target-schema.prisma](target-schema.prisma) | The new database design: 66 tables, checked and valid for PostgreSQL |

## The big ideas, in plain words

1. **One shop, two kinds of buyers.** Retail customers see retail prices. Approved wholesale buyers see their tier price, minimum quantity and size sets on the same pages.
2. **You control everything from admin.** Products, prices, stock, photo order, categories, filters, homepage sections, banners, policies, FAQs, shipping and COD charges, GST rates, return window, message wording and staff permissions are all editable. No developer needed.
3. **The full journey is tracked.** Sign-up → order → payment → GST invoice → packing → courier → delivery → return → refund. The customer sees it as one timeline, and you get notified at every step.
4. **Money is exact.** Prices include GST for retail (as the law expects), GST is calculated per line and split correctly (CGST + SGST in Rajasthan, IGST elsewhere), and invoice numbers have no gaps.
5. **Stock can't go wrong silently.** Stock lives in one place per size/colour, every change has a reason, unpaid orders release stock automatically, and two people can't buy the last piece.

## Decisions I need from you (my recommendation first)

| # | Question | Recommended | Alternative |
|---|---|---|---|
| 1 | New web addresses like `/kurtis` and `/products/indigo-buti-…` (better for Google; the site isn't live yet, so nothing is lost) | ✅ Yes | Keep `/category/…` and `/product/…` |
| 2 | Wholesale prices shown as **"₹749 + GST"** (normal in the trade) | ✅ + GST | Including GST |
| 3 | When is the GST invoice created? | ✅ When the order is confirmed (paid or COD accepted) | When it ships |
| 4 | Unpaid online orders release their stock after | ✅ 30 minutes | 15 / 60 minutes |
| 5 | Hindi version of the site | ✅ After launch (the structure is ready now) | At launch |
| 6 | OK to use the services in [01-tech-stack.md](01-tech-stack.md)? Hosting needs Vercel Pro (the free plan is non-commercial only). Razorpay and Shiprocket charge per order. | ✅ Yes | Suggest others |

## Start these now. They take days and only you can do them

- **Razorpay** business account + KYC
- **Shiprocket** account + Sanganer pickup address
- **TRAI DLT registration** for SMS (business, sender ID, message templates). It's required for OTP and order SMS in India
- **WhatsApp Business** verification on Meta (through a provider like Interakt / AiSensy / Gupshup)
- Buy the **domain name** (e.g. hastkalafab.com, if it's yours)

## Questions for your CA (I won't guess these)

1. HSN code and GST rate for each product type (kurtis, salwar suits / dress material, sarees, bedsheets, dupattas, fabric by the metre), including price-band rules.
2. How to treat prices that sit right on a GST band boundary when prices include GST.
3. GST on the shipping charge and COD fee: the item's rate or the highest rate in the order?
4. Is e-invoicing (IRN) needed at your turnover?
5. Should invoice totals be rounded to the nearest rupee?

## What Phase 2 builds, in this order

1. Switch to PostgreSQL with the new database design, and keep everything that already works.
2. Payments (Razorpay + COD) → GST invoices → shipping & tracking (Shiprocket).
3. Returns, refunds, store credit, and notifications (email, SMS, WhatsApp).
4. Phone-OTP login, guest checkout, wholesale application and wholesale portal.
5. The full admin panel (everything in [03-site-map.md](03-site-map.md) section C), with drag-and-drop ordering.
6. All missing pages (legal, track order, wholesale, our craft, FAQ, contact), then the new design applied across the site.
