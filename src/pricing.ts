/** SourceCloak Pro pricing (lifetime). */
export const PRICING = {
  id: 'pro-lifetime',
  price: 24,
  currency: 'USD',
  tagline: 'Pay once. Policy control and full audit on every modern Chrome.',
} as const;

export const PRO_PRICE = PRICING.price;

export const NO_REFUND_NOTICE =
  'All Pro purchases are final and non-refundable. Evaluate Community and run compatibility checks before upgrading.';
