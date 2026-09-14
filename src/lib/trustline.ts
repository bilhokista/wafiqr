// Adds the testnet USDC trustline to the connected account, so it can hold and
// move USDC in escrow. Builds a changeTrust transaction, signs it with the wallet,
// and submits it to Horizon testnet.
import {
  Asset,
  BASE_FEE,
  Horizon,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';
import { signXdr } from './wallet';
import { USDC_TESTNET_ISSUER } from './trustlessWork';

const server = new Horizon.Server('https://horizon-testnet.stellar.org');
const USDC = new Asset('USDC', USDC_TESTNET_ISSUER);

/** Returns true if the account already trusts testnet USDC. */
export async function hasUsdcTrustline(address: string): Promise<boolean> {
  const account = await server.loadAccount(address);
  return account.balances.some(
    (b) => 'asset_code' in b && b.asset_code === 'USDC' && b.asset_issuer === USDC_TESTNET_ISSUER,
  );
}

/** Establishes the USDC trustline (no-op cost if it already exists). */
export async function addUsdcTrustline(address: string) {
  const account = await server.loadAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(120)
    .build();

  const signedXdr = await signXdr(tx.toXDR(), address);
  const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  return server.submitTransaction(signed);
}

/** Buys `amount` testnet USDC by paying XLM through the DEX (no faucet needed). */
export async function buyUsdcWithXlm(address: string, amount: number, sendMaxXlm = '50') {
  const account = await server.loadAccount(address);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: sendMaxXlm,
        destination: address,
        destAsset: USDC,
        destAmount: String(amount),
        path: [],
      }),
    )
    .setTimeout(120)
    .build();

  const signedXdr = await signXdr(tx.toXDR(), address);
  const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  return server.submitTransaction(signed);
}
