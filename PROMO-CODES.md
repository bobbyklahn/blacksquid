# Promo / discount codes — operator runbook

Discount **codes** live in the **Stripe Dashboard**, not in `/admin`. The checkout
already shows an **"Add promotion code"** field automatically
(`functions/api/checkout.js` sets `allow_promotion_codes=true`) — you just create
the codes in Stripe and they work immediately. No code change, no deploy.

> Per-product **sale prices** are different — those you set in `/admin` (the
> "Sale price" field on each spirit), and they change the price everyone pays.
> Use a **promo code** when you want a discount only for people who type a code.

---

## ⚠️ One rule for this site: codes apply to the WHOLE order

Our checkout sends each cart line as an **ad-hoc price** (not a saved Stripe
Product). So a Stripe coupon that's **"restricted to specific products"** will
**not match anything** and won't discount the order.

- ✅ **Works:** "15% off the whole order", "$20 off the whole order", "free-shipping-threshold style minimums".
- ❌ **Does NOT work:** "20% off *just the Klahn Trio*", "$10 off *only the Hemp Gin*".

If you want a single product cheaper, use its **Sale price in /admin** instead.

Free shipping is handled separately by the `FREE_OVER_CENTS` env var, **not** by a
coupon — see `DEPLOY.md`.

---

## Create a code (≈2 minutes)

1. Stripe Dashboard → **Product catalog → Coupons → + New** (or **Create coupon**).
2. Pick the discount:
   - **Percentage** (e.g. `10%`) — applies to the order subtotal, or
   - **Fixed amount** — set currency to **AUD** (it must match the order).
3. **Duration:** choose **Once**. (We're one-off payments, not subscriptions —
   "forever/repeating" only matter for subscriptions.)
4. Save the coupon, then **Add a promotion code** to it — *this* is the text the
   customer types, e.g. `BAROSSA10`, `XMAS25`. (Codes are case-insensitive.)
5. Optional limits on the promotion code:
   - **Expiry date** — e.g. ends 31 Dec.
   - **Max redemptions** — total uses, e.g. first 100 orders.
   - **Minimum order amount** — e.g. only on orders over A$120.
   - **First-time customers only** — restrict to new customers.

Done. The code is live at checkout straight away.

## Test it first (recommended)

Stripe has a **Test mode** toggle (top of the dashboard). Create the code in Test
mode, then on the site use Stripe's test card `4242 4242 4242 4242`, any future
expiry, any CVC. When happy, recreate the **same code in Live mode** — test and
live are separate and codes do **not** copy across.

## Turn a code off

Promotion code → **Deactivate** (stops new uses; existing orders unaffected).
You can deactivate the code but keep the coupon for reuse later.

## Common recipes

| Goal | Coupon | Promotion code settings |
|---|---|---|
| Launch week, 10% off everything | 10% off, Once | code `LAUNCH10`, expires in 7 days |
| $25 off orders over $150 | A$25 off, Once | min order A$150 |
| Mailing-list welcome, one per customer | 10% off, Once | First-time customers only |
| Limited first 50 buyers | 15% off, Once | max redemptions = 50 |

## What you can't do here (by design)

- Discount a **single product** with a code → use its **Sale price in /admin**.
- Stack a code **on top of** an /admin sale → it stacks (the code comes off the
  already-discounted subtotal). Avoid running both unless you mean to.
- **Free shipping code** → not via coupons; we unlock free shipping by order
  total (`FREE_OVER_CENTS`). Ask the dev to change the threshold.
