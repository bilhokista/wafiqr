# wafiqr

A marketplace where small producers sell across a border for the first time, and the
payment waits in an on-chain escrow until the goods arrive.

Escrow runs on Stellar through [Trustless Work](https://docs.trustlesswork.com) single-release
contracts, denominated in USDC. The catalog, accounts and evidence trail run on Firebase.
Testnet only during the pilot.

## Why it is not just an escrow button

An escrow that moves USDC proves the chain works. It does not make a stranger abroad
trustworthy. wafiqr puts the trade itself on the record:

- **Terms before money.** Quantity, grade, Incoterm, ship-by date and the named arbiter are
  agreed in the deal room and written into the escrow contract's title, description and
  milestone. They are frozen once the buyer funds it.
- **Proof, not promises.** The seller files the tracking number and packing evidence against
  the milestone. Both parties and the arbiter read the same time-stamped trail.
- **A ruling on evidence.** A dispute goes to an arbiter both sides accepted, who splits the
  locked balance and writes down the reasoning.

## Routes

| Path | What it is |
|------|-----------|
| `/` | The market: open lots from producers |
| `/lot/:id` | One lot, and the order form that becomes a trade contract |
| `/deal/:id` | The deal room: stepper, contract, actions, evidence trail |
| `/deals` | Everything the signed-in account is buying and selling |
| `/sell` | Seller desk: publish and withdraw lots |
| `/signin`, `/account` | Email account, and the linked Stellar payout wallet |
| `/how` | How the trust mechanism works |

## Setup

```bash
npm install
cp .env.example .env   # fill in Trustless Work + Firebase keys
npm run dev
```

Without Firebase keys the app still runs: the market falls back to the seeded demo catalog,
but accounts, publishing and deals are unavailable.

### Firebase

```bash
firebase use --add                 # pick or create the project
firebase deploy --only firestore:rules,firestore:indexes,storage
npm run build && firebase deploy --only hosting
```

Enable **Email/Password** under Authentication before signing anyone up.

Security rules live in `firestore.rules` and `storage.rules`. The shape they enforce:
listings and deals are publicly readable, a seller may only write their own listing, and a
deal's commercial terms cannot change after creation — only status, contract id and evidence.

### Courier tracking

Optional. With `VITE_DHL_API_KEY` set, a waybill is checked with DHL when the
seller files the shipment: a number the courier has never seen is refused, and
the courier's own reading is written into the escrow evidence and shown in the
deal room under a `courier` badge rather than the seller's.

Without a key nothing breaks. The number is recorded as typed and marked
unverified, which is what it is.

A delivery scan never releases money. It says a parcel reached an address, not
that the goods match the sample, and the buyer still confirms.

### Stellar

A buyer needs a Freighter wallet, a USDC trustline and testnet USDC. The deal room has a
button for each. The arbiter must be a third account: the contract rejects a dispute opened
by its own dispute resolver.

## Layout

```
src/
  lib/       firebase, auth, firestore access, Trustless Work client, escrow orchestration
  ui/        design primitives, nav, footer, icons
  routes/    one file per page
  WafiqrEscrow.tsx   the original embeddable widget, kept as the second surface
scripts/
  e2e-testnet.mjs    three-party escrow lifecycle against Stellar testnet
```

## Known limits

- Testnet only; no mainnet USDC path yet.
- Auto-release on a missed deadline is shown as a date, not enforced on-chain.
- Evidence is a link plus a note. Files are not yet stored on the contract.
- The arbiter resolves from their own wallet; there is no arbiter console in the app.
