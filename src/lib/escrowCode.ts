// Before money goes into an escrow, check the escrow is an escrow.
//
// The contract id comes back from the Trustless Work API when the escrow is
// deployed. Funding sends USDC to whatever that id runs. So the chain is asked
// directly — not the API — for the code behind the id, and funding goes ahead
// only if it is byte-for-byte the escrow this app has checked.
import { rpc } from '@stellar/stellar-sdk';
import { NETWORK, TW_ESCROW_WASM_HASH } from './network';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes); // detach from any shared buffer before hashing
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function escrowCodeHash(contractId: string): Promise<string> {
  const server = new rpc.Server(NETWORK.sorobanRpcUrl);
  return sha256Hex(await server.getContractWasmByContractId(contractId));
}

export async function assertIsCheckedEscrow(contractId: string) {
  const actual = await escrowCodeHash(contractId);
  if (actual !== TW_ESCROW_WASM_HASH) {
    throw new Error(
      `Not funded. Contract ${contractId} runs code ${actual.slice(0, 12)}…, not the Trustless Work escrow this app has checked (${TW_ESCROW_WASM_HASH.slice(0, 12)}…). If Trustless Work has released a new version, review it and set VITE_TW_ESCROW_WASM_HASH.`,
    );
  }
}
