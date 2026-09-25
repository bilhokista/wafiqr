# Instaward request — wafiqr: from testnet to the first real trades

**Builder:** Dian Bilhokista
**Chapter:** Stellar Ambassador Chapter Indonesia
**Project:** wafiqr — cross-border trade escrow on Stellar
**Repository:** <https://github.com/bilhokista/wafiqr> · **Live (testnet):** <https://wafiqr.web.app>
**Sprint:** 30 days
**Network:** Testnet today; a capped mainnet pilot is the sprint's goal

---

## One paragraph

wafiqr lets a small Indonesian producer sell to a buyer abroad with the payment
held in a Stellar escrow until the goods arrive. Until this month it stopped at
two walls: the buyer needed a crypto wallet and USDC to start, and the seller
ended with USDC they could not spend. Both walls are now down on testnet,
without wafiqr holding anyone's money, keys or currency. The buyer pays with
what they already use — QRIS, a virtual account, a card — through a licensed
ramp; the seller ends with rupiah in their own bank through a licensed exchange
they already have. This sprint takes that from testnet to the first real trades.

## What already runs

Verified on Stellar testnet on 2026-09-25, through the same code the live app uses:

| Step | Evidence |
|---|---|
| Escrow deployed, code checked on chain, funded, shipped, approved, released | [`CAOIMIUW…PAGHB`](https://stellar.expert/explorer/testnet/contract/CAOIMIUWYBDHRALGE3HY47QN2PM4ABOQS4K3NJZGZKNBLYHFNUPPAGHB) — seller received 2.991 of 3 USDC after the Trustless Work fee |
| Seller's USDC sent to an exchange deposit, converted to XLM, tagged with the memo | [tx `b04918f8…0c7a`](https://stellar.expert/explorer/testnet/tx/b04918f853b482c57a1c007a39df1e9fa6df564ec9b3a2970a5471acd2d50c7a) |
| Earlier: settled path, disputed path with a 7/3 arbiter split | [`CACDT5HM…2HNK`](https://stellar.expert/explorer/testnet/contract/CACDT5HM4SP3HNU6TXDJ3GHWMBDV5QU4HZ4NK5XA75MFH6CP3LHS2HNK), [`CDR54QT3…JWWV`](https://stellar.expert/explorer/testnet/contract/CDR54QT3GJLSJDI2SGT2BFVY4PQGJ6WYCJOD3HZOQ2XS3ARGWSCDJWWV) |

Built and tested in the repository:

- **A wallet for people who have never had one.** Made in the browser, sealed
  under the owner's passphrase (PBKDF2-SHA256, AES-GCM) before it is stored.
  wafiqr keeps a box it has no key to. Freighter still works.
- **Money in.** The buyer buys XLM or USDC at a licensed ramp or exchange — Alchemy
  Pay takes QRIS and virtual accounts in Indonesia, cards elsewhere — and
  withdraws to their wallet. The deal room sees the deposit arrive, adds the USDC
  trustline and swaps on the Stellar DEX with a 1% slippage floor.
- **Money out.** After release the seller sends the USDC to their own exchange
  account — Indodax, Tokocrypto — converted to XLM in one path payment carrying the
  exchange's memo. They sell and withdraw to their bank there, as that exchange's
  customer.
- **Nothing signed blind.** Every escrow transaction arrives from the Trustless
  Work API unsigned. wafiqr decodes it and refuses to sign unless signer,
  contract, function, amount, receiver, arbiter, token and fee match the deal.
  Before funding, it asks Soroban RPC — not the API — which code the escrow runs,
  and funds only the Trustless Work build it has checked.
- **Only across a border.** Law 4/2026 bars a stablecoin as a means of payment
  inside Indonesia. A deal between two parties in Indonesia does not open,
  refused in the app and in the database rules.
- 66 unit tests, plus two end-to-end runs against live testnet.

## Why this shape

Every licence in this flow stays with the party that holds it. The ramp is
licensed to sell the buyer USDC. The exchange is licensed to buy the seller's
XLM and pay rupiah to their bank. The escrow is a Trustless Work contract
that releases only on the buyer's approval, or on the ruling of an arbiter both
sides accept before any money moves. During the pilot that arbiter is me, and
the contract names the account, so both sides know who rules before they commit.
wafiqr is the software between them. It is built never to take custody, which is
what should keep it outside those licences — a reading to confirm with a
fintech lawyer before the mainnet pilot, not one to assume. And it works in a country with no Stellar anchor for its
currency — of the anchors in the ecosystem directory, none serves Indonesia.

## Sprint deliverables

1. **Keys behind a server.** A small proxy for the Trustless Work and DHL API
   keys, which today ship in the page bundle. They cannot move funds, but anyone
   can spend their rate limit. This is the one thing that must precede mainnet.
2. **A capped mainnet pilot.** A fintech lawyer reads the custody model first.
   Then mainnet is switched on with a per-deal ceiling, a named arbiter account,
   and the same guard and code check as testnet.
3. **Five real cross-border trades.** Indonesian artisan goods — specialty
   coffee from Bogor, Sabshal essential oil — to buyers in Singapore, reached
   through Indonesians living there. Each paid in through a licensed ramp and paid
   out to rupiah through the seller's own exchange account.
4. **Courier evidence on those shipments.** The DHL check, already built and
   dormant until keyed, run live on every pilot waybill.
5. **A public cost-and-time report.** For each trade: what the buyer paid, what
   reached the seller's bank, every fee on the way, and how long each leg took.

## Out of scope, deliberately

- Holding funds, keys or currency, at any size. The design depends on it.
- Domestic trades inside Indonesia.
- Releasing money on a delivery scan. A courier saying "delivered" means a parcel
  reached an address, not that the goods match the sample. The buyer confirms.
- Sponsored account creation. A new wallet still needs a few XLM from an exchange
  to open; paying that reserve on users' behalf is the next step, not this one.

## Success criteria

- **Passes** if at least three of the five trades go from a buyer's local payment
  method to rupiah in the seller's bank on mainnet, and the report is published
  with real figures, including the ones that look bad.
- **Fails** if no trade completes end to end, or if completing one requires
  wafiqr to hold money or keys at any point.

The second failure matters more. A trade pushed through by stepping into custody
would prove the opposite of what this is for.

## What is assumed, stated rather than hidden

- **The first sellers are close to home.** The first goods are my own products
  and coffee from Bogor Punya Kopi, a Bogor coffee shop that roasts its own beans. That is a pilot
  seeding its own supply, not traction, and the report will say so.
- **The buyers are not recruited yet.** Indonesians in Singapore are the channel I
  expect to reach buyers through; nobody has been signed up. Week one is finding
  the five.
- **Country is self-declared.** It is fixed once set, which stops a party flipping
  it per deal, not a party lying from the start. The ramp and the exchange each
  side pays through hold the verified identity.
- **Shipping essential oil by air is restricted** by many couriers as a flammable
  liquid. If it cannot go by parcel, the oil trades are replaced with coffee.

## What the ecosystem gets

A pattern any Stellar app can copy in a market without an anchor: licensed
parties at both ends, a non-custodial wallet in the middle, and an app that
signs nothing it has not read. Indonesia is the first market it was built for.
It is not the only market with no Stellar anchor.

---

*References: [Instaward rules](https://stellar.gitbook.io/scf-handbook/scf-awards/instawards/official-rules) ·
[Law 4/2026, P2SK amendment (ABNR summary)](https://www.abnrlaw.com/news/indonesias-p2sk-law-amendment-what-law-42026-changes-for-crypto-and-digital-financial-assets) ·
[Alchemy Pay on Stellar](https://alchemypay.org/news-and-press/alchemy-pay-joins-stellar-ecosystem-to-offer-ramp-service-for-developers-and-dapps) ·
[Trustless Work API](https://docs.trustlesswork.com/trustless-work/api-rest/introduction) ·
[DHL Shipment Tracking Unified](https://developer.dhl.com/tracking)*
