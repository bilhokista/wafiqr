// Which Stellar network this build talks to, and everything that differs
// between the two: the passphrase, Horizon, the Trustless Work API, and which
// USDC is real.
//
// One switch, read once. Testnet stays the default so a fresh clone can never
// move real money by accident; mainnet has to be asked for in the environment.
//
// The passphrases are written out rather than imported from the SDK: this file
// is read on first paint (config.ts needs it), and the SDK is a megabyte the
// market page has no use for. They are protocol constants and never change.

export type StellarNetwork = 'testnet' | 'mainnet';

export interface NetworkConfig {
  name: StellarNetwork;
  passphrase: string;
  horizonUrl: string;
  trustlessWorkUrl: string;
  /** The USDC that is actually USDC on this network. Anything else with the code is not. */
  usdcIssuer: string;
  /** The same USDC as a Soroban contract (its Stellar Asset Contract), which escrows hold. */
  usdcContract: string;
  /** Soroban RPC, used to read what code an escrow contract actually runs. */
  sorobanRpcUrl: string;
}

const CONFIGS: Record<StellarNetwork, NetworkConfig> = {
  testnet: {
    name: 'testnet',
    passphrase: 'Test SDF Network ; September 2015',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    trustlessWorkUrl: 'https://dev.api.trustlesswork.com',
    usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    usdcContract: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  },
  mainnet: {
    name: 'mainnet',
    passphrase: 'Public Global Stellar Network ; September 2015',
    horizonUrl: 'https://horizon.stellar.org',
    trustlessWorkUrl: 'https://api.trustlesswork.com',
    // Circle's issuer, as published in circle.com/.well-known/stellar.toml.
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
    usdcContract: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    sorobanRpcUrl: 'https://mainnet.sorobanrpc.com',
  },
};

export function resolveNetwork(value: string | undefined): NetworkConfig {
  const name = (value ?? '').trim().toLowerCase();
  if (name === '' || name === 'testnet') return CONFIGS.testnet;
  if (name === 'mainnet' || name === 'public') return CONFIGS.mainnet;
  // A typo here would otherwise fall through to testnet silently, and someone
  // would believe they had shipped to mainnet. Refusing is cheaper.
  throw new Error(`VITE_STELLAR_NETWORK must be "testnet" or "mainnet", got "${value}".`);
}

const resolved = resolveNetwork(import.meta.env.VITE_STELLAR_NETWORK);

export const NETWORK: NetworkConfig = {
  ...resolved,
  // Public RPCs come and go; let a deployment point at its own.
  sorobanRpcUrl: (import.meta.env.VITE_SOROBAN_RPC_URL ?? '').trim() || resolved.sorobanRpcUrl,
};

/**
 * SHA-256 of the Trustless Work single-release escrow WASM this app has
 * checked. Read from the two escrows that carried the testnet proof, and
 * identical to the hash the deployer is asked to instantiate. A WASM hash is
 * the code itself, so it is the same on every network; if Trustless Work ships
 * a new version, funding refuses until someone looks at it and updates this.
 */
export const TW_ESCROW_WASM_HASH =
  (import.meta.env.VITE_TW_ESCROW_WASM_HASH ?? '').trim().toLowerCase() ||
  '7c3f7b2af92ad86092708b23babf80f9e1308d7f3ce18b703b9499192ecc934b';

export const isMainnet = NETWORK.name === 'mainnet';
