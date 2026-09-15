// Trustless Work REST client (single-release escrow), testnet.
// Docs: https://docs.trustlesswork.com — every write endpoint returns an unsigned
// XDR; the caller signs it with a wallet and submits it via /helper/send-transaction.
import axios from 'axios';
import { signXdr } from './wallet';

export const USDC_TESTNET_ISSUER =
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

const http = axios.create({
  baseURL: 'https://dev.api.trustlesswork.com',
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

/** unsigned -> sign with wallet -> submit. Returns the network response. */
export async function run(path: string, body: unknown, signerAddress: string) {
  const xdr = await unsigned(path, body);
  const signed = await signXdr(xdr, signerAddress);
  return sendSigned(signed);
}

// --- Single-release operations (each is: build body, then run()) -----------

export const deploySingleRelease = (b: DeployBody) =>
  run('/deployer/single-release', b, b.signer);

export const fundEscrow = (
  b: { contractId: string; signer: string; amount: number },
) => run('/escrow/single-release/fund-escrow', b, b.signer);

export const approveMilestone = (b: { contractId: string; approver: string; milestoneIndex?: string }) =>
  run(
    '/escrow/single-release/approve-milestone',
    { contractId: b.contractId, milestoneIndex: b.milestoneIndex ?? '0', approver: b.approver },
    b.approver,
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
    b.serviceProvider,
  );

export const releaseFunds =(b: { contractId: string; releaseSigner: string }) =>
  run(
    '/escrow/single-release/release-funds',
    { contractId: b.contractId, releaseSigner: b.releaseSigner },
    b.releaseSigner,
  );

// Either party (buyer or seller) can open a dispute; the API field is `signer`.
export const disputeEscrow = (b: { contractId: string; signer: string }) =>
  run('/escrow/single-release/dispute-escrow', { contractId: b.contractId, signer: b.signer }, b.signer);

// Amounts must sum the escrow balance at resolution time (read it with getBalances).
export const resolveDispute = (b: {
  contractId: string;
  disputeResolver: string;
  distributions: { address: string; amount: number }[];
}) =>
  run(
    '/escrow/single-release/resolve-dispute',
    { contractId: b.contractId, disputeResolver: b.disputeResolver, distributions: b.distributions },
    b.disputeResolver,
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
