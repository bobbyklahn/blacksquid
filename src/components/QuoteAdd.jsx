import { useState } from 'react';
import { useQuote } from '../stores/cart.js';

/** Add a SPAK bottle/closure SKU to the wholesale quote basket. */
export default function QuoteAdd({ slug, title, price, priceFrom }) {
  const add = useQuote((s) => s.add);
  const [qty, setQty] = useState(100);
  const [added, setAdded] = useState(false);

  const submit = () => {
    add({ slug, title, price, priceFrom }, Math.max(1, qty));
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input
        type="number"
        min="1"
        step="1"
        value={qty}
        onChange={(e) => setQty(parseInt(e.target.value) || 1)}
        aria-label={`Quantity for ${title}`}
        style={{ width: 76, padding: '8px 10px', fontSize: '0.85rem' }}
      />
      <button className="btn" style={{ padding: '9px 16px', fontSize: '0.66rem', whiteSpace: 'nowrap' }} onClick={submit}>
        {added ? 'Added ✓' : 'Add to quote'}
      </button>
    </div>
  );
}
