import { describe, expect, it } from 'vitest';
import { amount7, spendableXlm } from './amounts';
import { Networks } from '@stellar/stellar-sdk';
import { resolveNetwork } from './network';

describe('spendableXlm', () => {
  it('keeps the two base reserves and the fee headroom', () => {
    expect(spendableXlm({ balance: 10, subentries: 0, sponsoring: 0, sponsored: 0, sellingLiabilities: 0 })).toBeCloseTo(8.9);
  });

  it('locks half an XLM per trustline', () => {
    expect(spendableXlm({ balance: 10, subentries: 1, sponsoring: 0, sponsored: 0, sellingLiabilities: 0 })).toBeCloseTo(8.4);
  });

  it('never goes negative', () => {
    expect(spendableXlm({ balance: 1, subentries: 3, sponsoring: 0, sponsored: 0, sellingLiabilities: 0 })).toBe(0);
  });

  it('subtracts XLM already promised to open offers', () => {
    expect(spendableXlm({ balance: 10, subentries: 0, sponsoring: 0, sponsored: 0, sellingLiabilities: 2 })).toBeCloseTo(6.9);
  });
});

describe('amount7', () => {
  it('writes seven decimals', () => {
    expect(amount7(25)).toBe('25.0000000');
  });

  it('rounds down past seven decimals', () => {
    expect(amount7(1.123456789)).toBe('1.1234567');
  });

  it('does not lose a stroop to float error', () => {
    expect(amount7(1.0000001)).toBe('1.0000001');
    expect(amount7(0.1 + 0.2)).toBe('0.3000000');
  });
});

describe('resolveNetwork', () => {
  it('defaults to testnet', () => {
    expect(resolveNetwork(undefined).name).toBe('testnet');
    expect(resolveNetwork('').name).toBe('testnet');
  });

  it('matches the SDK’s passphrases, which it spells out to stay out of the first bundle', () => {
    expect(resolveNetwork('testnet').passphrase).toBe(Networks.TESTNET);
    expect(resolveNetwork('mainnet').passphrase).toBe(Networks.PUBLIC);
  });

  it('uses Circle’s issuer on mainnet', () => {
    const mainnet = resolveNetwork('mainnet');
    expect(mainnet.usdcIssuer).toBe('GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN');
    expect(mainnet.trustlessWorkUrl).toBe('https://api.trustlesswork.com');
  });

  it('refuses a typo rather than silently choosing testnet', () => {
    expect(() => resolveNetwork('mainet')).toThrow(/must be "testnet" or "mainnet"/);
  });
});
