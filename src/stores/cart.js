import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/* ---------- spirits cart (Stripe checkout) ---------- */
export const useCart = create(
  persist(
    (set, get) => ({
      items: [], // { slug, title, price, qty }
      open: false,
      setOpen: (open) => set({ open }),
      add: (item) =>
        set((s) => {
          const found = s.items.find((i) => i.slug === item.slug);
          return found
            ? { items: s.items.map((i) => (i.slug === item.slug ? { ...i, qty: Math.min(99, i.qty + 1) } : i)), open: true }
            : { items: [...s.items, { ...item, qty: 1 }], open: true };
        }),
      setQty: (slug, qty) =>
        set((s) => ({
          items:
            qty < 1
              ? s.items.filter((i) => i.slug !== slug)
              : s.items.map((i) => (i.slug === slug ? { ...i, qty: Math.min(99, qty) } : i)),
        })),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
      total: () => get().items.reduce((n, i) => n + i.qty * i.price, 0),
      /**
       * Reconcile a persisted cart against fresh /prices.json:
       * corrects prices & titles changed in the CMS since the visitor
       * last shopped, and flags items now sold out / removed.
       */
      reconcile: (priceMap) =>
        set((s) => ({
          items: s.items.map((i) => {
            const p = priceMap[i.slug];
            if (!p || p.soldOut) return { ...i, unavailable: true };
            return { ...i, price: p.price, title: p.title, unavailable: false };
          }),
        })),
    }),
    { name: 'bsq-cart', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ items: s.items }) }
  )
);

/* ---------- SPAK wholesale quote basket (enquiry email) ---------- */
export const useQuote = create(
  persist(
    (set, get) => ({
      items: [], // { slug, title, price, priceFrom, qty }
      add: (item, qty = 1) =>
        set((s) => {
          const found = s.items.find((i) => i.slug === item.slug);
          return found
            ? { items: s.items.map((i) => (i.slug === item.slug ? { ...i, qty: i.qty + qty } : i)) }
            : { items: [...s.items, { ...item, qty }] };
        }),
      setQty: (slug, qty) =>
        set((s) => ({
          items:
            qty < 1
              ? s.items.filter((i) => i.slug !== slug)
              : s.items.map((i) => (i.slug === slug ? { ...i, qty } : i)),
        })),
      remove: (slug) => set((s) => ({ items: s.items.filter((i) => i.slug !== slug) })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
    }),
    { name: 'bsq-quote', storage: createJSONStorage(() => localStorage), partialize: (s) => ({ items: s.items }) }
  )
);

export const aud = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
