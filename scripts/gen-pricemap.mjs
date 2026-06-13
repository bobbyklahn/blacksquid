/**
 * Generates functions/pricemap.json from src/content/spirits/*.json.
 * Runs automatically before `npm run dev` and `npm run build`, so the
 * Stripe checkout function always prices from the same data as the pages.
 * Amounts are in cents (Stripe unit_amount), using salePrice when set.
 */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src', 'content', 'spirits');
const out = join(root, 'functions', 'pricemap.json');

// Load every spirit first so bundles can be checked against their components.
const raw = {};
for (const f of (await readdir(src)).filter((f) => f.endsWith('.json'))) {
  raw[f.replace(/\.json$/, '')] = JSON.parse(await readFile(join(src, f), 'utf8'));
}
const effPrice = (d) => (d.salePrice != null && d.salePrice < d.price ? d.salePrice : d.price);

const map = {};
for (const [slug, d] of Object.entries(raw)) {
  map[slug] = {
    title: `${d.title}${d.volume ? ` ${d.volume}` : ''}`,
    amount: Math.round(effPrice(d) * 100),
    soldOut: !!d.soldOut,
    image: Array.isArray(d.images) && d.images[0] ? d.images[0] : null,
    order: d.order ?? 99,
  };
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(map, null, 2));

// Bundle drift guard: a bundle's price is hand-set but its parts' prices move,
// so warn at build time if the savings story has gone stale or wrong.
for (const [slug, d] of Object.entries(raw)) {
  if (!Array.isArray(d.components) || d.components.length === 0) continue;
  const missing = d.components.filter((c) => !raw[c]);
  if (missing.length) console.warn(`pricemap: bundle "${slug}" references missing component(s): ${missing.join(', ')}`);
  const partsTotal = d.components.map((c) => raw[c]).filter(Boolean).reduce((n, p) => n + effPrice(p), 0);
  if (effPrice(d) >= partsTotal) {
    console.warn(`pricemap: bundle "${slug}" (A$${effPrice(d)}) is NOT cheaper than its parts (A$${partsTotal}) — drop or reprice it.`);
  } else if (d.price !== partsTotal) {
    console.warn(`pricemap: bundle "${slug}" regular price (A$${d.price}) ≠ parts bought separately (A$${partsTotal}) — its "was" strikethrough may mislead.`);
  }
}

// public/prices.json — lets the cart drawer refresh persisted carts
// (price/title changes, sold-out flags) without a server round-trip.
// `components` ride along so the cart can avoid cross-selling a bottle
// that's already inside a bundle the shopper has added.
const publicMap = Object.fromEntries(
  Object.entries(map)
    .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99))
    .map(([slug, p]) => {
      const entry = { title: p.title, price: p.amount / 100, soldOut: p.soldOut, image: p.image };
      const comps = raw[slug].components;
      if (Array.isArray(comps) && comps.length) entry.components = comps;
      return [slug, entry];
    })
);
await writeFile(join(root, 'public', 'prices.json'), JSON.stringify(publicMap));
console.log(`pricemap: ${Object.keys(map).length} spirits → functions/pricemap.json + public/prices.json`);
