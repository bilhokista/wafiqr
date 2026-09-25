import { describe, expect, it } from 'vitest';
import { Keypair } from '@stellar/stellar-sdk';
import { destinationProblems, memoFor } from './destination';
import type { ExchangeDestination } from './types';

const EXCHANGE = Keypair.random().publicKey();
const SELLER = Keypair.random().publicKey();

function dest(partial: Partial<ExchangeDestination> = {}): ExchangeDestination {
  return { exchange: 'Indodax', address: EXCHANGE, memo: '123456', memoType: 'id', asset: 'XLM', ...partial };
}

describe('destinationProblems', () => {
  it('accepts a complete destination', () => {
    expect(destinationProblems(dest(), SELLER)).toEqual([]);
  });

  it('refuses a missing memo, because the money would belong to nobody', () => {
    expect(destinationProblems(dest({ memo: '  ' }), SELLER).join(' ')).toMatch(/belongs to nobody/);
  });

  it('refuses letters in an ID memo', () => {
    expect(destinationProblems(dest({ memo: 'abc' }), SELLER).join(' ')).toMatch(/whole number/);
  });

  it('refuses an ID memo past uint64', () => {
    expect(destinationProblems(dest({ memo: '18446744073709551616' }), SELLER).join(' ')).toMatch(/whole number/);
  });

  it('accepts the largest uint64 as an ID memo', () => {
    expect(destinationProblems(dest({ memo: '18446744073709551615' }), SELLER)).toEqual([]);
  });

  it('refuses a text memo over 28 bytes', () => {
    expect(destinationProblems(dest({ memoType: 'text', memo: 'x'.repeat(29) }), SELLER).join(' ')).toMatch(/28 bytes/);
    expect(destinationProblems(dest({ memoType: 'text', memo: 'x'.repeat(28) }), SELLER)).toEqual([]);
  });

  it('refuses an address that is not a Stellar account', () => {
    expect(destinationProblems(dest({ address: 'GNOTANADDRESS' }), SELLER).join(' ')).toMatch(/starting with G/);
  });

  it('refuses sending to the seller’s own wallet', () => {
    expect(destinationProblems(dest({ address: SELLER }), SELLER).join(' ')).toMatch(/not your exchange/);
  });

  it('needs the exchange named for the record', () => {
    expect(destinationProblems(dest({ exchange: '' }), SELLER).join(' ')).toMatch(/Name the exchange/);
  });
});

describe('memoFor', () => {
  it('builds the memo type the exchange asked for', () => {
    expect(memoFor(dest()).type).toBe('id');
    expect(memoFor(dest({ memoType: 'text', memo: 'AB12' })).type).toBe('text');
  });
});
