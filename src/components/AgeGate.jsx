import { useEffect, useState } from 'react';

const KEY = 'bsq-age-ok';

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = show ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [show]);

  if (!show) return null;

  const yes = () => {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
    setShow(false);
  };
  const no = () => { window.location.href = 'https://drinkwise.org.au'; };

  return (
    <div role="dialog" aria-modal="true" aria-label="Age verification" style={st.veil}>
      <div style={st.card}>
        <svg viewBox="0 0 48 48" fill="none" style={{ height: 52, margin: '0 auto 18px', display: 'block', color: '#5d7cf0' }} aria-hidden="true">
          <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.4" />
          <path d="M14 27c0-6 4.5-10.5 10-10.5S34 21 34 27c0 2.4-1 4-2.6 4-1.4 0-2.2-1-2.2-2.6 0-2.8-2-4.9-5.2-4.9s-5.2 2.1-5.2 4.9c0 1.6-.8 2.6-2.2 2.6C15 31 14 29.4 14 27Z" fill="currentColor" />
          <path d="M19 31.5c.2 2-.6 3.8-2.4 5M24 32.5v5.2M29 31.5c-.2 2 .6 3.8 2.4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <h2 style={st.h}>From the deep end of the Barossa.</h2>
        <p style={st.p}>
          Black Squid Distillery makes and sells alcohol. To enter, you must be of legal
          drinking age in your country — 18+ in Australia.
        </p>
        <div style={st.row}>
          <button onClick={yes} style={st.yes}>I am 18 or older — enter</button>
          <button onClick={no} style={st.no}>I&rsquo;m under 18</button>
        </div>
        <p style={st.fine}>We support the responsible consumption of alcohol.</p>
      </div>
    </div>
  );
}

const st = {
  veil: {
    position: 'fixed', inset: 0, zIndex: 999,
    background: 'radial-gradient(120% 100% at 50% 0%, rgba(12,16,22,0.97), rgba(7,9,13,0.99))',
    display: 'grid', placeItems: 'center', padding: 20, backdropFilter: 'blur(6px)',
  },
  card: { maxWidth: 430, textAlign: 'center', padding: '46px 34px', border: '1px solid rgba(141,150,163,0.25)', background: '#0c1016', borderRadius: 4 },
  h: { fontFamily: "'Fraunces', Georgia, serif", fontWeight: 480, fontSize: '1.7rem', lineHeight: 1.15, margin: '0 0 14px', color: '#ecedea' },
  p: { color: '#8d96a3', fontSize: '0.92rem', lineHeight: 1.7, margin: '0 0 26px' },
  row: { display: 'flex', flexDirection: 'column', gap: 10 },
  yes: {
    padding: '14px 20px', background: '#5d7cf0', color: '#07090d', border: '1px solid #5d7cf0',
    letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '0.74rem', fontWeight: 600,
  },
  no: {
    padding: '12px 20px', background: 'transparent', color: '#8d96a3', border: '1px solid rgba(141,150,163,0.35)',
    letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: '0.7rem',
  },
  fine: { marginTop: 20, fontSize: '0.68rem', color: '#5d6573', letterSpacing: '0.04em' },
};
