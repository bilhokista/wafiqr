// Getting a buyer from "I have rupiah, dollars or a card" to "the escrow is funded".
//
// wafiqr sells nothing and converts nothing. The buyer buys XLM or USDC at a
// licensed exchange or ramp they choose — QRIS, virtual account, card, PayNow,
// whatever that provider takes — and withdraws it to their own wallet. From
// there this module works out what is still missing and does the on-chain
// half: the USDC trustline and the swap. The licence sits with the provider,
// where it belongs; the keys sit with the buyer.
import { accountState, addUsdcTrustline, buyUsdcWithXlm, quoteXlmForUsdc } from './trustline';
import { nextTopUpStep, type TopUpStep } from './topupPlan';
import type { AccountState } from './amounts';

export type { TopUpStep };

export async function checkTopUp(address: string, usdcNeeded: number): Promise<{ state: AccountState; step: TopUpStep }> {
  const state = await accountState(address);
  const short = Math.max(0, usdcNeeded - state.usdc);
  // Only ask the DEX when there is something to buy; a funded wallet should
  // not fail its check because the order book is briefly thin.
  const xlmPerUsdc = short > 0 ? (await quoteXlmForUsdc(short)).xlm / short : 0;
  return { state, step: nextTopUpStep(state, usdcNeeded, xlmPerUsdc) };
}

/** Takes the one on-chain step that is due. Deposits are the buyer's to make. */
export async function advanceTopUp(address: string, step: TopUpStep) {
  if (step.kind === 'trustline') await addUsdcTrustline(address);
  else if (step.kind === 'swap') await buyUsdcWithXlm(address, step.usdcToBuy);
}

/**
 * Testnet only: asks Stellar's friendbot for play XLM. There is no exchange on
 * testnet, and a pilot user should not be told to go and buy fake money.
 */
export async function fundWithFriendbot(address: string) {
  const res = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
  if (!res.ok) throw new Error(`Friendbot refused (${res.status}). The account may already be funded.`);
}

/**
 * Where a buyer can get XLM or USDC with the money they already have.
 *
 * Listed by what has actually been done, not by what a provider's marketing
 * says. Every one of them is the licensed party in its own country; wafiqr is
 * only a link.
 */
export const TOP_UP_SOURCES: { name: string; how: string; url: string; tested: boolean }[] = [
  {
    name: 'Alchemy Pay',
    how: 'QRIS or virtual account in Indonesia, cards elsewhere. Buy XLM or USDC on the Stellar network and paste your wallet address as the destination. Identity check (KYC) required.',
    url: 'https://ramp.alchemypay.org',
    tested: true,
  },
  {
    name: 'Indodax',
    how: 'Buy XLM with rupiah, then withdraw it on the Stellar network to your wallet address. No memo is needed for your own wallet.',
    url: 'https://indodax.com',
    tested: true,
  },
  {
    name: 'Any exchange you already use',
    how: 'Anything that lets you withdraw XLM on the Stellar network works. Withdraw to your wallet address; leave the memo empty.',
    url: '',
    tested: false,
  },
];
