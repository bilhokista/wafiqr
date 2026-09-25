// Domain types shared by the marketplace, the deal room, and the escrow widget.

export type Incoterm = 'EXW' | 'FOB' | 'CIF' | 'DDP';

export interface SellerProfile {
  uid: string;
  displayName: string;
  village: string; // "Sari Wangi, Bogor"
  country: string;
  story: string; // what this producer makes and why
  walletAddress: string; // Stellar address that receives escrow funds
  verifiedAt?: number;
  createdAt: number;
}

export interface Listing {
  id: string;
  sellerUid: string;
  sellerName: string;
  sellerVillage: string;
  sellerWallet: string;
  title: string;
  origin: string; // "Banda Islands, Maluku"
  category: string; // spice, craft, textile, coffee
  unit: string; // "L", "kg", "pcs"
  minOrder: number;
  pricePerUnit: number; // USDC
  leadTimeDays: number;
  incoterm: Incoterm;
  specs: string; // GC-MS report, moisture content, grade
  description: string;
  imageUrl: string;
  active: boolean;
  createdAt: number;
}

export type DealStatus =
  | 'draft'
  | 'deployed'
  | 'funded'
  | 'shipped'
  | 'approved'
  | 'released'
  | 'disputed'
  | 'resolved';

export interface Evidence {
  kind: 'shipment' | 'inspection' | 'dispute';
  note: string;
  link?: string;
  trackingNumber?: string;
  byUid: string;
  byRole: 'buyer' | 'seller' | 'arbiter';
  at: number;
}

export interface Deal {
  id: string;
  listingId: string;
  listingTitle: string;
  imageUrl: string;
  buyerUid: string;
  buyerName: string;
  buyerWallet: string;
  sellerUid: string;
  sellerName: string;
  sellerWallet: string;
  arbiterWallet: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  amount: number; // quantity * pricePerUnit, in USDC
  incoterm: Incoterm;
  specs: string;
  shipBy: number; // epoch ms deadline the seller agreed to
  status: DealStatus;
  contractId: string; // Trustless Work escrow contract
  /** How the seller chose to be paid. Defaults to `wallet` for older deals. */
  payoutRail?: PayoutRail;
  evidence: Evidence[];
  createdAt: number;
  updatedAt: number;
}

/**
 * How a seller is paid out after release.
 *
 * `wallet` is the status quo: USDC lands in the seller's Stellar account and
 * stops there. That is fine for a seller who wants to hold USDC and useless to
 * a village producer who needs rupiah in a bank.
 *
 * `bank` runs the released USDC through a licensed off-ramp into an Indonesian
 * bank account. wafiqr never holds the funds — the licensed provider does, and
 * only for as long as the conversion takes.
 *
 * `exchange` sends the released USDC to the seller's own account at a licensed
 * exchange, where the seller sells it and withdraws to their bank themselves.
 * It needs no contract with anyone, which is why it works today.
 */
export type PayoutRail = 'wallet' | 'bank' | 'exchange';

export type PayoutStatus =
  | 'none'
  | 'quoted'
  | 'submitted'
  | 'settled'
  | 'failed';

/**
 * What an Indonesian exporter must be able to show about a payment.
 *
 * Exporters of natural resources must repatriate export proceeds into an
 * onshore account (PP 21/2026, PBI 5/2026). A payout that ends in a crypto
 * wallet leaves the exporter unable to show that, so the record has to carry
 * the onshore leg or the tool is a liability to the person using it.
 *
 * Every field is what the exporter supplies or the provider returns. wafiqr
 * asserts none of it — it records what it was given, with a timestamp.
 */
export interface SettlementRecord {
  /** Bank account the proceeds landed in, masked for display. */
  accountMasked: string;
  /** Bank name as the provider reported it. */
  bankName: string;
  /** True when the account is at a state-owned (Himbara) bank. */
  himbara: boolean;
  /** Customs export declaration number, when the exporter has filed one. */
  pebNumber?: string;
  /** Amount credited, in IDR, as the provider reported it. */
  idrAmount: number;
  /** Rate the provider used, IDR per USDC. */
  idrPerUsdc: number;
  /** Provider's own reference, so a stranger can reconcile. */
  providerReference: string;
  settledAt: number;
}

export interface Payout {
  dealId: string;
  rail: PayoutRail;
  status: PayoutStatus;
  /** Which licensed off-ramp handled it. Empty while `rail` is `wallet`. */
  provider: string;
  usdcAmount: number;
  /** Present once the provider has quoted, before anything is sent. */
  quotedIdr?: number;
  /** Present only after the money is onshore. */
  settlement?: SettlementRecord;
  /** Provider error text, kept verbatim rather than summarised. */
  failure?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'buyer' | 'seller';
  walletAddress: string;
  /** `embedded` is the wallet wafiqr creates in the browser; `external` is Freighter and friends. */
  walletKind?: 'embedded' | 'external';
  country: string;
  createdAt: number;
}

/**
 * Where a seller's own exchange account takes Stellar deposits.
 *
 * Exchanges credit a shared deposit address by memo. A payment that arrives
 * without the right memo reaches the exchange and belongs to nobody, so the
 * memo is part of the destination, not an optional note on it.
 */
export interface ExchangeDestination {
  exchange: string; // "Indodax", "Tokocrypto"
  address: string; // G… deposit address the exchange shows
  memo: string;
  memoType: 'text' | 'id';
  /** What the exchange accepts on Stellar. Most take XLM; fewer take USDC. */
  asset: 'XLM' | 'USDC';
}

/** A sealed embedded wallet as stored for recovery. See `vault.ts`. */
export interface WalletVault {
  uid: string;
  publicKey: string;
  sealed: import('./vault').SealedSecret;
  createdAt: number;
}

/**
 * What a user keeps on file that no counterparty should read.
 *
 * Separate from `UserProfile` because profiles are readable by any signed-in
 * account, and an exchange deposit memo ties a person to their exchange
 * account. The rules let only the owner read this one.
 */
export interface PrivateProfile {
  uid: string;
  exchangeDestination?: ExchangeDestination;
  updatedAt: number;
}
