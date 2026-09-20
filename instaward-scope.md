# Instaward request — wafiqr: make the shipment evidence checkable

**Builder:** Dian Bilhokista
**Chapter:** Stellar Ambassador Chapter Indonesia
**Project:** wafiqr — cross-border trade escrow on Stellar
**Repository:** <https://github.com/bilhokista/wafiqr> · **Live:** <https://wafiqr.web.app>
**Sprint:** 30 days
**Network:** Testnet throughout

---

## One paragraph

wafiqr is a marketplace where a small Indonesian producer sells across a border
for the first time and the payment waits in a Stellar escrow until the goods
arrive. It runs end to end on testnet today. Its weakest link is not the money —
that part works — it is the evidence: the seller typed a tracking number as free
text, nobody checked it, and the escrow carried it as proof. This sprint makes
the shipment evidence checkable by asking the courier, so a waybill that does
not exist becomes visible to the buyer and the arbiter instead of sitting in the
record looking like proof.

## What already runs

Verified on Stellar testnet on 2026-09-20:

| Path | Contract | Result |
|---|---|---|
| Settled | `CACDT5HM4SP3HNU6TXDJ3GHWMBDV5QU4HZ4NK5XA75MFH6CP3LHS2HNK` | seller +9.97 USDC |
| Disputed | `CDR54QT3GJLSJDI2SGT2BFVY4PQGJ6WYCJOD3HZOQ2XS3ARGWSCDJWWV` | arbiter split: buyer 7, seller 3 |

Escrow runs through Trustless Work single-release contracts in USDC. Trade terms
— quantity, grade, Incoterm, ship-by date, named arbiter — are written into the
contract and frozen at creation. A dispute goes to an arbiter both sides
accepted before the money moved.

Built ahead of this request and already in the repository:

- `CourierProvider` — the interface a carrier plugs into
- A DHL adapter against Shipment Tracking Unified
- Refusal of a waybill the courier has never seen, at filing time. Dormant
  until a carrier key is configured: with none, the number is recorded as typed
  and marked unverified rather than silently passed as checked
- The courier's reading written on chain beside the seller's note, and filed as
  its own evidence entry under a `courier` badge
- `recheckShipment` in the library, which deliberately does not move the deal
  status — not yet reachable from the deal room, which is deliverable 3 below

## The problem, concretely

An escrow between strangers releases when one party asserts the other
performed. Today that assertion is a string:

```
Tracking number:  DHL 1234567890
```

Nothing checks it exists. A seller can type anything, and the buyer — who is
abroad, has never met them, and is deciding whether to confirm delivery — has
no way to tell a real waybill from an invented one.

The escrow holds the money correctly and holds the claims about the goods on
faith. For a product whose entire offer is trust, that is the wrong way round.

## What checking buys

| Today | After |
|---|---|
| "Shipped" because the seller says so | the waybill exists and the courier says so |
| Arbiter reads two accounts | arbiter reads one fact neither party wrote |
| An invented number looks like proof | an invented number is refused at filing |

The distinction the deal room now draws — which lines are claims and which came
from outside the deal — is the whole point.

## Sprint deliverables

1. **A live DHL adapter** on the free Shipment Tracking Unified tier, moved
   behind a server-side proxy so the key does not ship in the bundle.
2. **A second carrier** through KiriminAja, which fronts JNE, J&T and SiCepat,
   so a domestic leg is checkable too.
3. **Re-check from the deal room** for buyer and arbiter, with every reading
   written into the evidence trail under its own badge.
4. **One full testnet run with a real waybill**: filed, checked, disputed, and
   resolved by an arbiter reading a courier line neither party wrote.

## Out of scope, deliberately

- **Releasing money on a delivery scan.** A courier saying "delivered" means a
  parcel reached an address, not that the oil matches the sample. Automating
  release on a scan would hand every seller a way to be paid for shipping a
  brick. The buyer still confirms.
- Mainnet.
- Customs filing. The record supports the exporter's filing; it does not
  replace it.
- The rupiah payout, which is the follow-on below rather than this sprint.

## Success criteria

Evaluated at the end of the sprint:

- **Passes** if a real waybill from one live carrier is filed, checked and
  recorded; an invented number is refused with the courier named; and an
  arbiter resolves a dispute reading a courier line neither party wrote.
- **Fails** if no carrier can be reached, or if a check cannot distinguish a
  waybill that does not exist from one that is merely early.

The second failure matters more than the first. A check that cannot tell those
apart is worse than no check, because it would refuse honest sellers whose
parcel has not been collected yet — and being wrongly refused once is enough for
a first-time seller to stop.

## Follow-on: the rupiah payout

Proposed as the next disbursement rather than this sprint, because it is blocked
on an answer nobody here has yet.

When the escrow releases, the seller holds USDC in a Stellar account. A producer
in a village cannot spend that, show it to a bank, or report it as export
proceeds. The interface, types, repatriation check, security rules, deal-room
panel and end-to-end assertions are built and in the repository. What is missing
is one licensed provider that routes IDR to the Stellar network.

Of 43 Stellar anchors in the ecosystem directory, none serves Indonesia. Under
Law No. 4/2026 the minimum registered capital for a digital asset exchange
licence is Rp 500 billion, so wafiqr never takes custody — a licensed provider
does, for the length of the conversion, and wafiqr records what came back.

Alchemy Pay is listed in the Stellar Anchor Directory for XLM and USDC, and is
one of fifteen providers listed for Indonesia alongside GoPay, OVO, ShopeePay
and QRIS. Whether IDR actually settles on Stellar through any of them is the
open question, and it is one sitting with a widget, not a sprint.

Indonesian exporters of natural resources must repatriate proceeds to a
state-owned bank account (PP 21/2026, PBI No. 5/2026), so any payout path here
ends onshore. Whether a parcel-scale exporter sits above that threshold is the
second thing to settle, and a customs broker answers it in one call.

## What is assumed here, stated rather than hidden

The customer is read as a parcel-scale exporter — five litres in two tins,
shipped by DHL or Lion Parcel — rather than a container exporter. That reading
comes from which shipping services Indonesian sellers are actually sold, which
is desk research and buys nothing on its own. Nobody has asked an exporter what
they ship, or what went wrong last time.

It matters because it sets which carriers to reach for first, and because the
repatriation threshold probably does not bind a parcel shipment. Both are
first-week questions, not last-week ones.

## What the ecosystem gets

A pattern any Stellar escrow can copy: independent evidence, from a party with
no stake in the deal, written into the contract's own record.

Escrows on every chain release on one party asserting the other performed.
Making that assertion checkable is not specific to wafiqr, to Indonesia, or to
trade — it is what makes an escrow between strangers worth more than a promise.

---

*References: [Instaward rules](https://stellar.gitbook.io/scf-handbook/scf-awards/instawards/official-rules) ·
[DHL Shipment Tracking Unified](https://developer.dhl.com/tracking) ·
[KiriminAja Open API](https://developer.kiriminaja.com/) ·
[PP 21/2026 on DHE SDA](https://siplawfirm.id/resources/dhe-sda-2026-pp-21-2026-aturan-eksportir) ·
[PBI No. 5/2026](https://www.bi.go.id/id/publikasi/peraturan/Pages/PBI_052026.aspx)*
