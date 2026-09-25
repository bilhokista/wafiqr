// Stellar arithmetic with no network behind it, kept apart so it can be tested
// without a wallet, a browser or Horizon.

/** Stellar's base reserve, per ledger entry. Protocol constant since 2019. */
const BASE_RESERVE = 0.5;
/** Headroom left for fees so a swap never strands an account below its reserve. */
const FEE_HEADROOM = 0.1;
/** How far a DEX quote may move between quoting and settling before we refuse. */
export const SLIPPAGE = 0.01;

export interface AccountState {
  exists: boolean;
  xlm: number;
  usdc: number;
  hasTrustline: boolean;
  /** XLM that can leave the account without breaking its minimum balance. */
  spendableXlm: number;
}

/**
 * XLM above the account's minimum balance.
 *
 * Every trustline, offer and signer locks half an XLM. Spending into that lock
 * fails on chain with an error nobody outside Stellar understands, so the
 * number shown to a buyer is the one they can really use.
 */
export function spendableXlm(input: {
  balance: number;
  subentries: number;
  sponsoring: number;
  sponsored: number;
  sellingLiabilities: number;
}): number {
  const minimum = (2 + input.subentries + input.sponsoring - input.sponsored) * BASE_RESERVE;
  return Math.max(0, input.balance - minimum - input.sellingLiabilities - FEE_HEADROOM);
}

/**
 * Stellar amounts are strings with at most seven decimals. Rounds down, so a
 * send never exceeds what was meant; the epsilon stops 1.0000001 * 1e7 landing
 * a hair under an integer and losing a stroop to float error.
 */
export function amount7(n: number): string {
  return (Math.floor(n * 1e7 + 1e-6) / 1e7).toFixed(7);
}
