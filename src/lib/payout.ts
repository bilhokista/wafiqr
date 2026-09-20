// The last mile: from released USDC to rupiah in the seller's bank account.
//
// Everything upstream of here is solved. The buyer funds an escrow, the goods
// move, the arbiter rules if they must, and `releaseForDeal` sends USDC to the
// seller's Stellar address. Then the flow stops, and for the seller this
// product was built for — a producer in a village who has never held crypto
// and does not want to — stopping there means the money has not arrived.
//
// Two things make this module more than an API call.
//
// **wafiqr must never hold the funds.** The moment it does, it is operating a
// digital asset exchange, and Law No. 4/2026 puts the registered capital for
// that at Rp 500 billion. So the shape here is a handoff, not a transfer: a
// licensed provider quotes, the seller authorises, the provider takes custody
// for the length of the conversion, and wafiqr records what came back. The
// provider interface exists so the licensed party can be swapped without
// touching the deal flow, because which provider serves Indonesia is a fact
// about this month, not about the design.
//
// **The proceeds have to land onshore.** Indonesian exporters of natural
// resources must repatriate export proceeds into an account at a state-owned
// bank (PP 21/2026, PBI 5/2026). A payout that ends in a wallet leaves the
// exporter unable to show that. Recording the onshore leg is therefore not a
// reporting nicety — it is the difference between a tool that helps a producer
// and one that quietly puts them in breach.
import type { Deal, Payout, PayoutRail, SettlementRecord } from './types';

/**
 * What wafiqr needs from whoever is licensed to convert.
 *
 * Deliberately small. Anything richer would encode one provider's model into
 * the deal flow, and the provider is the part most likely to change.
 */
export interface OfframpProvider {
  /** Name as it should appear in the evidence trail. */
  readonly name: string;
  /**
   * What the seller would receive, before committing anything. Quoting is
   * separated from sending so the seller sees the rate and the fee while the
   * money is still theirs to keep in USDC.
   */
  quote(input: QuoteInput): Promise<Quote>;
  /**
   * Hands the conversion to the provider. Returns their reference. Custody
   * passes to them here and wafiqr never takes it back.
   */
  submit(input: SubmitInput): Promise<{ reference: string }>;
  /**
   * What the provider says happened. Returns `null` while still in flight, so
   * a caller can distinguish "not finished" from "finished badly".
   */
  settlement(reference: string): Promise<SettlementRecord | null>;
}

export interface QuoteInput {
  usdcAmount: number;
  /** Destination account, as the seller registered it. */
  bankAccount: string;
  bankCode: string;
}

export interface Quote {
  idrAmount: number;
  idrPerUsdc: number;
  /** Provider fee in USDC, already deducted from `idrAmount`. */
  feeUsdc: number;
  /** How long this rate is good for. Rates move; a stale quote is a surprise. */
  expiresAt: number;
}

export interface SubmitInput extends QuoteInput {
  /** The seller's Stellar account the USDC is sent from. */
  from: string;
  /** Ties the conversion back to the trade, for both sides' reconciliation. */
  engagementId: string;
}

/** Banks whose accounts satisfy the onshore placement requirement. */
const HIMBARA_CODES: ReadonlySet<string> = new Set(['BMRI', 'BBRI', 'BBNI', 'BTN']);

export function isHimbara(bankCode: string): boolean {
  return HIMBARA_CODES.has(bankCode.toUpperCase());
}

/**
 * Whether a payout can carry the exporter's repatriation obligation.
 *
 * Returns the reason rather than a bare false, because the seller can act on
 * "your bank is not a state bank" and cannot act on "no".
 *
 * It reports; it does not block. Whether this exporter is inside the SDA
 * definition, and above the value threshold that triggers the obligation, is
 * not something this code can know — and refusing a payout on a guess would be
 * worse than letting an informed seller proceed.
 */
export function repatriationCheck(
  rail: PayoutRail,
  bankCode: string,
): { ok: boolean; reason: string } {
  if (rail === 'wallet') {
    return {
      ok: false,
      reason:
        'Paying out to a wallet leaves the proceeds offshore. If this shipment is a natural-resource export above the reporting threshold, that is the exporter’s obligation left unmet, not wafiqr’s.',
    };
  }

  if (!isHimbara(bankCode)) {
    return {
      ok: false,
      reason:
        'This account is not at a state-owned bank. Export proceeds subject to the DHE SDA rules must be placed at a Himbara bank — Mandiri, BRI, BNI or BTN.',
    };
  }

  return { ok: true, reason: '' };
}

export function newPayout(deal: Deal, rail: PayoutRail, provider: string): Payout {
  const now = Date.now();
  return {
    dealId: deal.id,
    rail,
    status: rail === 'wallet' ? 'none' : 'quoted',
    provider: rail === 'wallet' ? '' : provider,
    usdcAmount: deal.amount,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A provider that does nothing and says so.
 *
 * Present because the alternative during the pilot is a fake that returns
 * plausible numbers, and a fake rate on a screen is indistinguishable from a
 * real one. This refuses instead, so nobody demonstrates a settlement that did
 * not happen.
 *
 * Replace it with the licensed provider once one is contracted; the deal flow
 * does not change.
 */
export const unconfiguredProvider: OfframpProvider = {
  name: 'none',
  async quote() {
    throw new Error(
      'No off-ramp provider is configured. wafiqr cannot convert USDC to rupiah itself — that needs a licensed party.',
    );
  },
  async submit() {
    throw new Error('No off-ramp provider is configured.');
  },
  async settlement() {
    return null;
  },
};

let active: OfframpProvider = unconfiguredProvider;

export function useProvider(provider: OfframpProvider) {
  active = provider;
}

export function activeProvider(): OfframpProvider {
  return active;
}

export async function quoteForDeal(deal: Deal, input: QuoteInput): Promise<Quote> {
  if (input.usdcAmount > deal.amount) {
    throw new Error('A payout cannot exceed what the escrow released.');
  }
  return active.quote(input);
}

export async function submitForDeal(deal: Deal, input: SubmitInput): Promise<string> {
  const { reference } = await active.submit({ ...input, engagementId: `wafiqr-${deal.id}` });
  return reference;
}

/** Renders a settlement for the evidence trail a stranger has to be able to read. */
export function settlementText(record: SettlementRecord): string {
  const rate = record.idrPerUsdc.toLocaleString('id-ID');
  const idr = record.idrAmount.toLocaleString('id-ID');
  return [
    `Rp ${idr} to ${record.bankName} ${record.accountMasked}`,
    `at Rp ${rate}/USDC`,
    record.himbara ? 'state bank' : 'not a state bank',
    record.pebNumber ? `PEB ${record.pebNumber}` : 'no PEB filed',
    `ref ${record.providerReference}`,
  ].join(' · ');
}
