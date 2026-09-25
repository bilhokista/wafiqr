// A Stellar wallet for people who have never heard of one.
//
// A producer in a village and a buyer in Singapore should not have to install
// a browser extension to use escrow. So wafiqr can make the wallet itself — but
// only in a way that leaves wafiqr unable to spend from it. The keypair is
// generated in this browser, sealed under the owner's passphrase (vault.ts),
// and only the sealed box is stored. Unlocked, the key lives in this tab's
// memory and nowhere else.
//
// If wafiqr could sign for a user, wafiqr would be a custodian, and custody of
// someone else's digital assets is a licensed activity. This file is written so
// that it cannot.
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import { loadVault, saveVault } from './db';
import { NETWORK } from './network';
import { open, seal } from './vault';
import type { WalletVault } from './types';

const LOCAL_PREFIX = 'wafiqr.vault.';

/** Unlocked keys, by public key. Memory only: a reload locks everything. */
const unlocked = new Map<string, Keypair>();

/** Public keys known to be embedded wallets, locked or not. */
const known = new Set<string>();

/** UI subscribers, told when a wallet locks or unlocks. The key state lives here, not in React. */
const listeners = new Set<() => void>();

export function onWalletChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function changed() {
  for (const listener of listeners) listener();
}

function readLocal(uid: string): WalletVault | null {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + uid);
    return raw ? (JSON.parse(raw) as WalletVault) : null;
  } catch {
    // Private windows and blocked storage throw on access. Firestore still has it.
    return null;
  }
}

function writeLocal(vault: WalletVault) {
  try {
    localStorage.setItem(LOCAL_PREFIX + vault.uid, JSON.stringify(vault));
  } catch {
    // Same as above: losing the local copy costs a network read, nothing more.
  }
}

/** The sealed wallet for this account, from this device first, then the cloud copy. */
export async function findVault(uid: string): Promise<WalletVault | null> {
  const local = readLocal(uid);
  if (local) {
    known.add(local.publicKey);
    return local;
  }
  const remote = await loadVault(uid);
  if (remote) {
    known.add(remote.publicKey);
    writeLocal(remote);
  }
  return remote;
}

async function store(uid: string, keypair: Keypair, passphrase: string): Promise<WalletVault> {
  const vault: WalletVault = {
    uid,
    publicKey: keypair.publicKey(),
    sealed: await seal(keypair.secret(), passphrase),
    createdAt: Date.now(),
  };
  // Cloud first: if that write fails, the user must not walk away believing
  // they have a recoverable wallet that exists only in one browser.
  await saveVault(vault);
  writeLocal(vault);
  known.add(vault.publicKey);
  unlocked.set(vault.publicKey, keypair);
  changed();
  return vault;
}

/**
 * Makes a new wallet and returns its secret exactly once, for the owner to
 * write down. After this call the plaintext secret exists only in their hands
 * and, until reload, in this tab.
 */
export async function createEmbeddedWallet(uid: string, passphrase: string) {
  if (await findVault(uid)) {
    throw new Error('This account already has a wallet. Unlock it instead of making a second one.');
  }
  const keypair = Keypair.random();
  const vault = await store(uid, keypair, passphrase);
  return { publicKey: vault.publicKey, secret: keypair.secret() };
}

/** Restores from the written-down secret, e.g. after forgetting the passphrase. */
export async function importEmbeddedWallet(uid: string, secret: string, passphrase: string) {
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(secret.trim());
  } catch {
    throw new Error('That is not a Stellar secret key. It starts with S and is 56 characters long.');
  }
  const existing = await findVault(uid);
  if (existing && existing.publicKey !== keypair.publicKey()) {
    // Swapping the key under an account would strand every escrow that pays
    // the old address. The rules refuse it too; this says why in words.
    throw new Error(`That secret belongs to a different wallet than this account's (${existing.publicKey.slice(0, 5)}…). Use the secret you wrote down for this account.`);
  }
  const vault = await store(uid, keypair, passphrase);
  return vault.publicKey;
}

export async function unlockEmbeddedWallet(uid: string, passphrase: string): Promise<string> {
  const vault = await findVault(uid);
  if (!vault) throw new Error('No wallet on this account yet.');
  const keypair = Keypair.fromSecret(await open(vault.sealed, passphrase));
  if (keypair.publicKey() !== vault.publicKey) {
    throw new Error('The vault opened to a different key than it claims. Do not use it; restore from your secret.');
  }
  unlocked.set(vault.publicKey, keypair);
  changed();
  return vault.publicKey;
}

export function lockEmbeddedWallets() {
  unlocked.clear();
  changed();
}

export function isEmbeddedUnlocked(address: string): boolean {
  return unlocked.has(address);
}

/** True for an embedded wallet this tab has seen, whether or not it is unlocked. */
export function isKnownEmbedded(address: string): boolean {
  return known.has(address);
}

/** Signs with an unlocked embedded key. Returns null when the address is not one. */
export function signWithEmbedded(unsignedXdr: string, address: string): string | null {
  const keypair = unlocked.get(address);
  if (!keypair) return null;
  const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK.passphrase);
  tx.sign(keypair);
  return tx.toXDR();
}
