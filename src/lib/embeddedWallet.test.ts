import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Account, Keypair, Networks, Operation, TransactionBuilder, BASE_FEE } from '@stellar/stellar-sdk';
import type { WalletVault } from './types';

// Firestore stands in as a map, so the test can read exactly what would be
// stored in the cloud and check that it holds no secret.
const cloud = new Map<string, WalletVault>();
vi.mock('./db', () => ({
  saveVault: async (vault: WalletVault) => void cloud.set(vault.uid, structuredClone(vault)),
  loadVault: async (uid: string) => cloud.get(uid) ?? null,
}));

// Fast key stretching for tests only.
vi.mock('./vault', async (original) => {
  const real = await original<typeof import('./vault')>();
  return { ...real, seal: (secret: string, passphrase: string) => real.seal(secret, passphrase, 1_000) };
});

const wallet = await import('./embeddedWallet');

function unsignedPayment(from: string): string {
  const account = new Account(from, '1');
  return new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
    .setTimeout(60)
    .build()
    .toXDR();
}

const PASS = 'a long enough passphrase';

describe('embedded wallet', () => {
  beforeEach(() => {
    cloud.clear();
    wallet.lockEmbeddedWallets();
  });

  it('stores only ciphertext in the cloud copy', async () => {
    const { publicKey, secret } = await wallet.createEmbeddedWallet('u1', PASS);
    const stored = JSON.stringify(cloud.get('u1'));
    expect(stored).toContain(publicKey);
    expect(stored).not.toContain(secret);
  });

  it('signs with the key it made, and only while unlocked', async () => {
    const { publicKey } = await wallet.createEmbeddedWallet('u1', PASS);
    const xdr = unsignedPayment(publicKey);

    const signed = wallet.signWithEmbedded(xdr, publicKey);
    expect(signed).not.toBeNull();
    const tx = TransactionBuilder.fromXDR(signed!, Networks.TESTNET);
    expect(Keypair.fromPublicKey(publicKey).verify(tx.hash(), tx.signatures[0].signature.value)).toBe(true);

    wallet.lockEmbeddedWallets();
    expect(wallet.signWithEmbedded(xdr, publicKey)).toBeNull();
    expect(wallet.isKnownEmbedded(publicKey)).toBe(true);
  });

  it('unlocks with the passphrase and refuses a wrong one', async () => {
    const { publicKey } = await wallet.createEmbeddedWallet('u1', PASS);
    wallet.lockEmbeddedWallets();
    await expect(wallet.unlockEmbeddedWallet('u1', 'not the passphrase at all')).rejects.toThrow(/does not open/);
    expect(await wallet.unlockEmbeddedWallet('u1', PASS)).toBe(publicKey);
    expect(wallet.isEmbeddedUnlocked(publicKey)).toBe(true);
  });

  it('will not make a second wallet over the first', async () => {
    await wallet.createEmbeddedWallet('u1', PASS);
    await expect(wallet.createEmbeddedWallet('u1', PASS)).rejects.toThrow(/already has a wallet/);
  });

  it('restores from the written-down secret under a new passphrase', async () => {
    const { publicKey, secret } = await wallet.createEmbeddedWallet('u1', PASS);
    wallet.lockEmbeddedWallets();
    expect(await wallet.importEmbeddedWallet('u1', secret, 'a brand new passphrase')).toBe(publicKey);
    wallet.lockEmbeddedWallets();
    expect(await wallet.unlockEmbeddedWallet('u1', 'a brand new passphrase')).toBe(publicKey);
  });

  it('refuses to restore a different wallet over this account’s', async () => {
    await wallet.createEmbeddedWallet('u1', PASS);
    const stranger = Keypair.random().secret();
    await expect(wallet.importEmbeddedWallet('u1', stranger, PASS)).rejects.toThrow(/different wallet/);
  });
});
