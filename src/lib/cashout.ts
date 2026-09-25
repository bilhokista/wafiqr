// The seller's way to rupiah that needs no contract with anyone.
//
// The released USDC goes to the seller's own account at a licensed exchange —
// Indodax, Tokocrypto, whichever they already use — where they sell it and
// withdraw to their bank like any other customer. wafiqr builds the payment
// and the seller signs it. At no point does wafiqr hold the money, quote a
// rate it sets, or convert anything: the exchange is the licensed party, and
// the seller is its customer, not ours.
//
// Most exchanges take XLM on Stellar and fewer take USDC, so by default the
// payment converts USDC to XLM on the way out in a single path payment. The
// seller receives XLM at their exchange and sells it there.
import { Asset, Operation } from '@stellar/stellar-sdk';
import { SLIPPAGE, USDC, amount7, server, signAndSubmit } from './trustline';
import { destinationProblems, memoFor } from './destination';
import type { ExchangeDestination } from './types';

export { destinationProblems };

/**
 * What the exchange will receive for `usdcAmount`, before anything is signed.
 * For XLM it is the DEX's current price less slippage headroom — the floor the
 * payment will enforce, so the seller never gets less than the number shown.
 */
export async function quoteCashout(usdcAmount: number, asset: ExchangeDestination['asset']) {
  if (asset === 'USDC') return { receive: usdcAmount, asset, path: [] as Asset[] };

  const { records } = await server.strictSendPaths(USDC, amount7(usdcAmount), [Asset.native()]).call();
  const best = records
    .filter((r) => r.destination_asset_type === 'native')
    .sort((a, b) => Number(b.destination_amount) - Number(a.destination_amount))[0];
  if (!best) throw new Error(`The DEX has no route from ${usdcAmount} USDC to XLM right now. Try again in a minute.`);

  const path = best.path.map((p) =>
    p.asset_type === 'native' ? Asset.native() : new Asset(p.asset_code as string, p.asset_issuer as string),
  );
  return { receive: Number(best.destination_amount) * (1 - SLIPPAGE), asset, path };
}

/**
 * Sends the seller's USDC to their exchange deposit, signed by the seller.
 * Returns the hash and the floor the payment enforced, so the record states
 * what the seller was guaranteed rather than a quote from a minute earlier.
 */
export async function sendCashout(
  from: string,
  dest: ExchangeDestination,
  usdcAmount: number,
): Promise<{ hash: string; minReceived: number }> {
  const problems = destinationProblems(dest, from);
  if (problems.length) throw new Error(problems.join(' '));

  const destination = dest.address.trim();
  const quote = await quoteCashout(usdcAmount, dest.asset);
  const op =
    dest.asset === 'USDC'
      ? Operation.payment({ destination, asset: USDC, amount: amount7(usdcAmount) })
      : Operation.pathPaymentStrictSend({
          sendAsset: USDC,
          sendAmount: amount7(usdcAmount),
          destination,
          destAsset: Asset.native(),
          destMin: amount7(quote.receive),
          path: quote.path,
        });

  const result = await signAndSubmit(from, [op], memoFor(dest));
  return { hash: result.hash, minReceived: quote.receive };
}
