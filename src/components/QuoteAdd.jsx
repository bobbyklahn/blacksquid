import { useState } from 'react';
import { useQuote } from '../stores/cart.js';

/** Add a Squid Supply Co. bottle/closure SKU to the wholesale quote basket.
 *  Bottles are sold by the pallet, so a bottle's default qty / step / minimum
 *  is its `perPallet` count. Closures fall back to a flat, flexible default. */
export default function QuoteAdd({ slug, title, price, priceFrom, perPallet, defaultQty = 600, step = 50, minQty = 1 }) {
  const add = useQuote((s) => s.add);
  const [qty, setQty] = useState(defaultQty);
  const [added, setAdded] = useState(false);

  const submit = () => {
    add({ slug, title, price, priceFrom, perPallet }, Math.max(minQty, qty || minQty));
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <input
        type="number"
        min={minQty}
        step={step}
        value={qty}
        onChange={(e) => setQty(parseInt(e.target.value) || 0)}
        aria-label={`Quantity for ${title}`}
        style={{ width: 78, padding: '8px 6px', fontSize: '0.85rem', textAlign: 'center' }}
      />
      <button className="btn" style={{ flex: 1, padding: '9px 8px', fontSize: '0.62rem', whiteSpace: 'nowrap' }} onClick={submit}>
        {added ? 'Added ✓' : 'Add to quote'}
      </button>
    </div>
  );
}
