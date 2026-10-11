# Instaward request — wafiqr: the deal's rules on chain, the keys on the device

**Team:** Dian Bilhokista (engineering, the only role funded) · Inneke Mitha K (product, not funded)
**Representative:** Dian Bilhokista (SCF Official Rules for Submissions §1.2)
**Chapter:** Stellar Ambassador Chapter Indonesia
**Project:** wafiqr — cross-border trade escrow on Stellar
**Repository:** <https://github.com/bilhokista/wafiqr> · **Live (testnet):** <https://wafiqr.web.app>
**Sprint:** 30 days
**Network:** Testnet for the whole sprint. Nothing here touches mainnet.
**Revised:** 2026-10-11, against the Instawards "Never do these" rules. Supersedes the 2026-09-25 version.

---

## One paragraph

wafiqr lets a small Indonesian producer sell to a buyer abroad with the payment
held in a Trustless Work escrow until the goods arrive. It runs on testnet today.
Two weaknesses remain. The guard that stops a user signing the wrong escrow call
is JavaScript, so a compromised page can skip it. And the first-time browser
wallet keeps an encrypted recovery copy of its secret in Firestore. This sprint
moves the guard onto the chain as a smart-account policy, gives users passkey
wallets, and takes every key and every piece of personal data out of the database.

## What already runs (built before the sprint, not billed)

| Step | Evidence |
|---|---|
| Escrow deployed, code checked on chain, funded, shipped, approved, released | [`CAOIMIUW…PAGHB`](https://stellar.expert/explorer/testnet/contract/CAOIMIUWYBDHRALGE3HY47QN2PM4ABOQS4K3NJZGZKNBLYHFNUPPAGHB) |
| Seller's USDC sent to an exchange deposit, converted to XLM, tagged with the memo | [tx `b04918f8…0c7a`](https://stellar.expert/explorer/testnet/tx/b04918f853b482c57a1c007a39df1e9fa6df564ec9b3a2970a5471acd2d50c7a) |
| Settled path, and a disputed path with a 7/3 arbiter split | [`CACDT5HM…2HNK`](https://stellar.expert/explorer/testnet/contract/CACDT5HM4SP3HNU6TXDJ3GHWMBDV5QU4HZ4NK5XA75MFH6CP3LHS2HNK), [`CDR54QT3…JWWV`](https://stellar.expert/explorer/testnet/contract/CDR54QT3GJLSJDI2SGT2BFVY4PQGJ6WYCJOD3HZOQ2XS3ARGWSCDJWWV) |

Plus the client-side transaction guard (`txGuard.ts`), the Soroban RPC check of the
escrow WASM (`escrowCode.ts`), DEX top-up and exchange cash-out, the cross-border-only
rule, 66 unit tests and two end-to-end testnet runs.

## Sprint deliverables

1. **Deal policy contract (Soroban, Rust).** An open-source policy for OpenZeppelin
   `stellar-contracts` smart accounts. In a deal's context rule it allows only
   `fund_escrow` on that deal's Trustless Work escrow, up to the agreed price, and
   `approve_milestone`, `release_funds`, `change_milestone_status` and
   `dispute_escrow` on the same contract. Everything else is rejected on chain.
   Unit and fuzz tests, deployed to testnet.
2. **Passkey deal accounts.** Smart Account Kit wallets hold the escrow roles. The app
   installs the policy, then calls the escrow contract directly through Soroban RPC with
   smart-account auth entries. Fees go through the OpenZeppelin Relayer's hosted testnet
   instance, which fee-bumps only. Freighter and Stellar Wallets Kit keep working.
3. **No keys and no personal data in the database.** The Firestore copy of the sealed
   wallet secret is deleted and users move to device-only storage with a backup file they
   keep. Names, email and bank details leave deal and settlement documents; shipping
   details are encrypted on the client to the counterparty. Firestore rules refuse those
   fields.
4. **End-to-end runs and the trust model.** Three scripted testnet runs with passkey
   accounts: settled, disputed and resolved, and a funding attempt above the price that
   the policy refuses. Published with every contract ID and transaction hash.

## Budget

USD 5,000, paid in XLM to a Stellar address. Engineering time only, USD 40 an hour.

| Deliverable | Hours | USD |
|---|---|---|
| 1. Deal policy contract | 45 | 1,800 |
| 2. Passkey deal accounts | 45 | 1,800 |
| 3. No keys and no PII in the database | 25 | 1,000 |
| 4. End-to-end runs and trust model | 10 | 400 |
| **Total** | **125** | **5,000** |

## Trust, threat, key-management and recovery model

- **Keys.** Only users hold them: a passkey in the device authenticator, or a classic
  wallet secret on the device with a user-kept backup. wafiqr runs no signing service and
  holds no master, deployer or HMAC key.
- **Funds.** Only the Trustless Work escrow moves them, on the buyer's approval or the
  named arbiter's ruling. wafiqr cannot release, redirect or freeze anything.
- **Arbiter.** An address named in each escrow before funding, accepted by both parties.
  No default arbiter, no admin key over escrows.
- **Fees.** The relayer fee-bumps what the user already authorised and cannot change it.
  If it is down, the user pays the fee in XLM and the deal continues.
- **Threats.** A compromised page funding the wrong contract or a larger amount is
  refused on chain. A database breach exposes no keys and no personal data.
- **Recovery.** A synced passkey plus an optional second passkey as backup signer; for a
  classic wallet, the user's own backup file. wafiqr cannot recover an account for anyone.
- **Limits.** Country is self-declared; the licensed ramp and exchange hold the verified
  identity. Trustless Work's contract was last audited in September 2025, one more reason
  the sprint stays on testnet.

## Out of scope

Mainnet and real-money trades (they wait for an independent audit of the policy contract,
not paid from this award). Writing or changing an escrow contract. Hosting, domains, API
keys, AI tools or other running costs. Marketing, buyer recruitment, pilot incentives.
Legal opinions. Any role other than engineering in the budget.

## Prior art

Trustless Work (SCF #31) provides the escrow; wafiqr writes none. Kutana (SCF #45 Build)
runs trade escrow for African SMEs on Trustless Work and, per its own submission, signs
for users through a service that holds the role keys. wafiqr does the opposite: a wallet
the user controls, an on-chain policy on what it may sign, and a corridor (Indonesia, no
Stellar anchor for the rupiah) no funded project serves.

## Next phases

2. Independent audit of the policy contract, funded outside the Instaward; then a capped
   mainnet launch.
3. Rupiah pay-out through a licensed issuer on Stellar, replacing the exchange hop.

The business model is a 1% platform fee set in the escrow's own platform-fee field and
paid on release, never on a refund. It stays at zero until mainnet.

---

*References: [Instaward rules](https://stellar.gitbook.io/scf-handbook/scf-awards/instawards/official-rules) ·
[Smart Account Kit](https://github.com/stellar/smart-account-kit) ·
[OpenZeppelin stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) ·
[OpenZeppelin Relayer on Stellar](https://developers.stellar.org/docs/tools/openzeppelin-relayer) ·
[Trustless Work escrow contract](https://github.com/Trustless-Work/trustlesswork-smart-contract-stellar)*
