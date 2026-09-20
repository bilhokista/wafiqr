# Instaward sprint scope — the last mile to rupiah

**Project:** wafiqr — cross-border trade escrow on Stellar
**Chapter:** Stellar Ambassador Chapter Indonesia
**Duration:** 30 days
**Track:** Instaward (initial)

## The gap this closes

wafiqr already works end to end on testnet. A buyer abroad funds a Trustless
Work escrow in USDC, the terms travel on-chain, the seller files shipping
evidence, and an arbiter rules on disputes. Three-party testnet proof exists.

Then the flow stops. `releaseForDeal` sends USDC to the seller's Stellar
address and the deal is marked `released`.

For the seller this product was built for — a producer in a village who has
never held crypto and does not want to — that is not payment. It is a balance
in an asset they cannot spend, in a wallet they opened because we asked them
to. The product is finished everywhere except the only place the seller cares
about.

## Why it has not been closed by someone else

Of 43 Stellar anchors in the ecosystem directory, none serves Indonesia. That
is not an oversight. Under Law No. 4/2026 the minimum registered capital for a
digital asset exchange licence is Rp 500 billion, and on-ramps and off-ramps
must run through Indonesian banks or licensed e-wallets.

So nobody builds the Indonesian anchor, and every Indonesian seller in every
Stellar marketplace is left holding USDC.

The way through is not to become the exchange. It is to hand the conversion to
a party that already holds the licence, and to be the thing that records it
properly.

## The second requirement, which is the part outsiders miss

Indonesian exporters of natural resources must repatriate export proceeds into
an account at a state-owned bank and hold them for twelve months (PP 21/2026,
PBI No. 5/2026). Essential oils, coffee, spices — the exact catalogue wafiqr
was built for — sit inside or near that definition.

A payout that ends in a crypto wallet leaves the exporter unable to show
compliance. The tool would not be breaking the rule; the producer using it
would. That is worse, because the harm lands on the person with the least
capacity to absorb it.

Any credible payout path for this corridor therefore ends at an onshore
account, with a record the exporter's accountant can read.

## Deliverable

A payout stage in the deal room that takes a released escrow to rupiah in the
seller's bank account, through a licensed provider, with the settlement
recorded as evidence.

Already built and in the repository at the time of writing:

| Piece | State |
|---|---|
| `OfframpProvider` interface — quote, submit, settlement | done |
| Payout and settlement types, with the fields DHE reporting needs | done |
| `repatriationCheck` — reports when a payout cannot carry the obligation | done |
| Payout persistence and its own security rules, read-restricted to the parties | done |
| `releaseForDeal` opens the payout rather than ending the flow | done |

To be built in the sprint:

1. A provider adapter against one licensed off-ramp that reaches Stellar.
2. The deal-room payout UI: choose rail, see the quote before committing,
   authorise, watch it settle.
3. The settlement line in the evidence trail, readable by buyer, seller and
   arbiter.
4. One full testnet run: escrow funded, goods shipped, released, converted,
   rupiah confirmed onshore, recorded.

## What is deliberately not in scope

- wafiqr taking custody at any point. The provider holds funds under their
  licence; wafiqr records what came back. Anything else is the Rp 500 billion
  question.
- Mainnet. Testnet only for this sprint.
- Filing anything with customs on the exporter's behalf. The record supports
  their filing; it does not replace it.
- Buyer-side on-ramp. Buyers are abroad and already served.

## Success criteria

Evaluated at the end of the sprint, pass or fail:

- **Passes if** one deal runs from escrow release to rupiah confirmed in an
  Indonesian bank account, with the settlement visible in the evidence trail to
  all three parties, and the repatriation check reporting correctly for both a
  Himbara and a non-Himbara account.
- **Fails if** no licensed provider can be reached for IDR settlement on
  Stellar within the sprint.

The failure mode is named because it is the real risk, and it is worth knowing
either way. If no provider routes IDR to Stellar today, that is a finding the
Indonesian chapter and the SDF should have, and the adapter interface is what
the next team starts from instead of starting over.

## Open questions, stated rather than hidden

Two things are assumed and not verified, and both are cheap to settle:

1. **Whether any licensed provider currently routes IDR to the Stellar
   network.** Alchemy Pay is listed in the Stellar Anchor Directory as an
   on/off-ramp for XLM and USDC, and is one of fifteen providers Onramper lists
   for Indonesia alongside GoPay, OVO, ShopeePay and QRIS. The intersection —
   IDR settling on Stellar — has not been confirmed by anyone here.

2. **Whether essential oils fall inside the SDA definition, and above which
   value threshold.** A customs broker answers this in one call. The answer
   changes who the product serves, not whether it works.

Neither blocks the interface work, and both should be answered in the first
week rather than the last.
