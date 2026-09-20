// Bridges a marketplace Deal to a Trustless Work single-release escrow.
// The trade terms travel on-chain in the escrow title/description/milestone, so
// the contract itself records what was agreed — not just how much money moved.
import {
  approveMilestone,
  deploySingleRelease,
  disputeEscrow,
  fundEscrow,
  getEscrow,
  markShipped,
  releaseFunds,
  resolveDispute,
  USDC_TESTNET_ISSUER,
  type DeployBody,
  type EscrowState,
} from './trustlessWork';
import { appendEvidence, updateDealStatus } from './db';
import type { Deal, DealStatus } from './types';

/** The agreed terms, written into the escrow description so they are auditable. */
export function termsText(deal: Deal): string {
  return [
    `${deal.quantity} ${deal.unit} of ${deal.listingTitle}`,
    `Spec: ${deal.specs}`,
    `Incoterm: ${deal.incoterm}`,
    `Ship by: ${new Date(deal.shipBy).toISOString().slice(0, 10)}`,
    `Arbiter: ${deal.arbiterWallet}`,
  ].join(' · ');
}

export async function deployForDeal(deal: Deal): Promise<string> {
  const body: DeployBody = {
    signer: deal.buyerWallet,
    engagementId: `wafiqr-${deal.id}`,
    title: `${deal.listingTitle} — ${deal.quantity} ${deal.unit}`,
    description: termsText(deal),
    amount: deal.amount,
    platformFee: 0,
    roles: {
      approver: deal.buyerWallet,
      serviceProvider: deal.sellerWallet,
      releaseSigner: deal.buyerWallet,
      platformAddress: deal.buyerWallet,
      disputeResolver: deal.arbiterWallet,
      receiver: deal.sellerWallet,
    },
    milestones: [
      { description: `Goods shipped and received per ${deal.incoterm}, by ${new Date(deal.shipBy).toISOString().slice(0, 10)}` },
    ],
    trustline: { address: USDC_TESTNET_ISSUER, symbol: 'USDC' },
  };
  const res = await deploySingleRelease(body);
  const contractId = res.contractId ?? res.escrow?.contractId ?? '';
  if (!contractId) throw new Error('Escrow deployed but no contractId came back');
  await updateDealStatus(deal.id, 'deployed', contractId);
  return contractId;
}

export async function fundForDeal(deal: Deal) {
  await fundEscrow({ contractId: deal.contractId, signer: deal.buyerWallet, amount: deal.amount });
  await updateDealStatus(deal.id, 'funded');
}

export async function shipForDeal(
  deal: Deal,
  proof: { trackingNumber: string; note: string; link?: string },
) {
  const evidence = `${proof.trackingNumber} · ${proof.note}${proof.link ? ` · ${proof.link}` : ''}`;
  await markShipped({ contractId: deal.contractId, serviceProvider: deal.sellerWallet, evidence });
  await appendEvidence(deal.id, {
    kind: 'shipment',
    note: proof.note,
    link: proof.link,
    trackingNumber: proof.trackingNumber,
    byUid: deal.sellerUid,
    byRole: 'seller',
    at: Date.now(),
  });
  await updateDealStatus(deal.id, 'shipped');
}

export async function approveForDeal(deal: Deal, note: string) {
  await approveMilestone({ contractId: deal.contractId, approver: deal.buyerWallet, milestoneIndex: '0' });
  await appendEvidence(deal.id, {
    kind: 'inspection',
    note: note || 'Buyer confirmed the goods arrived as specified.',
    byUid: deal.buyerUid,
    byRole: 'buyer',
    at: Date.now(),
  });
  await updateDealStatus(deal.id, 'approved');
}

export async function releaseForDeal(deal: Deal) {
  await releaseFunds({ contractId: deal.contractId, releaseSigner: deal.buyerWallet });
  await updateDealStatus(deal.id, 'released');
}

export async function disputeForDeal(
  deal: Deal,
  by: { uid: string; role: 'buyer' | 'seller'; wallet: string },
  reason: string,
) {
  await disputeEscrow({ contractId: deal.contractId, signer: by.wallet });
  await appendEvidence(deal.id, {
    kind: 'dispute',
    note: reason,
    byUid: by.uid,
    byRole: by.role,
    at: Date.now(),
  });
  await updateDealStatus(deal.id, 'disputed');
}

/** Arbiter splits the locked balance after reading the evidence trail. */
export async function resolveForDeal(
  deal: Deal,
  split: { toBuyer: number; toSeller: number },
  reasoning: string,
) {
  await resolveDispute({
    contractId: deal.contractId,
    disputeResolver: deal.arbiterWallet,
    distributions: [
      { address: deal.buyerWallet, amount: split.toBuyer },
      { address: deal.sellerWallet, amount: split.toSeller },
    ],
  });
  await appendEvidence(deal.id, {
    kind: 'dispute',
    note: `Arbiter ruling — buyer ${split.toBuyer} USDC, seller ${split.toSeller} USDC. ${reasoning}`,
    byUid: 'arbiter',
    byRole: 'arbiter',
    at: Date.now(),
  });
  await updateDealStatus(deal.id, 'resolved');
}

/** On-chain truth wins over the Firestore mirror when the two disagree. */
export function statusFromChain(escrow: EscrowState): DealStatus {
  if (escrow.flags.resolved) return 'resolved';
  if (escrow.flags.released) return 'released';
  if (escrow.flags.disputed) return 'disputed';
  const milestone = escrow.milestones[0];
  if (milestone?.approved) return 'approved';
  if (milestone?.status === 'shipped') return 'shipped';
  return escrow.balance > 0 ? 'funded' : 'deployed';
}

export async function syncFromChain(deal: Deal): Promise<DealStatus> {
  if (!deal.contractId) return deal.status;
  const escrow = await getEscrow(deal.contractId);
  if (!escrow) return deal.status;
  const status = statusFromChain(escrow);
  if (status !== deal.status) await updateDealStatus(deal.id, status);
  return status;
}
