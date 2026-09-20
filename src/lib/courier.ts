// Checking the waybill, so "shipped" stops being something the seller says.
//
// Until now a seller typed a tracking number as free text and the escrow
// carried it as evidence. Nothing checked that the number existed, let alone
// that anything moved. For a product whose whole offer is trust, that is the
// wrong way round: the money was held correctly and the claims about the goods
// were held on faith.
//
// One limit shapes everything here, and it is not a technical one.
//
// **A courier's "delivered" is not the buyer's "accepted".** It says a parcel
// reached an address. It says nothing about what was inside, whether the
// quantity matched, or whether the oil smells like the sample. So a delivery
// scan strengthens the record and informs the arbiter; it never releases the
// money on its own. Wiring release to a courier scan would hand every seller a
// way to get paid for shipping a brick, and the first buyer it happened to
// would be the last one.
//
// What verification does buy is the other direction: a waybill that does not
// exist, or that was never collected, is now visible to the buyer and the
// arbiter instead of sitting in the record looking like proof.
import type { Evidence } from './types';

export type ShipmentState =
  /** The courier has never heard of this waybill. */
  | 'unknown'
  /** The label exists but nothing has been collected yet. */
  | 'created'
  /** Moving. */
  | 'in-transit'
  /** The courier says it reached the address. Not the same as accepted. */
  | 'delivered'
  /** The courier stopped it — customs, a bad address, a refusal. */
  | 'failed';

export interface ShipmentCheck {
  readonly state: ShipmentState;
  /** The courier's own wording, kept rather than mapped away. */
  readonly detail: string;
  /** Where it was last seen, when the courier says. */
  readonly location?: string;
  /** Epoch ms of the last scan the courier reported. */
  readonly lastScanAt?: number;
  /** Which courier answered, for the evidence line. */
  readonly courier: string;
  /** When this tool asked. A check is a reading, and readings have a time. */
  readonly checkedAt: number;
}

/**
 * What wafiqr needs from a courier, and nothing more.
 *
 * Small on purpose. Couriers differ wildly in what they expose, and encoding
 * one carrier's status vocabulary into the deal flow would mean rewriting the
 * flow to add the second one.
 */
export interface CourierProvider {
  readonly name: string;
  /** True when this provider recognises the shape of the waybill. */
  handles(trackingNumber: string): boolean;
  check(trackingNumber: string): Promise<ShipmentCheck>;
}

/**
 * A provider that answers nothing and says why.
 *
 * As with the off-ramp: the alternative during a pilot is a stub returning
 * "delivered", and a fabricated delivery scan on a buyer's screen is worse
 * than no scan at all — it is the exact evidence this module exists to stop
 * being faked, faked by us.
 */
export const unconfiguredCourier: CourierProvider = {
  name: 'none',
  handles: () => false,
  async check() {
    throw new Error(
      'No courier is connected, so the waybill cannot be checked. The number is recorded as the seller entered it, unverified.',
    );
  },
};

const providers: CourierProvider[] = [];

export function useCourier(provider: CourierProvider) {
  providers.push(provider);
}

/** Every courier currently wired in. Empty during the pilot. */
export function couriers(): readonly CourierProvider[] {
  return providers;
}

export function providerFor(trackingNumber: string): CourierProvider {
  return providers.find((p) => p.handles(trackingNumber)) ?? unconfiguredCourier;
}

/**
 * Checks a waybill with whichever courier recognises it.
 *
 * Never throws on a courier that simply does not know the number — that is an
 * answer, and an important one. It throws only when nobody could be asked.
 */
export async function checkShipment(trackingNumber: string): Promise<ShipmentCheck> {
  const trimmed = trackingNumber.trim();
  if (!trimmed) throw new Error('There is no tracking number to check.');
  return providerFor(trimmed).check(trimmed);
}

/**
 * Whether a check should stop a seller filing the shipment.
 *
 * Only one state does: a waybill the courier has never seen. Everything else —
 * created but not collected, in transit, even a failed delivery — is a true
 * thing about a real shipment, and the deal room is better off recording it
 * than refusing it.
 */
export function contradictsShipping(check: ShipmentCheck): boolean {
  return check.state === 'unknown';
}

const WORDING: Record<ShipmentState, string> = {
  unknown: 'no record of this waybill',
  created: 'label created, not yet collected',
  'in-transit': 'in transit',
  delivered: 'delivered to the address',
  failed: 'the courier could not complete it',
};

/** One line for the evidence trail, readable by all three parties. */
export function checkText(trackingNumber: string, check: ShipmentCheck): string {
  return [
    `${check.courier} · ${trackingNumber} · ${WORDING[check.state]}`,
    check.location ? `last seen ${check.location}` : null,
    check.detail ? `"${check.detail}"` : null,
    `checked ${new Date(check.checkedAt).toISOString().slice(0, 16).replace('T', ' ')}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The evidence entry a check produces.
 *
 * Filed under the arbiter's role rather than the seller's, because the seller
 * did not say it — a third party did, and the whole point is that this line is
 * not the seller's word.
 */
export function checkEvidence(
  trackingNumber: string,
  check: ShipmentCheck,
  byUid: string,
): Evidence {
  return {
    kind: 'inspection',
    note: checkText(trackingNumber, check),
    trackingNumber,
    byUid,
    byRole: 'arbiter',
    at: check.checkedAt,
  };
}
