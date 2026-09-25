// The top-up and cash-out rails against real Stellar testnet: a new wallet is
// funded, trusts USDC, swaps XLM into it on the DEX, and sends it on to an
// "exchange" deposit address with a memo, converted back to XLM on the way.
//
// Off by default because it needs the network and friendbot. Run with:
//   TESTNET=1 npx vitest run src/lib/rails.testnet.test.ts
import { describe, expect, it, vi } from 'vitest';
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

const keys = new Map<string, Keypair>();

// Signing is the only browser-bound piece; stand in with raw keypairs so the
// modules under test run unchanged.
vi.mock('./wallet', () => ({
  NETWORK_PASSPHRASE: Networks.TESTNET,
  signXdr: async (xdr: string, address: string) => {
    const keypair = keys.get(address);
    if (!keypair) throw new Error(`no test key for ${address}`);
    const tx = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
    tx.sign(keypair);
    return tx.toXDR();
  },
}));

const { advanceTopUp, checkTopUp, fundWithFriendbot } = await import('./topup');
const { sendCashout } = await import('./cashout');
const { accountState, server } = await import('./trustline');
const tw = await import('./trustlessWork');
const { NETWORK } = await import('./network');

function wallet() {
  const keypair = Keypair.random();
  keys.set(keypair.publicKey(), keypair);
  return keypair.publicKey();
}

describe.skipIf(!import.meta.env.TESTNET)('rails on testnet', () => {
  it('tops up a new wallet to 5 USDC and cashes it out to an exchange memo', async () => {
    const buyer = wallet();
    const exchange = wallet();
    await Promise.all([fundWithFriendbot(buyer), fundWithFriendbot(exchange)]);

    // Top-up: walk the steps until the wallet holds what the escrow needs.
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const { step } = await checkTopUp(buyer, 5);
      seen.push(step.kind);
      if (step.kind === 'ready') break;
      if (step.kind === 'deposit') throw new Error(`unexpected deposit step: ${JSON.stringify(step)}`);
      await advanceTopUp(buyer, step);
    }
    expect(seen).toEqual(['trustline', 'swap', 'ready']);
    expect((await accountState(buyer)).usdc).toBeCloseTo(5, 5);

    // Cash-out: USDC leaves as XLM, tagged with the exchange's memo.
    const before = (await accountState(exchange)).xlm;
    const { hash } = await sendCashout(
      buyer,
      { exchange: 'Test exchange', address: exchange, memo: '424242', memoType: 'id', asset: 'XLM' },
      5,
    );
    const tx = await server.transactions().transaction(hash).call();
    expect(tx.memo_type).toBe('id');
    expect(tx.memo).toBe('424242');
    expect((await accountState(exchange)).xlm).toBeGreaterThan(before);
    expect((await accountState(buyer)).usdc).toBe(0);
  }, 120_000);

  it('runs a whole escrow through the guarded calls, then cashes out what the seller really got', async () => {
    const [buyer, seller, arbiter, exchange] = [wallet(), wallet(), wallet(), wallet()];
    await Promise.all([buyer, seller, arbiter, exchange].map(fundWithFriendbot));
    for (const [who, need] of [[buyer, 3], [seller, 0]] as const) {
      for (let i = 0; i < 4; i++) {
        const { step } = await checkTopUp(who, need);
        if (step.kind === 'ready') break;
        await advanceTopUp(who, step);
      }
    }

    const parties = { buyer, seller, arbiter, usdcContract: NETWORK.usdcContract };
    const deployed = await tw.deploySingleRelease({
      signer: buyer,
      engagementId: `rails-${Date.now()}`,
      title: 'rails test',
      description: 'guarded lifecycle',
      amount: 3,
      platformFee: 0,
      roles: { approver: buyer, serviceProvider: seller, releaseSigner: buyer, platformAddress: buyer, disputeResolver: arbiter, receiver: seller },
      milestones: [{ description: 'goods arrive' }],
      trustline: { address: NETWORK.usdcIssuer, symbol: 'USDC' },
    });
    const contractId: string = deployed.contractId ?? deployed.escrow?.contractId;
    expect(contractId).toMatch(/^C/);

    await tw.fundEscrow({ contractId, signer: buyer, amount: 3, parties });
    await tw.markShipped({ contractId, serviceProvider: seller, evidence: 'waybill RAILS1' });
    await tw.approveMilestone({ contractId, approver: buyer });
    await tw.releaseFunds({ contractId, releaseSigner: buyer });

    const received = (await accountState(seller)).usdc;
    expect(received).toBeGreaterThan(2.9);
    expect(received).toBeLessThanOrEqual(3);

    const { hash } = await sendCashout(
      seller,
      { exchange: 'Test exchange', address: exchange, memo: 'RAILS-OK', memoType: 'text', asset: 'XLM' },
      received,
    );
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await accountState(seller)).usdc).toBe(0);
    // Printed so a run can be cited: anyone can open these on a testnet explorer.
    console.info(JSON.stringify({ contractId, seller, received, cashoutTx: hash }));
  }, 300_000);
});
