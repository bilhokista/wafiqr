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
  USDC_ISSUER,
  type DeployBody,
  type EscrowState,
} from './trustlessWork';
import { appendEvidence, getPayout, savePayout, updateDealStatus, updatePayout } from './db';
import {
  activeProvider,
  newPayout,
  quoteForDeal,
  repatriationCheck,
  settlementText,
  submitForDeal,
  type QuoteInput,
} from './payout';
import {
  checkEvidence,
  checkShipment,
  checkText,
  contradictsShipping,
  couriers,
} from './courier';
import { sendCashout } from './cashout';
import { accountState } from './trustline';
import { NETWORK } from './network';
import type { Deal, DealStatus, ExchangeDestination, PayoutRail, SettlementRecord } from './types';

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
    trustline: { address: USDC_ISSUER, symbol: 'USDC' },
  };
  const res = await deploySingleRelease(body);
  const contractId = res.contractId ?? res.escrow?.contractId ?? '';
  if (!contractId) throw new Error('Escrow deployed but no contractId came back');
  await updateDealStatus(deal.id, 'deployed', contractId);
  return contractId;
}

export async function fundForDeal(deal: Deal) {
  await fundEscrow({
    contractId: deal.contractId,
    signer: deal.buyerWallet,
    amount: deal.amount,
    parties: {
      buyer: deal.buyerWallet,
      seller: deal.sellerWallet,
      arbiter: deal.arbiterWallet,
      usdcContract: NETWORK.usdcContract,
    },
  });
  await updateDealStatus(deal.id, 'funded');
}

export async function shipForDeal(
  deal: Deal,
  proof: { trackingNumber: string; note: string; link?: string },
) {
  // Ask the courier before writing anything on chain. A waybill nobody has
  // heard of is the one thing worth stopping for: it is the difference between
  // a shipment that is early and a shipment that does not exist, and the buyer
  // cannot tell them apart from a string in a text box.
  const check = couriers().length > 0 ? await checkShipment(proof.trackingNumber).catch(() => null) : null;

  if (check && contradictsShipping(check)) {
    throw new Error(
      `${check.courier} has no record of ${proof.trackingNumber}. Check the number, or wait until the parcel is collected and file again.`,
    );
  }

  // The courier's reading travels on chain with the seller's note, so the
  // escrow's own record carries the independent line rather than only ours.
  const verified = check ? ` · ${checkText(proof.trackingNumber, check)}` : '';
  const evidence = `${proof.trackingNumber} · ${proof.note}${proof.link ? ` · ${proof.link}` : ''}${verified}`;
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

  // Filed separately and under the arbiter's role, because the seller did not
  // say it. Keeping it in its own entry is what lets a reader see which lines
  // are claims and which are not.
  if (check) await appendEvidence(deal.id, checkEvidence(proof.trackingNumber, check, deal.sellerUid));

  await updateDealStatus(deal.id, 'shipped');
}

/**
 * Re-checks a waybill after shipping, for the buyer or the arbiter.
 *
 * Deliberately does not touch the deal status. A courier saying "delivered"
 * means a parcel reached an address; it does not mean the oil matches the
 * sample, and releasing on a delivery scan would pay a seller for shipping a
 * brick. The buyer still confirms.
 */
export async function recheckShipment(deal: Deal, trackingNumber: string, byUid: string) {
  const check = await checkShipment(trackingNumber);
  await appendEvidence(deal.id, checkEvidence(trackingNumber, check, byUid));
  return check;
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

  // Release is where this used to end, with USDC sitting in the seller's
  // Stellar account. For a village producer that is not payment, it is a
  // balance in an asset they never asked for. Opening the payout record here
  // means the deal room can show the last mile as unfinished rather than
  // showing a green tick over a seller who still cannot buy anything.
  const rail: PayoutRail = deal.payoutRail ?? 'wallet';
  if (!(await getPayout(deal.id))) {
    await savePayout(newPayout(deal, rail, activeProvider().name));
  }
}

/**
 * Quotes the conversion without committing the seller to it.
 *
 * Separate from sending on purpose: the seller sees the rate while the money
 * is still theirs in USDC, and can walk away from a bad one.
 */
export async function quotePayout(deal: Deal, input: QuoteInput) {
  const quote = await quoteForDeal(deal, input);
  await updatePayout(deal.id, { status: 'quoted', quotedIdr: quote.idrAmount });
  return quote;
}

/**
 * Hands the conversion to the licensed provider.
 *
 * wafiqr's involvement ends at this call. Custody passes to the provider, who
 * holds it under their licence for as long as the conversion takes, and the
 * only thing that comes back is a reference.
 */
export async function sendPayout(deal: Deal, input: QuoteInput & { from: string }) {
  const check = repatriationCheck(deal.payoutRail ?? 'wallet', input.bankCode);

  try {
    const reference = await submitForDeal(deal, { ...input, engagementId: deal.id });
    await updatePayout(deal.id, { status: 'submitted', provider: activeProvider().name });
    await appendEvidence(deal.id, {
      kind: 'inspection',
      note: check.ok
        ? `Payout submitted to ${activeProvider().name}, ref ${reference}.`
        : `Payout submitted to ${activeProvider().name}, ref ${reference}. ${check.reason}`,
      byUid: deal.sellerUid,
      byRole: 'seller',
      at: Date.now(),
    });
    return reference;
  } catch (error: unknown) {
    // Kept verbatim. A provider's refusal is the most useful sentence in the
    // whole flow and summarising it loses the reason.
    const failure = error instanceof Error ? error.message : String(error);
    await updatePayout(deal.id, { status: 'failed', failure });
    throw error;
  }
}

/**
 * Records what the provider says happened, once it has.
 *
 * wafiqr asserts none of it. The settlement is the provider's account of the
 * onshore leg, written down with a timestamp so both sides and the exporter's
 * accountant read the same line.
 */
export async function recordSettlement(deal: Deal, settlement: SettlementRecord) {
  await updatePayout(deal.id, { status: 'settled', settlement });
  await appendEvidence(deal.id, {
    kind: 'inspection',
    note: `Settled · ${settlementText(settlement)}`,
    byUid: deal.sellerUid,
    byRole: 'seller',
    at: settlement.settledAt,
  });
}

/**
 * Sends the released USDC to the seller's own exchange account.
 *
 * The seller signs; wafiqr only built the payment. What gets recorded is the
 * transaction hash and where it went, so the seller, the buyer and anyone the
 * seller later shows it to can follow the money to the exchange's door.
 */
/**
 * What a cash-out can send. Trustless Work takes its fee at release, so the
 * seller holds a little less than the deal amount. Send what is really there,
 * capped at the payout's frozen figure, so USDC the seller holds from
 * elsewhere stays put.
 */
export async function cashoutAmount(deal: Deal, frozen = deal.amount): Promise<number> {
  const { usdc: held } = await accountState(deal.sellerWallet);
  return Math.min(frozen, held);
}

/** Deals with a cash-out being built in this tab. Stops a double click from paying twice. */
const cashoutsInFlight = new Set<string>();

export async function cashoutForDeal(deal: Deal, dest: ExchangeDestination) {
  if (cashoutsInFlight.has(deal.id)) throw new Error('This payout is already being sent.');
  cashoutsInFlight.add(deal.id);
  try {
    return await cashoutOnce(deal, dest);
  } finally {
    cashoutsInFlight.delete(deal.id);
  }
}

async function cashoutOnce(deal: Deal, dest: ExchangeDestination) {
  let payout = await getPayout(deal.id);
  // Once a payment has gone out, the record says so, and a second one must not
  // follow it — from a reload, another tab, or another device.
  if (payout?.status === 'submitted' || payout?.status === 'settled') {
    throw new Error('This payout was already sent. Check your exchange for the deposit.');
  }
  if (!payout) {
    payout = newPayout(deal, 'exchange', dest.exchange);
    await savePayout(payout);
  }
  const amount = await cashoutAmount(deal, payout.usdcAmount);
  if (amount <= 0) throw new Error('There is no USDC in your wallet to send. Has the escrow been released to it?');

  try {
    const { hash, minReceived } = await sendCashout(deal.sellerWallet, dest, amount);
    await updatePayout(deal.id, { rail: 'exchange', status: 'submitted', provider: dest.exchange });
    await appendEvidence(deal.id, {
      kind: 'inspection',
      note: `Sent ${amount} USDC to the seller's ${dest.exchange} account, arriving as at least ${minReceived.toFixed(2)} ${dest.asset}, tx ${hash}. Selling it and withdrawing to a bank happens at ${dest.exchange}.`,
      byUid: deal.sellerUid,
      byRole: 'seller',
      at: Date.now(),
    });
    return hash;
  } catch (error: unknown) {
    const failure = error instanceof Error ? error.message : String(error);
    await updatePayout(deal.id, { rail: 'exchange', status: 'failed', failure });
    throw error;
  }
}

/**
 * The seller says the rupiah reached their bank. wafiqr cannot see a bank
 * account and does not pretend to: this is recorded as the seller's statement,
 * under the seller's name, and nothing else.
 */
export async function confirmBankArrival(deal: Deal, idrAmount?: number) {
  await updatePayout(deal.id, { status: 'settled' });
  await appendEvidence(deal.id, {
    kind: 'inspection',
    note: idrAmount
      ? `Seller reports Rp ${idrAmount.toLocaleString('id-ID')} received in their bank.`
      : 'Seller reports the proceeds reached their bank.',
    byUid: deal.sellerUid,
    byRole: 'seller',
    at: Date.now(),
  });
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
