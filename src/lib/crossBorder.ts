// wafiqr settles in USDC, and in Indonesia that is only lawful across a border.
//
// Law 4/2026 (the P2SK amendment, in force 17 June 2026) says a stablecoin
// cannot be a means of payment. Two Indonesians settling a sale in USDC is
// exactly that. A buyer abroad paying an Indonesian producer is an export
// whose proceeds the producer converts at a licensed exchange — a different
// thing, and the only thing this product is for.
//
// So the check is not advice. A deal between two parties in Indonesia does not
// open, and a deal where either side has not said where they are does not open
// either, because "unknown" cannot be shown to be cross-border.

const ALIASES: Record<string, string> = {
  id: 'indonesia',
  idn: 'indonesia',
  indonesia: 'indonesia',
  'republic of indonesia': 'indonesia',
  'republik indonesia': 'indonesia',
  ri: 'indonesia',
  sg: 'singapore',
  sgp: 'singapore',
  singapore: 'singapore',
  singapura: 'singapore',
  my: 'malaysia',
  malaysia: 'malaysia',
  jp: 'japan',
  japan: 'japan',
  jepang: 'japan',
};

/** Lower-cased, alias-resolved country, or '' when nothing usable was given. */
export function normalizeCountry(input: string | undefined): string {
  const key = (input ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  return ALIASES[key] ?? key;
}

/**
 * Why this pair cannot trade on wafiqr, or null when it can.
 * Returned as a sentence because the person reading it has to act on it.
 */
export function crossBorderProblem(buyerCountry: string | undefined, sellerCountry: string | undefined): string | null {
  const buyer = normalizeCountry(buyerCountry);
  const seller = normalizeCountry(sellerCountry);

  if (!buyer) return 'Add your country on your account page first. wafiqr only settles trades that cross a border.';
  if (!seller) return 'This seller has not said which country they ship from, so the trade cannot be shown to cross a border.';
  if (buyer === 'indonesia' && seller === 'indonesia') {
    return 'Both of you are in Indonesia. Under Law 4/2026 a stablecoin cannot be used to pay for goods inside Indonesia, so wafiqr cannot settle this trade. Pay the seller in rupiah directly.';
  }
  if (buyer === seller) {
    return `Both of you are in ${buyerCountry}. wafiqr is for trades that cross a border.`;
  }
  return null;
}
