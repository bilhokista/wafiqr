// Checking an exchange deposit before any money is sent to it. No network
// here, so the rules that protect a seller's payout can be tested directly.
import { Memo, StrKey } from '@stellar/stellar-sdk';
import type { ExchangeDestination } from './types';

/** Stellar memo limits: text is 28 bytes, an id is an unsigned 64-bit integer. */
const MAX_TEXT_MEMO_BYTES = 28;
const MAX_ID_MEMO = 18446744073709551615n;

/**
 * Everything wrong with a destination, as sentences, or an empty list.
 *
 * A missing or mistyped memo is the one mistake here that costs the seller
 * their money outright — the exchange receives it and cannot tell whose it
 * is — so it is checked as hard as the address.
 */
export function destinationProblems(dest: ExchangeDestination, sellerAddress?: string): string[] {
  const problems: string[] = [];
  const address = dest.address.trim();
  const memo = dest.memo.trim();

  if (!dest.exchange.trim()) problems.push('Name the exchange, so the record says where the money went.');
  if (!StrKey.isValidEd25519PublicKey(address)) {
    problems.push('The deposit address must be a Stellar address starting with G, copied from the exchange.');
  }
  if (sellerAddress && address === sellerAddress) {
    problems.push('That is your wafiqr wallet, not your exchange. Copy the deposit address from the exchange app.');
  }
  if (!memo) {
    problems.push('Exchanges credit Stellar deposits by memo. Without it the money arrives and belongs to nobody. Copy the memo from the exchange app.');
  } else if (dest.memoType === 'id') {
    if (!/^\d+$/.test(memo) || BigInt(memo) > MAX_ID_MEMO) {
      problems.push('A memo of type ID is a whole number. If the exchange shows letters, switch the type to text.');
    }
  } else if (new TextEncoder().encode(memo).length > MAX_TEXT_MEMO_BYTES) {
    problems.push(`A text memo is at most ${MAX_TEXT_MEMO_BYTES} bytes. Check you copied only the memo.`);
  }
  return problems;
}

export function memoFor(dest: ExchangeDestination): Memo {
  const memo = dest.memo.trim();
  return dest.memoType === 'id' ? Memo.id(memo) : Memo.text(memo);
}
