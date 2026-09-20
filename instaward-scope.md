# Instaward request — wafiqr: the last mile to rupiah

**Builder:** Dian Bilhokista
**Chapter:** Stellar Ambassador Chapter Indonesia
**Project:** wafiqr — cross-border trade escrow on Stellar
**Repository:** <https://github.com/bilhokista/wafiqr>
**Sprint:** 30 days
**Network:** Testnet throughout

---

## One paragraph

wafiqr is a marketplace where a small Indonesian producer sells across a border
for the first time and the payment waits in a Stellar escrow until the goods
arrive. It works end to end on testnet today. What it cannot do is finish: when
the escrow releases, the seller holds USDC in a Stellar account, and a producer
in a village cannot spend USDC, cannot show it to a bank, and cannot report it
as export proceeds. This sprint builds the leg that turns a released escrow into
rupiah in their bank account, through a licensed provider, with a record their
accountant can read.

## What already runs

Verified on testnet on 2026-09-20:

| Path | Contract | Result |
|---|---|---|
| Happy | `CACDT5HM4SP3HNU6TXDJ3GHWMBDV5QU4HZ4NK5XA75MFH6CP3LHS2HNK` | seller +9.97 USDC |
| Dispute | `CDR54QT3GJLSJDI2SGT2BFVY4PQGJ6WYCJOD3HZOQ2XS3ARGWSCDJWWV` | buyer 7, seller 3 |

Escrow runs through Trustless Work single-release contracts in USDC. The trade
terms — quantity, grade, Incoterm, ship-by date, named arbiter — are written
into the contract and frozen at creation. The seller files shipping evidence
against the milestone; a dispute goes to an arbiter both sides accepted before
the money moved.

Built ahead of this request, and already in the repository:

- `OfframpProvider` — the interface a licensed provider plugs into
- Payout and settlement types carrying the fields DHE reporting needs
- `repatriationCheck` — reports when a payout cannot carry the obligation
- Payout persistence with its own rules, read-restricted to the two parties
- The deal-room payout panel, replacing a screen that told the seller they had
  been paid when they had not
- A third leg in the end-to-end script asserting the payout path reaches an
  honest refusal rather than a fabricated success

## Why nobody has closed this

Of 43 Stellar anchors in the ecosystem directory, none serves Indonesia.

That is not an oversight. Under Law No. 4/2026 the minimum registered capital
for a digital asset exchange licence is Rp 500 billion, and on-ramps and
off-ramps must run through Indonesian banks or licensed e-wallets. Supervision
moved from Bappebti to OJK in January 2025.

So nobody builds the Indonesian anchor, and every Indonesian seller in every
Stellar marketplace is left holding USDC.

The way through is not to become the exchange. wafiqr never takes custody: a
licensed provider quotes, the seller authorises, the provider holds the funds
under their licence for the length of the conversion, and wafiqr records what
came back.

## The requirement outsiders miss

Indonesian exporters of natural resources must repatriate 100% of export
proceeds to an account at a state-owned bank and hold them twelve months
(PP 21/2026, PBI No. 5/2026). Essential oils, coffee and spices — the catalogue
wafiqr was built for — sit inside or near that definition.

A payout ending in a crypto wallet leaves the exporter unable to show
compliance. The party in breach would be the producer using the tool, not the
tool. That is worse, because the harm lands on whoever can least absorb it.

Any credible payout path for this corridor ends at an onshore account, with a
record the exporter can file against. That is the part a foreign team would not
think to build, because they do not know the rule exists.

## Sprint deliverables

1. **A provider adapter** against one licensed off-ramp that reaches Stellar,
   behind the existing `OfframpProvider` interface.
2. **Settlement recording** — the provider's account of the onshore leg written
   into the evidence trail, readable by buyer, seller and arbiter.
3. **One full testnet run**: escrow funded, goods shipped, released, converted,
   rupiah confirmed in an Indonesian bank account, recorded.
4. **A written finding** on IDR-to-Stellar routing, for the chapter and SDF,
   whichever way it goes.

## Out of scope, deliberately

- wafiqr taking custody at any point. That is the Rp 500 billion question and
  the answer is no.
- Mainnet.
- Filing anything with customs on the exporter's behalf. The record supports
  their filing; it does not replace it.
- Buyer-side on-ramp. Buyers are abroad and already served.

## Success criteria

Evaluated at the end of the sprint:

- **Passes** if one deal runs from escrow release to rupiah confirmed in an
  Indonesian bank account, with the settlement visible in the evidence trail to
  all three parties, and the repatriation check reporting correctly for both a
  state and a non-state bank.
- **Fails** if no licensed provider can be reached for IDR settlement on Stellar
  within the sprint.

The failure mode is named because it is the real risk. If no provider routes IDR
to Stellar today, that is a finding the Indonesian chapter and SDF should have,
and the adapter interface is what the next team starts from instead of starting
over.

## Two assumptions, stated rather than hidden

Both are cheap to settle and neither blocks the interface work:

1. **Whether any licensed provider currently routes IDR to the Stellar
   network.** Alchemy Pay is listed in the Stellar Anchor Directory as an
   on/off-ramp for XLM and USDC, and is one of fifteen providers listed for
   Indonesia alongside GoPay, OVO, ShopeePay and QRIS. The intersection — IDR
   settling on Stellar — has not been confirmed by anyone here.

2. **Whether essential oils fall inside the SDA definition, and above which
   value threshold.** A customs broker answers this in one call. The answer
   changes who the product serves, not whether it works.

Both are first-week work, not last-week work.

## What the ecosystem gets either way

An Indonesian payout path that other Stellar products can copy, or a documented
answer for why there is not one yet. Indonesia is the largest economy in
Southeast Asia and the only major corridor with no Stellar anchor. The Philippines
has Coins PH; Peru received an SCF Build award in round 44 for exactly this
shape of work on the SDF Anchor Platform.

---

*References: [Instaward rules](https://stellar.gitbook.io/scf-handbook/scf-awards/instawards/official-rules) ·
[PP 21/2026 on DHE SDA](https://siplawfirm.id/resources/dhe-sda-2026-pp-21-2026-aturan-eksportir) ·
[PBI No. 5/2026](https://www.bi.go.id/id/publikasi/peraturan/Pages/PBI_052026.aspx) ·
[Alchemy Pay on Stellar](https://alchemypay.org/news-and-press/alchemy-pay-joins-stellar-ecosystem-to-offer-ramp-service-for-developers-and-dapps)*
