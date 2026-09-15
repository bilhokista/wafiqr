# wafiqr

An embeddable escrow widget for cross-border trade, built on Stellar and
[Trustless Work](https://docs.trustlesswork.com). A seller drops it into their own
website; a buyer anywhere funds USDC into an on-chain escrow that releases when the
goods arrive, with an arbiter fallback for disputes. No marketplace, no container
minimum. It reads and writes escrow state only — it never custodies funds.

This repo is the testnet proof: one widget, one deal, the full single-release flow.

## Run

```sh
npm install
cp .env.example .env      # then paste your Trustless Work TESTNET API key into .env
npm run dev
```

Get a free testnet API key at https://dapp.trustlesswork.com (connect a Stellar
wallet, fill the use case in Settings, then API Keys → Testnet → Request).

To run a deal end to end you need a browser wallet (Freighter) on testnet, funded with
XLM and a USDC trustline. The demo seller/arbiter/platform addresses in `src/App.tsx`
are placeholders — replace them with real testnet accounts to release funds for real.

## Flow

1. **Create escrow** — buyer deploys a single-release escrow (roles: buyer = approver,
   seller = receiver, an agreed arbiter = disputeResolver).
2. **Fund** — buyer deposits USDC; funds are locked on-chain, visible to both.
3. **Ship** — seller records shipment evidence (waybill, photos, video link) on-chain
   against the milestone.
4. **Confirm** — buyer confirms receipt, or opens a dispute.
5. **Release / Resolve** — funds release to the seller, or the arbiter resolves the
   dispute on the evidence.

## Architecture

- `src/lib/trustlessWork.ts` — REST client for the Trustless Work single-release
  endpoints. Every write returns an unsigned XDR.
- `src/lib/wallet.ts` — Stellar Wallets Kit; signs the XDR and the client submits it
  via `/helper/send-transaction`.
- `src/WafiqrEscrow.tsx` — the embeddable widget (the piece meant to live on any page).
- `src/App.tsx` — a demo storefront that embeds the widget.

The escrow rails are Trustless Work's. wafiqr is the cross-border-trade layer on top:
the widget, the buyer/seller/arbiter flow, and the vertical this serves.

## Proof on testnet

`scripts/e2e-testnet.mjs` runs the full flow with three separate accounts (buyer, seller,
arbiter), each signing its own step. Last run, 15 Sep 2026:

| Path | What happened | Escrow |
|---|---|---|
| Happy | Buyer funds 10 USDC, seller records DHL waybill as on-chain evidence, buyer approves, funds release. Seller received 9.97 USDC (0.3% Trustless Work fee). | [CC6OZ…DMQOBT](https://stellar.expert/explorer/testnet/contract/CC6OZV3W7METTKZVSEKRJM3RWFQ6LHNUKIATHBGPORBSO7VUSNDMQOBT) |
| Dispute | Buyer funds 10 USDC and opens a dispute, arbiter splits it 7 USDC back to buyer, 3 USDC to seller. | [CDO2U…EWMLY](https://stellar.expert/explorer/testnet/contract/CDO2UQUENFN5B7B6BSNCEN2ZM7HCN6YWPTYP6JPKBEED664EHFKEWMLY) |

```sh
node scripts/e2e-testnet.mjs   # generates testnet keys into scripts/.testnet-wallets.json (gitignored)
```

The browser widget signs every role with the one connected wallet, so a single Freighter
account can click through the whole flow. The script is the multi-party proof.

## Before deploying the widget

`VITE_TW_API_KEY` is inlined into the JavaScript bundle at build time. Run the widget
locally, or put the Trustless Work calls behind a small server-side proxy before hosting
`dist/` anywhere public.

## Roadmap

Fiat on/off ramps through Stellar anchors; delivery-evidence and physical-goods
oracles through logistics partners; embed in chat (WhatsApp) and any storefront; the
same rails in reverse for imports.
