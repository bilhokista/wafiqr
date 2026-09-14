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
3. **Ship** — seller ships and submits proof (this demo marks it with a button; real
   evidence — tracking, photos, video — is roadmap).
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

## Verify before mainnet

The endpoint paths and the deploy body follow the Trustless Work docs. A few
operation sub-bodies (approve-milestone, resolve-dispute field names) should be checked
against the live Swagger at https://api.trustlesswork.com/docs before mainnet use.

## Roadmap

Fiat on/off ramps through Stellar anchors; delivery-evidence and physical-goods
oracles through logistics partners; embed in chat (WhatsApp) and any storefront; the
same rails in reverse for imports.
