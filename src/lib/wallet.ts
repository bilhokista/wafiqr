// Wallet integration via Stellar Wallets Kit (Freighter and friends), testnet.
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  allowAllModules,
} from '@creit.tech/stellar-wallets-kit';

export const NETWORK_PASSPHRASE = WalletNetwork.TESTNET;

const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
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

/** Signs an unsigned XDR with the connected wallet. */
export async function signXdr(unsignedXdr: string, address: string): Promise<string> {
  const { signedTxXdr } = await kit.signTransaction(unsignedXdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  return signedTxXdr;
}
