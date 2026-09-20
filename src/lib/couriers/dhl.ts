// DHL Shipment Tracking — Unified.
//
// Chosen first because it is the one an Indonesian producer shipping five
// litres abroad is most likely to be handed, and because the free tier is 250
// calls a day, which is far more than a pilot will ever make.
//
// The key is a read-only tracking key, and it ships in the bundle like every
// other VITE_ variable. That is worth stating rather than hiding: anyone can
// read it from the page and spend the quota. For a pilot this is an acceptable
// trade against standing up a proxy, and it is the first thing to move server
// side once real deals run through here.
//
// https://developer.dhl.com/tracking
import type { CourierProvider, ShipmentCheck, ShipmentState } from '../courier';

const ENDPOINT = 'https://api-eu.dhl.com/track/shipments';

/**
 * DHL waybills are 10 or 11 digits, sometimes prefixed by the letters people
 * copy off the label. Deliberately loose: a number this rejects is a number
 * nobody checks, and a wrong guess here is silent.
 */
const PATTERN = /^(?:DHL[\s-]*)?\d{10,11}$/i;

/**
 * DHL's status vocabulary is wide and changes. Mapping is done on the coarse
 * `statusCode` it documents rather than on the prose, so a reworded message
 * does not silently become an unknown state.
 */
function toState(statusCode: string | undefined, description: string): ShipmentState {
  switch ((statusCode ?? '').toLowerCase()) {
    case 'pre-transit':
      return 'created';
    case 'transit':
      return 'in-transit';
    case 'delivered':
      return 'delivered';
    case 'failure':
      return 'failed';
    default:
      // An unmapped code means DHL knows the shipment and we do not understand
      // its stage. "In transit" with the courier's own wording attached is
      // honest; "unknown" would read as "this waybill does not exist", which is
      // a different and much more serious claim.
      return description ? 'in-transit' : 'unknown';
  }
}

interface DhlShipment {
  status?: { statusCode?: string; status?: string; description?: string; timestamp?: string; location?: { address?: { addressLocality?: string } } };
}

export function dhlCourier(apiKey: string): CourierProvider {
  return {
    name: 'DHL',
    handles: (trackingNumber) => PATTERN.test(trackingNumber.trim()),
    async check(trackingNumber) {
      const number = trackingNumber.replace(/^DHL[\s-]*/i, '').trim();
      const url = `${ENDPOINT}?trackingNumber=${encodeURIComponent(number)}`;

      const response = await fetch(url, { headers: { 'DHL-API-Key': apiKey } });
      const checkedAt = Date.now();

      // 404 is an answer, not a failure: DHL has no record of this waybill.
      // That is the single most useful thing this module can report, so it must
      // not be thrown away as an error.
      if (response.status === 404) {
        return {
          state: 'unknown',
          detail: 'DHL has no record of this tracking number.',
          courier: 'DHL',
          checkedAt,
        } satisfies ShipmentCheck;
      }

      if (response.status === 429) {
        throw new Error('DHL is rate limiting the tracking key. Try again in a minute.');
      }

      if (!response.ok) {
        throw new Error(`DHL tracking returned ${response.status}.`);
      }

      const body = (await response.json()) as { shipments?: DhlShipment[] };
      const status = body.shipments?.[0]?.status;

      if (!status) {
        return {
          state: 'unknown',
          detail: 'DHL returned no status for this tracking number.',
          courier: 'DHL',
          checkedAt,
        } satisfies ShipmentCheck;
      }

      const detail = status.description ?? status.status ?? '';
      const scannedAt = status.timestamp ? Date.parse(status.timestamp) : Number.NaN;

      return {
        state: toState(status.statusCode, detail),
        detail,
        courier: 'DHL',
        checkedAt,
        ...(status.location?.address?.addressLocality
          ? { location: status.location.address.addressLocality }
          : {}),
        ...(Number.isNaN(scannedAt) ? {} : { lastScanAt: scannedAt }),
      } satisfies ShipmentCheck;
    },
  };
}
