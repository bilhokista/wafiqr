import { describe, expect, it } from 'vitest';
import { Account, Asset, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import fixtures from './__fixtures__/tw-testnet.json';
import { transactionProblems, type DealParties } from './txGuard';

const PASS = Networks.TESTNET;
const WASM = '7c3f7b2af92ad86092708b23babf80f9e1308d7f3ce18b703b9499192ecc934b';
const parties: DealParties = fixtures.parties;
const { buyer, seller } = parties;
const contractId = fixtures.contractId;
const stranger = Keypair.random().publicKey();

// These are real transactions the Trustless Work testnet API returned, so the
// guard is tested against what it will actually meet, not against a mock of it.
describe('transactionProblems on real Trustless Work transactions', () => {
  it('passes a deploy that matches the deal', () => {
    expect(
      transactionProblems(fixtures.deploy.xdr, PASS, { kind: 'deploy', signer: buyer, amount: 12.5, parties, wasmHash: WASM }),
    ).toEqual([]);
  });

  it('refuses a deploy whose escrow pays someone other than the seller', () => {
    const problems = transactionProblems(fixtures.deploy.xdr, PASS, {
      kind: 'deploy', signer: buyer, amount: 12.5, parties: { ...parties, seller: stranger }, wasmHash: WASM,
    });
    expect(problems.join(' ')).toMatch(/not the seller/);
  });

  it('refuses a deploy for a different amount', () => {
    const problems = transactionProblems(fixtures.deploy.xdr, PASS, { kind: 'deploy', signer: buyer, amount: 125, parties, wasmHash: WASM });
    expect(problems.join(' ')).toMatch(/stroops, not/);
  });

  it('refuses a deploy of code this app has not checked', () => {
    const problems = transactionProblems(fixtures.deploy.xdr, PASS, { kind: 'deploy', signer: buyer, amount: 12.5, parties, wasmHash: 'ab'.repeat(32) });
    expect(problems.join(' ')).toMatch(/code this app has not checked/);
  });

  it('refuses a deploy with a different arbiter', () => {
    const problems = transactionProblems(fixtures.deploy.xdr, PASS, {
      kind: 'deploy', signer: buyer, amount: 12.5, parties: { ...parties, arbiter: stranger }, wasmHash: WASM,
    });
    expect(problems.join(' ')).toMatch(/different arbiter/);
  });

  it('passes a fund that matches', () => {
    expect(transactionProblems(fixtures.fund.xdr, PASS, { kind: 'fund', signer: buyer, contractId, amount: 1, parties })).toEqual([]);
  });

  it('refuses a fund that moves a different amount', () => {
    const problems = transactionProblems(fixtures.fund.xdr, PASS, { kind: 'fund', signer: buyer, contractId, amount: 2, parties });
    expect(problems.join(' ')).toMatch(/moves 10000000 stroops, not 20000000/);
  });

  it('refuses a fund aimed at a different contract', () => {
    const other = 'CDO2UQUENFN5B7B6BSNCEN2ZM7HCN6YWPTYP6JPKBEED664EHFKEWMLY';
    const problems = transactionProblems(fixtures.fund.xdr, PASS, { kind: 'fund', signer: buyer, contractId: other, amount: 1, parties });
    expect(problems.join(' ')).toMatch(/not this deal's escrow/);
  });

  it('refuses a fund signed as someone else', () => {
    const problems = transactionProblems(fixtures.fund.xdr, PASS, { kind: 'fund', signer: stranger, contractId, amount: 1, parties });
    expect(problems.join(' ')).toMatch(/not from your wallet/);
  });

  it('refuses a fund into an escrow that pays someone else', () => {
    const problems = transactionProblems(fixtures.fund.xdr, PASS, {
      kind: 'fund', signer: buyer, contractId, amount: 1, parties: { ...parties, seller: stranger },
    });
    expect(problems.join(' ')).toMatch(/not the seller/);
  });

  it('passes the seller filing the shipment, and refuses it as the buyer', () => {
    expect(transactionProblems(fixtures.status.xdr, PASS, { kind: 'status', signer: seller, contractId })).toEqual([]);
    expect(transactionProblems(fixtures.status.xdr, PASS, { kind: 'status', signer: buyer, contractId }).length).toBeGreaterThan(0);
  });

  it('refuses a transaction calling a different function than asked', () => {
    const problems = transactionProblems(fixtures.dispute.xdr, PASS, { kind: 'release', signer: buyer, contractId });
    expect(problems.join(' ')).toMatch(/calls dispute_escrow, not release_funds/);
  });

  it('passes a dispute that matches', () => {
    expect(transactionProblems(fixtures.dispute.xdr, PASS, { kind: 'dispute', signer: buyer, contractId })).toEqual([]);
  });
});

describe('transactionProblems on transactions no escrow call looks like', () => {
  function build(ops: ReturnType<typeof Operation.payment>[], fee = BASE_FEE) {
    const tx = new TransactionBuilder(new Account(buyer, '1'), { fee, networkPassphrase: PASS });
    for (const op of ops) tx.addOperation(op);
    return tx.setTimeout(60).build().toXDR();
  }

  it('refuses a plain payment dressed up as a release', () => {
    const xdr = build([Operation.payment({ destination: stranger, asset: Asset.native(), amount: '100' })]);
    expect(transactionProblems(xdr, PASS, { kind: 'release', signer: buyer, contractId }).join(' ')).toMatch(/not an escrow call/);
  });

  it('refuses a signer change', () => {
    const xdr = build([Operation.setOptions({ signer: { ed25519PublicKey: stranger, weight: 1 } })]);
    expect(transactionProblems(xdr, PASS, { kind: 'release', signer: buyer, contractId }).join(' ')).toMatch(/not an escrow call/);
  });

  it('refuses more than one operation', () => {
    const pay = Operation.payment({ destination: stranger, asset: Asset.native(), amount: '1' });
    expect(transactionProblems(build([pay, pay]), PASS, { kind: 'release', signer: buyer, contractId }).join(' ')).toMatch(/2 operations/);
  });

  it('refuses a fee that is really a drain', () => {
    const xdr = build([Operation.payment({ destination: stranger, asset: Asset.native(), amount: '1' })], '50000000');
    expect(transactionProblems(xdr, PASS, { kind: 'release', signer: buyer, contractId }).join(' ')).toMatch(/fee is 5 XLM/);
  });

  it('refuses garbage', () => {
    expect(transactionProblems('not xdr', PASS, { kind: 'release', signer: buyer, contractId })[0]).toMatch(/could not be read/);
  });

});
