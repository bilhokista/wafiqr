// The account-level plumbing an escrow needs before it can move: whether the
// account exists, whether it trusts USDC, how much it can actually spend, and
// turning XLM into USDC on the DEX.
//
// XLM matters here because it is the one asset every exchange lists on
// Stellar. A buyer can pay with QRIS or a card at whichever licensed exchange
// they already use, withdraw XLM, and this file turns it into the USDC the
// escrow is denominated in — without wafiqr touching either.
import { Asset, BASE_FEE, Horizon, Operation, TransactionBuilder, type xdr } from '@stellar/stellar-sdk';
import { signXdr } from './wallet';
import { NETWORK } from './network';
import { USDC_ISSUER } from './trustlessWork';
import { SLIPPAGE, amount7, spendableXlm, type AccountState } from './amounts';

export { SLIPPAGE, amount7, type AccountState };

export const server = new Horizon.Server(NETWORK.horizonUrl);
export const USDC = new Asset('USDC', USDC_ISSUER);

export async function accountState(address: string): Promise<AccountState> {
  let account: Horizon.AccountResponse;
  try {
    account = await server.loadAccount(address);
  } catch (e) {
    // A 404 is not an error here: it is a wallet nobody has sent XLM to yet,
    // which is exactly where every new buyer starts.
    if ((e as { response?: { status?: number } }).response?.status === 404) {
      return { exists: false, xlm: 0, usdc: 0, hasTrustline: false, spendableXlm: 0 };
    }
    throw e;
  }

  let xlm = 0;
  let sellingLiabilities = 0;
  let usdc = 0;
  let hasTrustline = false;
  for (const b of account.balances) {
    if (b.asset_type === 'native') {
      xlm = Number(b.balance);
      sellingLiabilities = Number(b.selling_liabilities);
    } else if ('asset_code' in b && b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER) {
      hasTrustline = true;
      usdc = Number(b.balance);
    }
  }

  // Horizon returns the sponsorship counts; the SDK's type just does not list them.
  const sponsorship = account as unknown as { num_sponsoring?: number; num_sponsored?: number };

  return {
    exists: true,
    xlm,
    usdc,
    hasTrustline,
    spendableXlm: spendableXlm({
      balance: xlm,
      subentries: account.subentry_count,
      sponsoring: sponsorship.num_sponsoring ?? 0,
      sponsored: sponsorship.num_sponsored ?? 0,
      sellingLiabilities,
    }),
  };
}

/** Builds one transaction from `ops`, has the owner sign it, and submits it. */
export async function signAndSubmit(address: string, ops: xdr.Operation[], memo?: import('@stellar/stellar-sdk').Memo) {
  const account = await server.loadAccount(address);
  const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK.passphrase });
  for (const op of ops) builder.addOperation(op);
  if (memo) builder.addMemo(memo);
  const tx = builder.setTimeout(120).build();

  const signedXdr = await signXdr(tx.toXDR(), address);
  return server.submitTransaction(TransactionBuilder.fromXDR(signedXdr, NETWORK.passphrase));
}

export async function hasUsdcTrustline(address: string): Promise<boolean> {
  return (await accountState(address)).hasTrustline;
}

export async function addUsdcTrustline(address: string) {
  return signAndSubmit(address, [Operation.changeTrust({ asset: USDC })]);
}

/**
 * How much XLM buys exactly `usdcAmount` right now, with slippage headroom.
 *
 * Asked of Horizon's path finder rather than hard-coded, because on mainnet
 * the price is real and yesterday's number is someone's loss.
 */
export async function quoteXlmForUsdc(usdcAmount: number): Promise<{ xlm: number; path: Asset[] }> {
  const { records } = await server
    .strictReceivePaths([Asset.native()], USDC, amount7(usdcAmount))
    .call();
  const best = records
    .filter((r) => r.source_asset_type === 'native')
    .sort((a, b) => Number(a.source_amount) - Number(b.source_amount))[0];
  if (!best) throw new Error(`The DEX has no route from XLM to ${usdcAmount} USDC right now.`);
  const path = best.path.map((p) =>
    p.asset_type === 'native' ? Asset.native() : new Asset(p.asset_code as string, p.asset_issuer as string),
  );
  return { xlm: Number(best.source_amount) * (1 + SLIPPAGE), path };
}

/** Swaps XLM for exactly `usdcAmount` USDC in the same account. */
export async function buyUsdcWithXlm(address: string, usdcAmount: number) {
  const quote = await quoteXlmForUsdc(usdcAmount);
  return signAndSubmit(address, [
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: amount7(quote.xlm),
      destination: address,
      destAsset: USDC,
      destAmount: amount7(usdcAmount),
      path: quote.path,
    }),
  ]);
}
