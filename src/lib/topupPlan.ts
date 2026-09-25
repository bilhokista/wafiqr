// What a wallet still needs before it can fund an escrow, decided from its
// balances alone. Separate from topup.ts so the arithmetic that tells a buyer
// how much to deposit can be tested without a network.
import type { AccountState } from './amounts';

/** A new account must hold 1 XLM just to exist, plus half for the USDC trustline. */
const ACCOUNT_OPENING_XLM = 1.5;
/** Exchanges charge a withdrawal fee and some enforce minimums; ask for a margin. */
const WITHDRAWAL_MARGIN_XLM = 3;

export type TopUpStep =
  /** The wallet has never received anything. It needs XLM before anything else. */
  | { kind: 'deposit'; reason: 'new-account' | 'not-enough'; xlmNeeded: number }
  | { kind: 'trustline' }
  | { kind: 'swap'; usdcToBuy: number; xlmCost: number }
  | { kind: 'ready' };

/**
 * The next thing standing between this wallet and a funded escrow.
 *
 * Pure, so the arithmetic that decides what a buyer is told to deposit can be
 * tested without a network. `xlmPerUsdc` is today's DEX price, slippage included.
 */
export function nextTopUpStep(state: AccountState, usdcNeeded: number, xlmPerUsdc: number): TopUpStep {
  const usdcShort = Math.max(0, usdcNeeded - state.usdc);
  const xlmForSwap = usdcShort * xlmPerUsdc;

  if (!state.exists) {
    return {
      kind: 'deposit',
      reason: 'new-account',
      xlmNeeded: round2(ACCOUNT_OPENING_XLM + xlmForSwap + WITHDRAWAL_MARGIN_XLM),
    };
  }

  if (usdcShort === 0) return state.hasTrustline ? { kind: 'ready' } : { kind: 'trustline' };

  // The trustline itself locks half an XLM, so a wallet without one needs
  // that much more before the swap is affordable.
  const trustlineCost = state.hasTrustline ? 0 : 0.5;
  const shortfall = xlmForSwap + trustlineCost - state.spendableXlm;
  if (shortfall > 0) {
    return { kind: 'deposit', reason: 'not-enough', xlmNeeded: round2(shortfall + WITHDRAWAL_MARGIN_XLM) };
  }

  if (!state.hasTrustline) return { kind: 'trustline' };
  return { kind: 'swap', usdcToBuy: round2(usdcShort), xlmCost: round2(xlmForSwap) };
}

/** Rounds up to cents: a buyer told to deposit slightly too little has to do it twice. */
const round2 = (n: number) => Math.ceil(n * 100) / 100;
