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
  evidence: Evidence[];
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'buyer' | 'seller';
  walletAddress: string;
  country: string;
  createdAt: number;
}
