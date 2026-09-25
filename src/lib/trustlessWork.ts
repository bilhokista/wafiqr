// Trustless Work REST client (single-release escrow), on whichever network
// network.ts selects. Docs: https://docs.trustlesswork.com — every write
// endpoint returns an unsigned XDR; the caller signs it with a wallet and
// submits it via /helper/send-transaction.
import axios from 'axios';
import { signXdr } from './wallet';
import { NETWORK, TW_ESCROW_WASM_HASH } from './network';
import { assertTransactionMatches, type DealParties, type TwIntent } from './txGuard';
import { assertIsCheckedEscrow } from './escrowCode';

export const USDC_ISSUER = NETWORK.usdcIssuer;

const http = axios.create({
  baseURL: NETWORK.trustlessWorkUrl,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_TW_API_KEY ?? '',
  },
});

export interface Roles {
  approver: string; // buyer — approves that goods were received
  serviceProvider: string; // seller
  releaseSigner: string; // who triggers the release (buyer here)
  platformAddress: string; // wafiqr fee address
  disputeResolver: string; // arbiter
  receiver: string; // seller — receives the funds
}

export interface DeployBody {
  signer: string;
  engagementId: string;
  title: string;
  description: string;
  roles: Roles;
  amount: number;
  platformFee: number;
  milestones: { description: string; status?: string; approved?: boolean }[];
  trustline: { address: string; symbol: string };
}

async function unsigned(path: string, body: unknown): Promise<string> {
  try {
    const { data } = await http.post(path, body);
    return data.unsignedTransaction as string;
  } catch (e) {
    const err = e as import('axios').AxiosError;
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`${path} → ${err.response?.status ?? ''} ${detail}`);
  }
}

/** Submit a wallet-signed XDR to the network. */
export async function sendSigned(signedXdr: string) {
  const { data } = await http.post('/helper/send-transaction', { signedXdr });
  return data;
}

/**
 * unsigned -> checked against what was asked -> signed -> submitted.
 *
 * The check sits between the API and the wallet on purpose: it applies to
 * Freighter users too, who would otherwise be trusted to read raw contract
 * arguments in an extension popup.
 */
export async function run(path: string, body: unknown, intent: TwIntent) {
  const xdr = await unsigned(path, body);
  assertTransactionMatches(xdr, NETWORK.passphrase, intent);
  const signed = await signXdr(xdr, intent.signer);
  return sendSigned(signed);
}

// --- Single-release operations (each is: build body, then run()) -----------

/** The parties a deploy body names, so the returned transaction can be held to them. */
function partiesOf(b: DeployBody): DealParties {
  return {
    buyer: b.roles.approver,
    seller: b.roles.receiver,
    arbiter: b.roles.disputeResolver,
    usdcContract: NETWORK.usdcContract,
  };
}

export const deploySingleRelease = (b: DeployBody) =>
  run('/deployer/single-release', b, {
    kind: 'deploy',
    signer: b.signer,
    amount: b.amount,
    parties: partiesOf(b),
    wasmHash: TW_ESCROW_WASM_HASH,
  });

/**
 * Funding is the one call that moves the buyer's money, so it gets the one
 * check that asks the chain rather than the API: is this contract really the
 * escrow code this app has checked?
 */
export async function fundEscrow(b: { contractId: string; signer: string; amount: number; parties: DealParties }) {
  await assertIsCheckedEscrow(b.contractId);
  return run(
    '/escrow/single-release/fund-escrow',
    { contractId: b.contractId, signer: b.signer, amount: b.amount },
    { kind: 'fund', signer: b.signer, contractId: b.contractId, amount: b.amount, parties: b.parties },
  );
}

export const approveMilestone = (b: { contractId: string; approver: string; milestoneIndex?: string }) =>
  run(
    '/escrow/single-release/approve-milestone',
    { contractId: b.contractId, milestoneIndex: b.milestoneIndex ?? '0', approver: b.approver },
    { kind: 'approve', signer: b.approver, contractId: b.contractId },
  );

// Seller records shipment evidence on-chain against the milestone.
export const markShipped = (b: { contractId: string; serviceProvider: string; evidence: string }) =>
  run(
    '/escrow/single-release/change-milestone-status',
    {
      contractId: b.contractId,
      milestoneIndex: '0',
      newStatus: 'shipped',
      newEvidence: b.evidence,
      serviceProvider: b.serviceProvider,
    },
    { kind: 'status', signer: b.serviceProvider, contractId: b.contractId },
  );

export const releaseFunds = (b: { contractId: string; releaseSigner: string }) =>
  run(
    '/escrow/single-release/release-funds',
    { contractId: b.contractId, releaseSigner: b.releaseSigner },
    { kind: 'release', signer: b.releaseSigner, contractId: b.contractId },
  );

// Either party (buyer or seller) can open a dispute; the API field is `signer`.
export const disputeEscrow = (b: { contractId: string; signer: string }) =>
  run(
    '/escrow/single-release/dispute-escrow',
    { contractId: b.contractId, signer: b.signer },
    { kind: 'dispute', signer: b.signer, contractId: b.contractId },
  );

// Amounts must sum the escrow balance at resolution time (read it with getBalances).
export const resolveDispute = (b: {
  contractId: string;
  disputeResolver: string;
  distributions: { address: string; amount: number }[];
}) =>
  run(
    '/escrow/single-release/resolve-dispute',
    { contractId: b.contractId, disputeResolver: b.disputeResolver, distributions: b.distributions },
    { kind: 'resolve', signer: b.disputeResolver, contractId: b.contractId, distributions: b.distributions },
  );

export async function getBalances(contractIds: string[]): Promise<{ address: string; balance: number }[]> {
  const query = contractIds.map((id) => `addresses[]=${encodeURIComponent(id)}`).join('&');
  const { data } = await http.get(`/helper/get-multiple-escrow-balance?${query}`);
  return data;
}

export interface EscrowState {
  contractId: string;
  balance: number;
  flags: { disputed: boolean; released: boolean; resolved: boolean };
  milestones: { status: string; evidence: string; approved: boolean }[];
}

export async function getEscrow(contractId: string): Promise<EscrowState | undefined> {
  const { data } = await http.get(
    `/helper/get-escrow-by-contract-ids?contractIds[]=${encodeURIComponent(contractId)}`,
  );
  return data[0];
}
