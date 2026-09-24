// End-to-end testnet run with three separate parties: buyer, seller, arbiter.
// Runs both paths against Trustless Work and prints the StellarExpert links:
//   happy:   deploy -> fund -> seller marks shipped (evidence) -> buyer approves -> release to seller
//   dispute: deploy -> fund -> buyer disputes -> arbiter splits the funds
//   payout:  release -> the last mile, which is where the seller actually gets paid
//
// Usage: node --experimental-strip-types scripts/e2e-testnet.mjs
// Payout leg alone, no network and no testnet spend: PAYOUT_ONLY=1
// Resolve a dispute opened from the app: RESUME_DISPUTE=<contractId> node scripts/e2e-testnet.mjs
// Keys are generated once into scripts/.testnet-wallets.json (gitignored, testnet only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

const here = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://dev.api.trustlesswork.com';
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const USDC = new Asset('USDC', USDC_ISSUER);
const AMOUNT = 10;
const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');

const apiKey = readApiKey();
const wallets = loadWallets();
const pub = (name) => wallets[name].publicKey();

function readApiKey() {
  const env = fs.readFileSync(path.join(here, '..', '.env'), 'utf8');
  const match = env.match(/^VITE_TW_API_KEY=(.+)$/m);
  if (!match) throw new Error('VITE_TW_API_KEY missing in .env');
  return match[1].trim();
}

function loadWallets() {
  const file = path.join(here, '.testnet-wallets.json');
  if (!fs.existsSync(file)) {
    const fresh = Object.fromEntries(
      ['buyer', 'seller', 'arbiter'].map((n) => [n, Keypair.random().secret()]),
    );
    fs.writeFileSync(file, JSON.stringify(fresh, null, 2));
  }
  const secrets = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Object.fromEntries(Object.entries(secrets).map(([n, s]) => [n, Keypair.fromSecret(s)]));
}

async function tw(method, route, body) {
  const res = await fetch(`${API}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${route} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

// unsigned XDR from TW -> sign locally -> submit through TW
async function run(route, body, signerName) {
  const { unsignedTransaction } = await tw('POST', route, body);
  const tx = TransactionBuilder.fromXDR(unsignedTransaction, Networks.TESTNET);
  tx.sign(wallets[signerName]);
  const sent = await tw('POST', '/helper/send-transaction', { signedXdr: tx.toXDR() });
  if (sent.status && sent.status !== 'SUCCESS') throw new Error(`${route} submit: ${JSON.stringify(sent)}`);
  return sent;
}

async function classicTx(name, op) {
  const account = await horizon.loadAccount(pub(name));
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(op)
    .setTimeout(120)
    .build();
  tx.sign(wallets[name]);
  return horizon.submitTransaction(tx);
}

async function prepareAccount(name, usdcNeeded) {
  let account;
  try {
    account = await horizon.loadAccount(pub(name));
  } catch {
    const res = await fetch(`https://friendbot.stellar.org?addr=${pub(name)}`);
    if (!res.ok) throw new Error(`friendbot failed for ${name}: ${res.status}`);
    account = await horizon.loadAccount(pub(name));
  }
  const usdc = account.balances.find((b) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER);
  if (!usdc) await classicTx(name, Operation.changeTrust({ asset: USDC }));
  const have = usdc ? Number(usdc.balance) : 0;
  if (have < usdcNeeded) {
    await classicTx(
      name,
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: '500',
        destination: pub(name),
        destAsset: USDC,
        destAmount: (usdcNeeded - have).toFixed(7),
        path: [],
      }),
    );
  }
}

async function usdcBalance(name) {
  const account = await horizon.loadAccount(pub(name));
  const b = account.balances.find((x) => x.asset_code === 'USDC' && x.asset_issuer === USDC_ISSUER);
  return b ? Number(b.balance) : 0;
}

async function deploy(label) {
  const res = await run(
    '/deployer/single-release',
    {
      signer: pub('buyer'),
      engagementId: `wafiqr-${label}-${Date.now()}`,
      title: `Nutmeg oil 5 L (${label})`,
      description: 'Banda Islands nutmeg oil, GC-MS report included.',
      amount: AMOUNT,
      platformFee: 0,
      roles: {
        approver: pub('buyer'),
        serviceProvider: pub('seller'),
        releaseSigner: pub('buyer'),
        platformAddress: pub('arbiter'),
        disputeResolver: pub('arbiter'),
        receiver: pub('seller'),
      },
      milestones: [{ description: 'Goods delivered and received' }],
      trustline: { address: USDC_ISSUER, symbol: 'USDC' },
    },
    'buyer',
  );
  const contractId = res.contractId ?? res.escrow?.contractId;
  if (!contractId) throw new Error(`deploy returned no contractId: ${JSON.stringify(res)}`);
  await run('/escrow/single-release/fund-escrow', { contractId, signer: pub('buyer'), amount: AMOUNT }, 'buyer');
  return contractId;
}

async function happyPath() {
  const contractId = await deploy('happy');
  const sellerBefore = await usdcBalance('seller');
  await run(
    '/escrow/single-release/change-milestone-status',
    {
      contractId,
      milestoneIndex: '0',
      newStatus: 'shipped',
      newEvidence: 'DHL waybill 1234567890, packing video https://example.com/pack.mp4',
      serviceProvider: pub('seller'),
    },
    'seller',
  );
  await run(
    '/escrow/single-release/approve-milestone',
    { contractId, milestoneIndex: '0', approver: pub('buyer') },
    'buyer',
  );
  await run('/escrow/single-release/release-funds', { contractId, releaseSigner: pub('buyer') }, 'buyer');
  const received = (await usdcBalance('seller')) - sellerBefore;
  return { contractId, sellerReceived: received };
}

async function disputePath() {
  // RESUME_DISPUTE=<contractId> continues an escrow that is already funded and disputed.
  const resumed = process.env.RESUME_DISPUTE;
  const contractId = resumed ?? (await deploy('dispute'));
  if (!resumed) {
    await run('/escrow/single-release/dispute-escrow', { contractId, signer: pub('buyer') }, 'buyer');
  }
  // Distributions must sum the escrow balance after protocol fees, so read it first.
  const balances = await tw('GET', `/helper/get-multiple-escrow-balance?addresses[]=${contractId}`);
  const balance = Number(balances[0]?.balance ?? AMOUNT);
  const toBuyer = Math.round(balance * 0.7 * 1e7) / 1e7;
  const toSeller = Math.round((balance - toBuyer) * 1e7) / 1e7;
  // Pay whoever the escrow names, so this also resolves disputes opened from the widget.
  const [escrow] = await tw('GET', `/helper/get-escrow-by-contract-ids?contractIds[]=${contractId}`);
  const buyerAddress = escrow?.roles?.approver ?? pub('buyer');
  const sellerAddress = escrow?.roles?.receiver ?? pub('seller');
  // The widget demo uses one wallet as buyer and seller; the API rejects duplicate addresses.
  const distributions =
    buyerAddress === sellerAddress
      ? [{ address: buyerAddress, amount: balance }]
      : [
          { address: buyerAddress, amount: toBuyer },
          { address: sellerAddress, amount: toSeller },
        ];
  await run(
    '/escrow/single-release/resolve-dispute',
    {
      contractId,
      disputeResolver: pub('arbiter'),
      distributions,
    },
    'arbiter',
  );
  return { contractId, escrowBalance: balance, toBuyer, toSeller };
}

/**
 * The leg after release, which is the one the seller cares about.
 *
 * Release puts USDC in the seller's Stellar account, and this script used to
 * stop there printing "seller +10 USDC" as if that were payment. For a producer
 * who cannot spend USDC it is not, so this asserts what happens next.
 *
 * With no licensed provider connected the correct behaviour is a refusal that
 * says why. A run that quietly produced a quote here would mean someone had
 * wired in a mock, and a mock rate is indistinguishable from a real one on a
 * seller's screen.
 */
async function payoutLeg() {
  const { quoteForDeal, repatriationCheck, activeProvider } = await import(
    new URL('../src/lib/payout.ts', import.meta.url).href
  );

  // A state bank satisfies the placement requirement; anything else does not,
  // and the difference has to be legible to the seller rather than a bare no.
  const himbara = repatriationCheck('bank', 'BMRI');
  const other = repatriationCheck('bank', 'BCA');
  const wallet = repatriationCheck('wallet', 'BMRI');

  if (!himbara.ok) throw new Error(`Mandiri should satisfy placement: ${himbara.reason}`);
  if (other.ok) throw new Error('A non-state bank must not satisfy placement.');
  if (wallet.ok) throw new Error('A wallet payout must not satisfy placement.');

  // The refusal is the assertion. Reaching a quote without a licensed provider
  // would mean the seller is being shown a number nobody can honour.
  let refusal = '';
  try {
    await quoteForDeal(
      { id: 'payout-leg', amount: AMOUNT },
      { usdcAmount: AMOUNT, bankAccount: '1234567890', bankCode: 'BMRI' },
    );
    throw new Error('A quote succeeded with no provider configured. Something is mocked.');
  } catch (e) {
    refusal = e.message;
    if (!/licensed/i.test(refusal)) throw e;
  }

  return {
    provider: activeProvider().name,
    checks: 'repatriation: BMRI ok, BCA refused, wallet refused',
    refusal,
    walletReason: wallet.reason,
  };
}

function reportPayout(payout) {
  console.log('');
  console.log('PAYOUT  provider:', payout.provider);
  console.log('        ', payout.checks);
  console.log('        refused:', payout.refusal);
  console.log('        ', payout.walletReason);
}

const expert = (id) => `https://stellar.expert/explorer/testnet/contract/${id}`;

async function main() {
  // The payout leg needs no network and no testnet balance, so it can be run
  // on its own while the rest of the script costs real testnet operations.
  if (process.env.PAYOUT_ONLY) return reportPayout(await payoutLeg());

  console.log('buyer  ', pub('buyer'));
  console.log('seller ', pub('seller'));
  console.log('arbiter', pub('arbiter'));
  if (!process.env.RESUME_DISPUTE) {
    await prepareAccount('buyer', AMOUNT * 2);
    await prepareAccount('seller', 0);
    await prepareAccount('arbiter', 0);
  }

  if (!process.env.RESUME_DISPUTE) {
    const happy = await happyPath();
    console.log('\nHAPPY  ', happy.contractId, `seller +${happy.sellerReceived} USDC`);
    console.log('        ', expert(happy.contractId));
  }

  const dispute = await disputePath();
  console.log('\nDISPUTE', dispute.contractId, `balance ${dispute.escrowBalance}, buyer ${dispute.toBuyer}, seller ${dispute.toSeller}`);
  console.log('        ', expert(dispute.contractId));

  // Release is not payment. Say so where this script used to stop and call it
  // done.
  reportPayout(await payoutLeg());
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
