// Deployment-wide addresses. The arbiter is a third account by design: the
// Trustless Work contract rejects a dispute opened by its own dispute resolver.
import { isMainnet } from './network';

/** The testnet pilot's arbiter. Only ever a fallback on testnet. */
const TESTNET_ARBITER = 'GBFRCU73YKD5NUWBL2SLSZHBAP6IH3MNWIKMUYOIZXGBIUP74WLTGGNJ';

function arbiterWallet(): string {
  const configured = (import.meta.env.VITE_ARBITER_ADDRESS ?? '').trim();
  if (configured) return configured;
  // On mainnet the arbiter decides where real money goes in a dispute. Falling
  // back to a pilot key nobody chose for that job would be worse than not
  // starting, so the build refuses.
  if (isMainnet) throw new Error('VITE_ARBITER_ADDRESS must be set for mainnet.');
  return TESTNET_ARBITER;
}

export const ARBITER_WALLET = arbiterWallet();

/**
 * DHL tracking key, read-only and optional.
 *
 * Absent during the pilot, in which case waybills are recorded exactly as the
 * seller typed them and the deal room says they are unverified — which is the
 * truth, and better than a green tick nobody earned.
 */
export const DHL_API_KEY: string = import.meta.env.VITE_DHL_API_KEY ?? '';
