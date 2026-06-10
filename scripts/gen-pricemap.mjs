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

const map = {};
for (const f of (await readdir(src)).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(await readFile(join(src, f), 'utf8'));
  const slug = f.replace(/\.json$/, '');
  const effective = d.salePrice != null && d.salePrice < d.price ? d.salePrice : d.price;
  map[slug] = {
    title: `${d.title}${d.volume ? ` ${d.volume}` : ''}`,
    amount: Math.round(effective * 100),
    soldOut: !!d.soldOut,
    image: Array.isArray(d.images) && d.images[0] ? d.images[0] : null,
    order: d.order ?? 99,
  };
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(map, null, 2));

// public/prices.json — lets the cart drawer refresh persisted carts
// (price/title changes, sold-out flags) without a server round-trip.
const publicMap = Object.fromEntries(
  Object.entries(map)
    .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99))
    .map(([slug, p]) => [slug, { title: p.title, price: p.amount / 100, soldOut: p.soldOut, image: p.image }])
);
await writeFile(join(root, 'public', 'prices.json'), JSON.stringify(publicMap));
console.log(`pricemap: ${Object.keys(map).length} spirits → functions/pricemap.json + public/prices.json`);
