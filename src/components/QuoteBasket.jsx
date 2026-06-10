import { useState } from 'react';
import { useQuote, aud } from '../stores/cart.js';

const EMAIL = 'admin@blacksquiddistillery.com.au';

/** Wholesale quote basket panel for /spak — builds one enquiry email. */
export default function QuoteBasket() {
  const { items, setQty, remove, clear } = useQuote();
  const [form, setForm] = useState({ name: '', business: '', email: '', message: '' });
  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const body = () => {
    const lines = items.map(
      (i) => `• ${i.title} — qty ${i.qty}${i.price ? `  (listed ${i.priceFrom ? 'from ' : ''}${aud(i.price)} ea)` : ''}`
    );
    return [
      'Hello Black Squid,',
      '',
      'I would like a wholesale quote for:',
      '',
      ...lines,
      '',
      form.message ? `Notes: ${form.message}` : null,
      '',
      `Name: ${form.name}`,
      form.business ? `Business: ${form.business}` : null,
      form.email ? `Reply to: ${form.email}` : null,
    ]
      .filter((l) => l !== null)
      .join('\n');
  };

  const send = () => {
    const url = `mailto:${EMAIL}?subject=${encodeURIComponent('SPAK wholesale quote request')}&body=${encodeURIComponent(body())}`;
    window.location.href = url;
  };

  return (
    <aside style={st.panel} aria-label="Quote request">
      <h3 style={st.h}>Request a quote</h3>
      {items.length === 0 ? (
        <p style={st.empty}>
          No items yet. Set a quantity on any bottle or closure and hit{' '}
          <em>Add to quote</em> — then send the lot as one enquiry.
        </p>
      ) : (
        <>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {items.map((i) => (
              <div key={i.slug} style={st.line}>
                <div style={{ flex: 1 }}>
                  <div style={st.t}>{i.title}</div>
                  {i.price > 0 && <div style={st.p}>{i.priceFrom ? 'from ' : ''}{aud(i.price)} ea</div>}
                </div>
                <input
                  type="number" min="1" value={i.qty}
                  onChange={(e) => setQty(i.slug, parseInt(e.target.value) || 1)}
                  aria-label={`Quantity for ${i.title}`}
                  style={st.qty}
                />
                <button onClick={() => remove(i.slug)} style={st.rm} aria-label={`Remove ${i.title}`}>✕</button>
              </div>
            ))}
          </div>

          <label style={st.lab}>Your name</label>
          <input value={form.name} onChange={f('name')} placeholder="Jane Distiller" />
          <label style={st.lab}>Business (optional)</label>
          <input value={form.business} onChange={f('business')} placeholder="Vale Spirits Co." />
          <label style={st.lab}>Email</label>
          <input type="email" value={form.email} onChange={f('email')} placeholder="you@business.com.au" />
          <label style={st.lab}>Notes (optional)</label>
          <textarea rows="2" value={form.message} onChange={f('message')} placeholder="Pickup or freight? Timing?" />

          <button className="btn solid" style={{ width: '100%', marginTop: 18, padding: '14px' }} onClick={send}>
            Send quote request
          </button>
          <button onClick={clear} style={st.clear}>clear list</button>
        </>
      )}
      <p style={st.fine}>
        Opens your email app addressed to {EMAIL} — final pricing is confirmed by email, including
        quantity breaks and freight.
      </p>
    </aside>
  );
}

const st = {
  panel: {
    position: 'sticky', top: 96, border: '1px solid rgba(141,150,163,0.25)',
    background: '#0c1016', padding: '26px 24px', borderRadius: 3,
  },
  h: { fontFamily: "'Fraunces', Georgia, serif", fontWeight: 480, fontSize: '1.4rem', marginBottom: 12 },
  empty: { color: '#8d96a3', fontSize: '0.88rem', lineHeight: 1.8 },
  line: { display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(141,150,163,0.12)' },
  t: { fontSize: '0.82rem', lineHeight: 1.35 },
  p: { color: '#8d96a3', fontSize: '0.72rem' },
  qty: { width: 64, padding: '6px 8px', fontSize: '0.82rem' },
  rm: { background: 'none', border: 'none', color: '#5d6573', fontSize: '0.8rem' },
  lab: { fontSize: '0.66rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8d96a3', display: 'block', margin: '14px 0 5px' },
  clear: { width: '100%', marginTop: 8, padding: 6, background: 'none', border: 'none', color: '#5d6573', fontSize: '0.68rem', textDecoration: 'underline' },
  fine: { color: '#5d6573', fontSize: '0.68rem', lineHeight: 1.7, marginTop: 16 },
};
