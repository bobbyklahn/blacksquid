/**
 * Product imagery comes in two flavours: studio shots on pure white, and
 * dark/illustrated assets that belong on the inky tile. White shots get the
 * `plinth` treatment (see global.css). New CMS uploads default to plinth —
 * add to DARK if a photo is shot on black.
 */
const DARK = new Set([
  '/images/products/black-squid-shiraz-gin-2021-1.webp',
  '/images/products/klahn-barossa-valley-shiraz-gin-50-1.webp',
]);

export function isDarkArt(src) {
  return !src || src.endsWith('.svg') || DARK.has(src);
}

/** class list for a product image tile, e.g. tileClass('pimg', src) */
export function tileClass(base, src) {
  return isDarkArt(src) ? base : `${base} plinth`;
}
