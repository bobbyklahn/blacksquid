/**
 * Cloudflare Pages Function — POST /api/checkout
 * Creates a Stripe Checkout Session from the cart.
 *
 * Prices are validated server-side against functions/pricemap.json,
 * which is generated from src/content/spirits at build time —
 * the browser can never set its own price.
 *
 * Required env var (Cloudflare Pages → Settings → Variables):
 *   STRIPE_SECRET_KEY      — your Stripe secret key (use the test key first)
 * Optional:
 *   SHIPPING_RATE_ID       — standard Stripe Shipping Rate (shr_…)
 *   PICKUP_RATE_ID         — a free "Local pickup — Vine Vale" rate, shown as a 2nd option
 *   FREE_SHIPPING_RATE_ID  — free-shipping rate (shr_…) used when the threshold is met
 *   FREE_OVER_CENTS        — cart total (in cents) that unlocks free shipping, e.g. 15000 = A$150
 *
 * Discount codes: create Coupons + Promotion Codes in the Stripe Dashboard
 * (Products → Coupons). The checkout page shows an "Add promotion code" field
 * automatically — no code changes needed here.
 */
import priceMap from '../pricemap.json';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Checkout is not configured yet (missing Stripe key).' }, 503);
  }

  let items;
  try {
    ({ items } = await request.json());
  } catch {
    return json({ error: 'Bad request' }, 400);
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
    return json({ error: 'Cart is empty.' }, 400);
  }

  const origin = new URL(request.url).origin;
  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('success_url', `${origin}/thanks?sid={CHECKOUT_SESSION_ID}`);
  p.set('cancel_url', `${origin}/gins`);
  p.set('phone_number_collection[enabled]', 'true');
  p.set('shipping_address_collection[allowed_countries][0]', 'AU');
  p.set('payment_intent_data[description]', 'Black Squid Distillery — online order (18+)');
  p.set('allow_promotion_codes', 'true'); // discount codes managed in Stripe Dashboard

  // 18+ confirmation inside Stripe Checkout (site also gates on entry;
  // adult signature on delivery is handled by the courier).
  p.set('custom_fields[0][key]', 'age_confirm');
  p.set('custom_fields[0][label][type]', 'custom');
  p.set('custom_fields[0][label][custom]', 'I confirm I am 18 or older');
  p.set('custom_fields[0][type]', 'dropdown');
  p.set('custom_fields[0][dropdown][options][0][label]', 'Yes, I am 18 or older');
  p.set('custom_fields[0][dropdown][options][0][value]', 'yes');

  // optional gift message, printed on the packing note
  p.set('custom_fields[1][key]', 'gift_message');
  p.set('custom_fields[1][label][type]', 'custom');
  p.set('custom_fields[1][label][custom]', 'Gift message (optional)');
  p.set('custom_fields[1][type]', 'text');
  p.set('custom_fields[1][optional]', 'true');

  let n = 0;
  let totalCents = 0;
  for (const it of items) {
    const entry = priceMap[it.slug];
    if (!entry) return json({ error: `Unknown product: ${it.slug}` }, 400);
    if (entry.soldOut) return json({ error: `${entry.title} is sold out.` }, 400);
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    totalCents += entry.amount * qty;
    p.set(`line_items[${n}][quantity]`, String(qty));
    p.set(`line_items[${n}][price_data][currency]`, 'aud');
    p.set(`line_items[${n}][price_data][unit_amount]`, String(entry.amount));
    p.set(`line_items[${n}][price_data][product_data][name]`, entry.title);
    if (entry.image) {
      p.set(`line_items[${n}][price_data][product_data][images][0]`, `${origin}${entry.image}`);
    }
    n++;
  }

  // shipping: free over threshold > standard rate; local pickup always offered if set
  let s = 0;
  const freeUnlocked =
    env.FREE_SHIPPING_RATE_ID && env.FREE_OVER_CENTS && totalCents >= parseInt(env.FREE_OVER_CENTS, 10);
  if (freeUnlocked) {
    p.set(`shipping_options[${s++}][shipping_rate]`, env.FREE_SHIPPING_RATE_ID);
  } else if (env.SHIPPING_RATE_ID) {
    p.set(`shipping_options[${s++}][shipping_rate]`, env.SHIPPING_RATE_ID);
  }
  if (env.PICKUP_RATE_ID) {
    p.set(`shipping_options[${s++}][shipping_rate]`, env.PICKUP_RATE_ID);
  }

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: p.toString(),
  });

  const session = await r.json();
  if (!r.ok) {
    console.error('Stripe error:', session?.error?.message);
    return json({ error: session?.error?.message ?? 'Stripe rejected the request.' }, 502);
  }
  return json({ url: session.url });
}
