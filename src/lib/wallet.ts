// Signing, whichever wallet holds the key.
//
// Two kinds sit behind one call. An embedded wallet (embeddedWallet.ts) is
// unlocked in this tab and signs directly. Anything else goes to Stellar
// Wallets Kit — Freighter and friends — for people who already hold their own.
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';
import { isKnownEmbedded, signWithEmbedded } from './embeddedWallet';
import { NETWORK, isMainnet } from './network';

export const NETWORK_PASSPHRASE = NETWORK.passphrase;

const kit = new StellarWalletsKit({
  network: isMainnet ? WalletNetwork.PUBLIC : WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

/** Opens the wallet picker and returns the connected address. */
export async function connectWallet(): Promise<string> {
  return new Promise((resolve, reject) => {
    kit.openModal({
      onWalletSelected: async (option) => {
        try {
          kit.setWallet(option.id);
          const { address } = await kit.getAddress();
          resolve(address);
        } catch (e) {
          reject(e);
        }
      },
      onClosed: () => reject(new Error('Wallet selection cancelled')),
    });
  });
}

/** Signs an unsigned XDR with whichever wallet holds `address`. */
export async function signXdr(unsignedXdr: string, address: string): Promise<string> {
  const embedded = signWithEmbedded(unsignedXdr, address);
  if (embedded) return embedded;
  if (isKnownEmbedded(address)) {
    // Handing a wafiqr wallet's transaction to Freighter would only produce a
    // confusing error there. Say what is actually wrong.
    throw new Error('Your wafiqr wallet is locked. Unlock it on your account page, then try again.');
  }
  const { signedTxXdr } = await kit.signTransaction(unsignedXdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}
