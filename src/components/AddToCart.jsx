import { useCart } from '../stores/cart.js';

/** Add-to-cart button for a spirit. */
export default function AddToCart({ slug, title, price, soldOut = false, big = false }) {
  const add = useCart((s) => s.add);
  if (soldOut) {
    return <span className="tag soldout" style={{ alignSelf: 'center' }}>Sold out</span>;
  }
  return (
    <button
      className={big ? 'btn solid' : 'btn'}
      style={big ? { width: '100%', padding: '16px 32px' } : { padding: '10px 18px', fontSize: '0.68rem' }}
      onClick={() => add({ slug, title, price })}
    >
      Add to cart
    </button>
  );
}
