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
firebase deploy --only firestore:rules,firestore:indexes
npm run build && firebase deploy --only hosting
```

Enable **Email/Password** under Authentication before signing anyone up.

Security rules live in `firestore.rules`. Listing photos are stored inline in the
listing document (see `src/lib/image.ts`), so there is no `storage.rules` to deploy. The shape they enforce:
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

Set `VITE_STELLAR_NETWORK` to `testnet` (the default) or `mainnet`. Everything that differs —
passphrase, Horizon, the Trustless Work API, the real USDC issuer — comes from
`src/lib/network.ts`. Mainnet will not start without `VITE_ARBITER_ADDRESS`. The arbiter must
be a third account: the contract rejects a dispute opened by its own dispute resolver.

## Money in, money out, without a licence

wafiqr never holds anyone's money, never holds a key that can spend it, and never converts
currency. Every step that needs a licence is done by a party that has one, with the user as
their customer.

- **Wallets.** A user without Freighter gets a wallet made in their browser
  (`embeddedWallet.ts`). The secret is sealed under their passphrase with PBKDF2-SHA256 and
  AES-GCM (`vault.ts`) before it is stored, on the device and in Firestore for recovery. wafiqr
  stores a box it has no key to. Freighter still works for anyone who has it.
- **Paying in.** The buyer buys XLM or USDC at a licensed exchange or ramp they already use —
  QRIS, virtual account, card — and withdraws to their own wallet. The deal room watches for the
  deposit, adds the USDC trustline and swaps XLM to USDC on the Stellar DEX (`topup.ts`).
- **Paying out.** After release the seller sends the USDC to their own account at a licensed
  exchange, converted to XLM on the way in one path payment with the exchange's memo
  (`cashout.ts`). They sell and withdraw to their bank there. The direct-to-bank rail
  (`payout.ts`) stays in place for when a licensed off-ramp partner is contracted.
- **Nothing is signed blind.** Every escrow transaction comes back from the Trustless Work API
  as unsigned XDR. `txGuard.ts` decodes it and refuses to sign unless the signer, contract,
  function, amount, receiver, arbiter, token and fee all match the deal. Before funding,
  `escrowCode.ts` asks Soroban RPC — not the API — which code the escrow contract runs, and
  funds only the Trustless Work WASM this app has checked.
- **Only across a border.** Law 4/2026 forbids a stablecoin as a means of payment inside
  Indonesia. A deal between two parties in Indonesia does not open — refused in the app
  (`crossBorder.ts`) and in the Firestore rules.

## Tests

```bash
npm test                                                # unit tests, no network
TESTNET=1 npx vitest run src/lib/rails.testnet.test.ts  # top-up, full guarded escrow and cash-out on real testnet
```

The guard tests run against real unsigned transactions captured from the Trustless Work
testnet API (`src/lib/__fixtures__/tw-testnet.json`), not hand-built ones.

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

- Mainnet is wired but has not carried a real trade yet. Run one small deal end to end with
  your own money before anyone else's.
- The Trustless Work API key ships in the bundle, like every `VITE_` variable. It cannot move
  funds — every transaction still needs the user's signature — but anyone can spend its rate
  limit (50 requests a minute). Put it behind a proxy before real traffic.
- Country is self-declared and fixed once set. It stops a party flipping it per deal, not a
  party lying from the start; the licensed exchanges each side pays through hold the verified
  identity.
- A buyer or seller with a brand-new wallet needs a few XLM from an exchange before anything
  else, to open the account. There is no sponsored account creation yet.
- Auto-release on a missed deadline is shown as a date, not enforced on-chain.
- Evidence is a link plus a note. Files are not yet stored on the contract.
- The arbiter resolves from their own wallet; there is no arbiter console in the app.
