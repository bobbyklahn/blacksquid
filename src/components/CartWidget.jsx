import { useEffect, useState } from 'react';
import { useCart, aud } from '../stores/cart.js';

export default function CartWidget() {
  const { items, open, setOpen, setQty, remove, clear, reconcile, add } = useCart();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [mounted, setMounted] = useState(false); // avoid SSR/localStorage hydration flash
  const [catalog, setCatalog] = useState(null); // fresh prices.json, for reconcile + cross-sell

  const count = items.reduce((n, i) => n + i.qty, 0);
  const available = items.filter((i) => !i.unavailable);
  const hasUnavailable = items.some((i) => i.unavailable);
  const total = available.reduce((n, i) => n + i.qty * i.price, 0);

  // "Complete the set" — up to 2 products not yet in the cart (prices.json is pre-sorted)
  const inCart = new Set(items.map((i) => i.slug));
  const suggestions = catalog
    ? Object.entries(catalog)
        .filter(([slug, p]) => !inCart.has(slug) && !p.soldOut)
        .slice(0, 2)
    : [];

  useEffect(() => setMounted(true), []);

  // when the drawer opens: refresh prices/availability, lock scroll, listen for Esc
  useEffect(() => {
    if (!open) return;
    fetch('/prices.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((map) => {
        if (map) {
          reconcile(map);
          setCatalog(map);
        }
      })
      .catch(() => {});
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const checkout = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: available.map((i) => ({ slug: i.slug, qty: i.qty })) }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) throw new Error(data.error || 'Checkout unavailable');
      window.location.href = data.url;
    } catch (e) {
      setErr(e.message || 'Checkout unavailable right now.');
      setBusy(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(!open)} aria-label={`Cart, ${count} items`} style={st.btn}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ width: 19 }} aria-hidden="true">
          <path d="M3 4h2l2.4 12.2a1.4 1.4 0 0 0 1.38 1.13h8.6a1.4 1.4 0 0 0 1.37-1.07L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="20.4" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="17.5" cy="20.4" r="1.3" fill="currentColor" stroke="none" />
        </svg>
        {mounted && count > 0 && <span style={st.badge}>{count}</span>}
      </button>

      {mounted && open && (
        <div style={st.veil} onClick={() => setOpen(false)}>
          <aside style={st.drawer} onClick={(e) => e.stopPropagation()} aria-label="Shopping cart" role="dialog" aria-modal="true">
            <div style={st.head}>
              <strong style={st.title}>Your cart</strong>
              <button onClick={() => setOpen(false)} style={st.x} aria-label="Close cart">✕</button>
            </div>

            {items.length === 0 ? (
              <p style={st.empty}>The cart is empty — the ocean is full.<br /><a href="/gins" style={{ color: '#5d7cf0' }}>Explore the gins →</a></p>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {items.map((i) => (
                    <div key={i.slug} style={{ ...st.line, opacity: i.unavailable ? 0.55 : 1 }}>
                      <div style={{ flex: 1 }}>
                        <div style={st.lineTitle}>{i.title}</div>
                        {i.unavailable
                          ? <div style={st.gone}>no longer available — please remove</div>
                          : <div style={st.linePrice}>{aud(i.price)}</div>}
                      </div>
                      {!i.unavailable && (
                        <div style={st.qtyRow}>
                          <button style={st.qbtn} onClick={() => setQty(i.slug, i.qty - 1)} aria-label="Decrease">−</button>
                          <span style={st.qty}>{i.qty}</span>
                          <button style={st.qbtn} onClick={() => setQty(i.slug, i.qty + 1)} aria-label="Increase">+</button>
                        </div>
                      )}
                      <button style={st.rm} onClick={() => remove(i.slug)} aria-label={`Remove ${i.title}`}>remove</button>
                    </div>
                  ))}
                </div>

                {suggestions.length > 0 && (
                  <div style={st.xsell}>
                    <p style={st.xsellHead}>Complete the set</p>
                    {suggestions.map(([slug, p]) => (
                      <div key={slug} style={st.xsellRow}>
                        {p.image && <img src={p.image} alt="" width="34" height="44" style={st.xsellImg} loading="lazy" />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={st.xsellTitle}>{p.title}</div>
                          <div style={st.linePrice}>{aud(p.price)}</div>
                        </div>
                        <button style={st.xsellAdd} onClick={() => add({ slug, title: p.title, price: p.price })}>
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={st.foot}>
                  <div style={st.totalRow}><span>Total</span><strong>{aud(total)}</strong></div>
                  <p style={st.fine}>
                    Shipping &amp; discount codes at checkout · 18+ only · ID may be checked on delivery
                  </p>
                  {err && <p style={st.err}>{err}</p>}
                  <button onClick={checkout} disabled={busy || hasUnavailable || available.length === 0} style={{ ...st.checkout, opacity: busy || hasUnavailable || available.length === 0 ? 0.5 : 1 }}>
                    {busy ? 'Opening secure checkout…' : 'Checkout — card / Apple Pay'}
                  </button>
                  {hasUnavailable && <p style={st.err}>Remove the unavailable item{items.filter((i) => i.unavailable).length > 1 ? 's' : ''} to continue.</p>}
                  <button onClick={clear} style={st.clear}>empty cart</button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}

const st = {
  btn: { position: 'relative', background: 'none', border: 'none', color: 'inherit', display: 'flex', alignItems: 'center', padding: 4 },
  badge: {
    position: 'absolute', top: -7, right: -9, background: '#e08cb4', color: '#07090d',
    borderRadius: 99, fontSize: '0.62rem', fontWeight: 700, minWidth: 16, height: 16,
    display: 'grid', placeItems: 'center', padding: '0 4px',
  },
  veil: { position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(7,9,13,0.6)', backdropFilter: 'blur(3px)' },
  drawer: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(430px, 94vw)', zIndex: 91,
    background: '#0c1016', borderLeft: '1px solid rgba(141,150,163,0.25)',
    display: 'flex', flexDirection: 'column', padding: '22px 24px',
    textTransform: 'none', letterSpacing: 'normal',
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(141,150,163,0.18)' },
  title: { fontFamily: "'Fraunces', Georgia, serif", fontSize: '1.25rem', fontWeight: 480 },
  x: { background: 'none', border: 'none', color: '#8d96a3', fontSize: '1rem' },
  empty: { color: '#8d96a3', marginTop: 30, lineHeight: 2, fontSize: '0.95rem' },
  line: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 0', borderBottom: '1px solid rgba(141,150,163,0.12)' },
  lineTitle: { fontSize: '0.88rem', lineHeight: 1.4 },
  linePrice: { color: '#8d96a3', fontSize: '0.8rem', marginTop: 2 },
  gone: { color: '#e08cb4', fontSize: '0.74rem', marginTop: 2, fontStyle: 'italic' },
  qtyRow: { display: 'flex', alignItems: 'center', gap: 8 },
  qbtn: { width: 26, height: 26, background: 'transparent', color: '#ecedea', border: '1px solid rgba(141,150,163,0.35)', borderRadius: 2 },
  qty: { minWidth: 18, textAlign: 'center', fontSize: '0.9rem' },
  rm: { background: 'none', border: 'none', color: '#5d6573', fontSize: '0.68rem', textDecoration: 'underline' },
  xsell: { padding: '14px 0 10px', borderTop: '1px dashed rgba(141,150,163,0.25)' },
  xsellHead: { fontSize: '0.64rem', letterSpacing: '0.26em', textTransform: 'uppercase', color: '#c2a878', margin: '0 0 8px' },
  xsellRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' },
  xsellImg: { width: 34, height: 44, objectFit: 'contain', background: '#11161f', border: '1px solid rgba(141,150,163,0.2)', borderRadius: 2, flexShrink: 0 },
  xsellTitle: { fontSize: '0.78rem', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  xsellAdd: { background: 'transparent', color: '#5d7cf0', border: '1px solid rgba(93,124,240,0.5)', borderRadius: 2, padding: '6px 12px', fontSize: '0.68rem', letterSpacing: '0.1em', whiteSpace: 'nowrap' },
  foot: { paddingTop: 16, borderTop: '1px solid rgba(141,150,163,0.18)' },
  totalRow: { display: 'flex', justifyContent: 'space-between', fontFamily: "'Fraunces', Georgia, serif", fontSize: '1.15rem', marginBottom: 6 },
  fine: { color: '#5d6573', fontSize: '0.68rem', lineHeight: 1.6, margin: '4px 0 12px' },
  err: { color: '#e08cb4', fontSize: '0.78rem', margin: '8px 0' },
  checkout: {
    width: '100%', padding: '15px 18px', background: '#5d7cf0', color: '#07090d',
    border: 'none', letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: '0.74rem', fontWeight: 600,
  },
  clear: { width: '100%', marginTop: 8, padding: 8, background: 'none', border: 'none', color: '#5d6573', fontSize: '0.68rem', textDecoration: 'underline' },
};
