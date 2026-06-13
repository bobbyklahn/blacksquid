/**
 * Cloudflare Pages Function — POST /api/stripe-webhook
 * Stripe calls this on every completed checkout; we email a packing-slip
 * style order notification to the distillery inbox via Resend.
 *
 * Setup (see DEPLOY.md § Order notifications):
 *   1. Stripe Dashboard → Developers → Webhooks → Add endpoint
 *      URL:    https://YOUR-DOMAIN/api/stripe-webhook
 *      Events: checkout.session.completed, checkout.session.async_payment_succeeded
 *   2. Env vars (Cloudflare Pages → Settings → Variables):
 *        STRIPE_WEBHOOK_SECRET  — the endpoint's signing secret (whsec_…)
 *        STRIPE_SECRET_KEY      — already set for checkout
 *        RESEND_API_KEY         — resend.com API key
 *        ORDER_EMAIL_TO         — where order emails go
 *      Optional:
 *        ORDER_EMAIL_FROM       — verified sender, default onboarding@resend.dev
 *        PICKUP_RATE_ID         — already set; used to flag pickup orders
 *
 * On email failure we return 500 so Stripe retries (and surfaces the
 * failure in Dashboard → Webhooks). Stripe may rarely deliver an event
 * twice — worst case is a duplicate email, which is fine here.
 */

const enc = new TextEncoder();

function timingSafeEqual(a, b) {
  if (typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload, header, secret) {
  if (!header) return false;
  let t = null;
  const v1s = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't') t = v;
    else if (k === 'v1') v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return v1s.some((sig) => timingSafeEqual(expected, sig));
}

const aud = (cents) => `A$${(cents / 100).toFixed(2)}`;

function formatAddress(name, addr) {
  if (!addr) return null;
  return [name, addr.line1, addr.line2, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(' '), addr.country]
    .filter(Boolean)
    .join('\n  ');
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    console.error('stripe-webhook: missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY');
    return new Response('Not configured', { status: 500 });
  }

  const payload = await request.text();
  const valid = await verifyStripeSignature(
    payload,
    request.headers.get('stripe-signature'),
    env.STRIPE_WEBHOOK_SECRET,
  );
  if (!valid) return new Response('Bad signature', { status: 400 });

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response('Bad payload', { status: 400 });
  }

  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return new Response('Ignored', { status: 200 });
  }

  const session = event.data.object;
  // Async payment methods complete the session before the money clears —
  // skip and act on the async_payment_succeeded event instead.
  if (session.payment_status === 'unpaid') return new Response('Awaiting payment', { status: 200 });

  const stripeAuth = { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };

  // Line items aren't included in the event — fetch them.
  let lineItems = [];
  const liRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items?limit=100`,
    { headers: stripeAuth },
  );
  if (liRes.ok) {
    lineItems = (await liRes.json()).data ?? [];
  } else {
    console.error('stripe-webhook: line_items fetch failed', liRes.status);
  }

  // Shipping option chosen (display name lives on the rate, not the session)
  const rateId = session.shipping_cost?.shipping_rate;
  const isPickup = Boolean(rateId && env.PICKUP_RATE_ID && rateId === env.PICKUP_RATE_ID);
  let shipLabel = isPickup ? 'Local pickup' : 'Shipping';
  if (rateId) {
    try {
      const rr = await fetch(`https://api.stripe.com/v1/shipping_rates/${rateId}`, { headers: stripeAuth });
      if (rr.ok) shipLabel = (await rr.json()).display_name || shipLabel;
    } catch {
      /* label fallback is fine */
    }
  }

  const cust = session.customer_details ?? {};
  // shipping_details moved under collected_information in newer API versions
  const ship = session.shipping_details ?? session.collected_information?.shipping_details ?? null;
  const fields = Object.fromEntries(
    (session.custom_fields ?? []).map((f) => [f.key, f[f.type]?.value]),
  );

  const lines = [];
  lines.push(`NEW ORDER — ${aud(session.amount_total)} (${session.payment_status})`);
  if (isPickup) lines.push('*** LOCAL PICKUP — Vine Vale — no postage ***');
  lines.push('');
  lines.push('Customer');
  lines.push(`  ${[cust.name, cust.email, cust.phone].filter(Boolean).join('\n  ')}`);
  lines.push('');
  const addr = formatAddress(ship?.name ?? cust.name, ship?.address ?? cust.address);
  if (addr) {
    lines.push(isPickup ? 'Pickup order — address on file' : `Deliver to (${shipLabel})`);
    lines.push(`  ${addr}`);
    lines.push('');
  }
  lines.push('Items');
  for (const li of lineItems) {
    lines.push(`  ${li.quantity} × ${li.description} — ${aud(li.amount_total)}`);
  }
  lines.push(`  Subtotal ${aud(session.amount_subtotal)}`);
  if (session.total_details?.amount_discount > 0) {
    lines.push(`  Discount −${aud(session.total_details.amount_discount)}`);
  }
  if (session.shipping_cost) {
    lines.push(`  ${shipLabel} ${aud(session.shipping_cost.amount_total)}`);
  }
  lines.push(`  Total ${aud(session.amount_total)}`);
  lines.push('');
  if (fields.gift_message) {
    lines.push(`Gift message: ${fields.gift_message}`);
  }
  lines.push(`18+ confirmed at checkout: ${fields.age_confirm ?? 'n/a'} (adult signature on delivery)`);
  lines.push('');
  lines.push(
    `Stripe: https://dashboard.stripe.com/${session.livemode ? '' : 'test/'}payments/${session.payment_intent}`,
  );

  if (!env.RESEND_API_KEY || !env.ORDER_EMAIL_TO) {
    console.error('stripe-webhook: missing RESEND_API_KEY or ORDER_EMAIL_TO — order email not sent');
    return new Response('Email not configured', { status: 500 });
  }

  const subject =
    `${session.livemode ? '' : '[TEST] '}New order ${aud(session.amount_total)}` +
    `${cust.name ? ` — ${cust.name}` : ''}${isPickup ? ' [PICKUP]' : ''}`;

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.ORDER_EMAIL_FROM || 'Black Squid Orders <onboarding@resend.dev>',
      to: env.ORDER_EMAIL_TO,
      reply_to: cust.email || undefined,
      subject,
      text: lines.join('\n'),
    }),
  });

  if (!emailRes.ok) {
    console.error('stripe-webhook: Resend error', emailRes.status, await emailRes.text());
    return new Response('Email failed', { status: 500 }); // Stripe will retry
  }
  return new Response('OK', { status: 200 });
}
