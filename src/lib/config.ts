// Deployment-wide addresses. The arbiter is a third account by design: the
// Trustless Work contract rejects a dispute opened by its own dispute resolver.
export const ARBITER_WALLET =
  import.meta.env.VITE_ARBITER_ADDRESS ??
  'GBFRCU73YKD5NUWBL2SLSZHBAP6IH3MNWIKMUYOIZXGBIUP74WLTGGNJ';

/** wafiqr's own fee account. Fee is 0 during the testnet pilot. */
export const PLATFORM_WALLET =
  import.meta.env.VITE_PLATFORM_ADDRESS ??
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
