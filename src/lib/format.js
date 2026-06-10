/** Render a price (with optional sale price) as HTML. */
export function fmtPrice(price, salePrice) {
  const f = (n) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  if (salePrice != null && salePrice < price) {
    return `${f(salePrice)}<span class="was">${f(price)}</span>`;
  }
  return f(price);
}

export const audFmt = (n) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(n);
