# Black Squid Distillery — Deploy Guide

From this folder to a live site in ~30 minutes. Stack: **Astro (static) → GitHub → Cloudflare Pages**, Stripe checkout via a serverless function, product admin at `/admin`.

---

## 0. Run it locally first

```bash
npm install
npm run dev        # → http://localhost:4321
```

You'll see everything except checkout (that needs the Stripe key, step 4).

## 1. Push to GitHub

```bash
git init && git add -A && git commit -m "Black Squid site v1"
# create an empty repo on github.com (e.g. blacksquid-site), then:
git remote add origin https://github.com/YOUR_USERNAME/blacksquid-site.git
git push -u origin main
```

## 2. Connect Cloudflare Pages

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
2. Build settings: framework **Astro**, build command `npm run build`, output `dist`. Deploy.
3. You now have `https://blacksquid-site.pages.dev` — every `git push` (or CMS save) redeploys automatically.

## 3. Custom domain (fixes the apex bug too)

In the Pages project → **Custom domains** → add `www.blacksquiddistillery.com.au` **and** `blacksquiddistillery.com.au`.
Cloudflare walks you through pointing DNS. Once both resolve, the naked domain finally works (it currently errors on Squarespace).

> ⚠️ **Before cancelling Squarespace:** if the domain is registered *through* Squarespace, transfer it to an AU registrar first (.com.au needs your ABN). If it's registered elsewhere, just repoint DNS. Check email hosting too.

## 4. Stripe checkout (one env var)

1. Pages project → **Settings → Variables and Secrets** → add `STRIPE_SECRET_KEY` (secret).
   Start with your **test** key (`sk_test_…`), buy something with card `4242 4242 4242 4242`, then swap to the live key.
2. Apple Pay works automatically on Stripe's hosted checkout — nothing to do.
3. **Confirm with Stripe that your account is enabled for alcohol sales** (permitted in AU with a liquor licence — check Stripe Dashboard → Settings → Business).

Prices come from `functions/pricemap.json`, generated at every build from the product files — the browser can never alter a price.

### Discount codes (already wired up)

Checkout shows an **"Add promotion code"** field automatically. To create codes:
Stripe Dashboard → **Products → Coupons → New** (e.g. 10% off) → **Add promotion code** (e.g. `SQUID10`).
Limits (first order only, expiry date, minimum amount, max redemptions) are all set there. No site changes needed.

### Shipping options (all optional env vars)

Create Shipping Rates in Stripe (Products → Shipping rates), then add any of these variables:

| Variable | What it does |
|---|---|
| `SHIPPING_RATE_ID` | standard postage (shr_…) |
| `PICKUP_RATE_ID` | a $0 "Local pickup — Vine Vale" rate, offered alongside postage |
| `FREE_SHIPPING_RATE_ID` + `FREE_OVER_CENTS` | free shipping once the cart hits the threshold (e.g. `15000` = free over A$150) |

### Gift messages

Checkout asks for an optional gift message; it arrives with the order in your Stripe dashboard/email.

### Abandoned carts

Stripe can email people who started checkout but didn't pay: Dashboard → Settings → **Checkout → Recovery emails** (toggle on).

## 4½. Order notifications & order management

### You get an order email (the packing slip)

`functions/api/stripe-webhook.js` listens for completed checkouts and emails you everything needed to pack the order: items, delivery address, phone, shipping option (pickup orders are flagged **[PICKUP]** in the subject), gift message, 18+ confirmation, and a direct link to the payment in Stripe. **Reply** to the email and it goes straight to the customer. One-time setup:

1. **Resend account** (free, 100 emails/day — plenty): [resend.com](https://resend.com) → create an API key.
   - Out of the box it sends from `onboarding@resend.dev`, which only delivers **to the email you signed up to Resend with** — fine to start.
   - To send from `orders@blacksquiddistillery.com.au` (and deliver anywhere): Resend → Domains → add the domain → add the DNS records it shows (takes ~5 min once DNS is on Cloudflare), then set `ORDER_EMAIL_FROM`.
2. **Stripe webhook**: Dashboard → **Developers → Webhooks → Add endpoint**.
   - URL: `https://blacksquid.pages.dev/api/stripe-webhook` (update to the custom domain after go-live)
   - Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
   - Copy the **signing secret** (`whsec_…`).
   - Test mode and live mode have separate webhooks/secrets — set up test first, repeat for live when you flip the key.
3. **Pages env vars** (Settings → Variables and Secrets):

   | Variable | Value |
   |---|---|
   | `STRIPE_WEBHOOK_SECRET` | the `whsec_…` from step 2 (secret) |
   | `RESEND_API_KEY` | from step 1 (secret) |
   | `ORDER_EMAIL_TO` | where order emails go, e.g. `bocaca@gmail.com` |
   | `ORDER_EMAIL_FROM` | *(optional)* `Black Squid Orders <orders@blacksquiddistillery.com.au>` once the domain is verified |

   Then redeploy (Deployments → ⋯ → Retry) so the function picks them up.
4. **Test it**: buy something with `4242 4242 4242 4242` — the email arrives with a `[TEST]` subject. Dashboard → Webhooks shows every delivery and any failures (failed sends are retried automatically).

Want a phone buzz too? Install the **Stripe mobile app** — push notification on every payment, refunds from your pocket.

### The customer gets a receipt

Stripe sends these — no code: Dashboard → **Settings → Emails** → turn on **Successful payments** (and **Refunds**). Live mode only; test mode never sends customer receipts.

### Managing orders

For this volume the **Stripe Dashboard → Payments** list *is* the order book — each payment shows items, address, phone, gift message; search by name/email; refund from the same screen (customer is auto-emailed if receipt emails are on). Day-to-day flow:

1. Order email arrives → pack from it (it has everything, including the gift note).
2. Ship it, then reply to the order email with the tracking number — it goes to the customer.
3. Refunds/disputes → the Stripe link in the email.

If volume grows enough that you need fulfilment statuses (open/packed/shipped) across many orders a day, the next step is storing orders in a small database with an orders board — easy to bolt on later since the webhook already receives every order.

## 5. The admin backend (`/admin`)

The CMS is Sveltia (Decap-compatible). It edits the GitHub repo directly; every save = commit = automatic redeploy (~1 min). One-time setup:

1. Deploy the tiny auth worker: [github.com/sveltia/sveltia-cms-auth](https://github.com/sveltia/sveltia-cms-auth) — click **Deploy to Cloudflare Workers**.
2. Create a GitHub **OAuth App** (Settings → Developer settings): callback URL = `https://YOUR-WORKER.workers.dev/callback`. Put its Client ID/Secret into the worker's env vars (the repo README shows exactly where).
3. Edit `public/admin/config.yml` — set `repo:` to your GitHub repo and `base_url:` to the worker URL. Commit.
4. Open `https://www.blacksquiddistillery.com.au/admin` → **Sign in with GitHub** → you can now add/edit spirits, SPAK bottles and journal posts, upload photos, mark things sold out, change prices.

No CMS yet? No problem — products are plain JSON in `src/content/spirits/` and `src/content/bottles/`; edit, push, done.

## 6. Photos

Product images are currently elegant placeholders. Replace them:

- **Via /admin** (easiest): edit each spirit → upload photos → save.
- Or export your photos from Squarespace and drop them in `public/images/products/`, updating each product's `images` path.

## 7. Go-live checklist

- [x] ABN done (92 645 592 945). **Liquor licence number still to add** in `src/layouts/BaseLayout.astro` footer — legally required before launch (it’s on your bottle labels).
- [x] SPAK warehouse address confirmed: 22 Priority Court, Edinburgh North SA 5113 (old site’s “5352” was a typo — now fixed).
- [ ] The Klahn Trio bundle is priced at A$230 (vs A$255 separately) — adjust in /admin if you want a different discount, and shoot a real trio photo when you can.
- [ ] Dragon Fire gin had no description on the old site — I drafted one (`src/content/spirits/klahn-barossa-valley-shiraz-gin-50.json`). Check it reads true.
- [ ] Stills blurbs on `/distillery` are lightly expanded from your originals — verify Tinny/Lucy/Katrina/Bertha details. Tinny currently uses the still-house interior photo; swap in her own shot when you have one.
- [ ] `/contract-distilling` reuses your old copy plus elaboration (the 4-step process, SPAK bottling tie-in) — read it once before launch.
- [ ] Instagram/Facebook URLs in the footer are guesses — point them at your real profiles.
- [x] Test checkout in Stripe **test mode** end to end (worked with shipping ✓).
- [ ] Set up order emails + webhook (§ 4½) and turn on customer receipt emails — remember to recreate the webhook with the **live** signing secret when you swap to the live key.
- [ ] Old URLs (`/shop`, `/shop/p/...`, `/thestills`) 301-redirect already (`public/_redirects`) — spot-check after launch.
- [ ] Then cancel Squarespace 🎉 (you were paying ~A$26–46/mo; this stack is ~A$0/mo + Stripe's per-sale fee).

## What's where

```
src/content/spirits/   ← the 7 gins (JSON — edit via /admin or by hand)
src/content/bottles/   ← the 14 SPAK SKUs
src/content/journal/   ← blog posts (markdown)
src/pages/             ← all pages; index.astro is the homepage
src/components/        ← cart, age gate, quote basket (React)
src/scripts/ink-hero.js← the colour-changing WebGL hero
functions/api/checkout.js ← Stripe serverless function
functions/api/stripe-webhook.js ← order notification emails
public/admin/          ← the CMS
```
