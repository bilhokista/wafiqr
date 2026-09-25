import { describe, expect, it } from 'vitest';
import { nextTopUpStep } from './topupPlan';
import type { AccountState } from './amounts';

const RATE = 4; // XLM per USDC, slippage already included

function state(partial: Partial<AccountState>): AccountState {
  return { exists: true, xlm: 0, usdc: 0, hasTrustline: false, spendableXlm: 0, ...partial };
}

describe('nextTopUpStep', () => {
  it('asks a brand-new wallet for enough XLM to open, trust USDC and buy it, with a margin', () => {
    const step = nextTopUpStep(state({ exists: false }), 25, RATE);
    // 1.5 opening + 25 * 4 swap + 3 margin
    expect(step).toEqual({ kind: 'deposit', reason: 'new-account', xlmNeeded: 104.5 });
  });

  it('asks for the trustline first once the XLM is there', () => {
    const step = nextTopUpStep(state({ xlm: 120, spendableXlm: 118.9 }), 25, RATE);
    expect(step).toEqual({ kind: 'trustline' });
  });

  it('counts the trustline reserve when deciding whether the swap is affordable', () => {
    // 100 for the swap + 0.5 for the trustline is 100.5; 100.2 is short.
    const step = nextTopUpStep(state({ xlm: 102, spendableXlm: 100.2 }), 25, RATE);
    expect(step.kind).toBe('deposit');
    if (step.kind === 'deposit') expect(step.xlmNeeded).toBe(3.3);
  });

  it('swaps only the shortfall when some USDC is already held', () => {
    const step = nextTopUpStep(state({ hasTrustline: true, usdc: 10, spendableXlm: 200 }), 25, RATE);
    expect(step).toEqual({ kind: 'swap', usdcToBuy: 15, xlmCost: 60 });
  });

  it('is ready when the USDC is already there', () => {
    expect(nextTopUpStep(state({ hasTrustline: true, usdc: 25 }), 25, RATE)).toEqual({ kind: 'ready' });
  });

  it('for a seller (nothing to buy) only needs the trustline', () => {
    expect(nextTopUpStep(state({ xlm: 5, spendableXlm: 3.9 }), 0, 0)).toEqual({ kind: 'trustline' });
    expect(nextTopUpStep(state({ hasTrustline: true }), 0, 0)).toEqual({ kind: 'ready' });
  });

  it('asks a new seller wallet only for the opening reserve and margin', () => {
    expect(nextTopUpStep(state({ exists: false }), 0, 0)).toEqual({ kind: 'deposit', reason: 'new-account', xlmNeeded: 4.5 });
  });
});
