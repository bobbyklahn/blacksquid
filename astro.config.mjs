import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { readdirSync, readFileSync } from 'node:fs';

// hidden spirits stay buyable via direct URL but out of the sitemap
const spiritsDir = new URL('./src/content/spirits/', import.meta.url);
const hiddenSlugs = readdirSync(spiritsDir)
  .filter((f) => f.endsWith('.json'))
  .filter((f) => JSON.parse(readFileSync(new URL(f, spiritsDir), 'utf8')).hidden)
  .map((f) => f.replace(/\.json$/, ''));

// https://astro.build/config
export default defineConfig({
  site: 'https://www.blacksquiddistillery.com.au',
  integrations: [
    react(),
    sitemap({ filter: (page) => !hiddenSlugs.some((slug) => page.includes(`/gins/${slug}/`)) }),
  ],
});
