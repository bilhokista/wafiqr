// Firestore access for the marketplace. Every write goes through here so the
// security rules in firestore.rules have a single shape to validate against.
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  arrayUnion,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Deal, DealStatus, Evidence, Listing, UserProfile, Payout, PayoutStatus } from './types';

const LISTINGS = 'listings';
const DEALS = 'deals';
const USERS = 'users';
const PAYOUTS = 'payouts';

// --- Users -----------------------------------------------------------------

export async function saveUserProfile(profile: UserProfile) {
  await setDoc(doc(db, USERS, profile.uid), profile, { merge: true });
}

export async function loadUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, USERS, uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// --- Listings --------------------------------------------------------------

export async function createListing(input: Omit<Listing, 'id' | 'createdAt'>): Promise<string> {
  const created = await addDoc(collection(db, LISTINGS), { ...input, createdAt: Date.now() });
  return created.id;
}

export async function listActiveListings(category?: string): Promise<Listing[]> {
  const base = collection(db, LISTINGS);
  const q = category
    ? query(base, where('active', '==', true), where('category', '==', category), fsLimit(60))
    : query(base, where('active', '==', true), fsLimit(60));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ ...(d.data() as Listing), id: d.id }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function listSellerListings(sellerUid: string): Promise<Listing[]> {
  const snap = await getDocs(query(collection(db, LISTINGS), where('sellerUid', '==', sellerUid)));
  return snap.docs
    .map((d) => ({ ...(d.data() as Listing), id: d.id }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getListing(id: string): Promise<Listing | null> {
  const snap = await getDoc(doc(db, LISTINGS, id));
  return snap.exists() ? { ...(snap.data() as Listing), id: snap.id } : null;
}

export async function setListingActive(id: string, active: boolean) {
  await updateDoc(doc(db, LISTINGS, id), { active });
}

export async function uploadListingImage(sellerUid: string, file: File): Promise<string> {
  const path = `listings/${sellerUid}/${Date.now()}-${file.name}`;
  await uploadBytes(ref(storage, path), file);
  return getDownloadURL(ref(storage, path));
}

// --- Deals -----------------------------------------------------------------

export async function createDeal(input: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = Date.now();
  const created = await addDoc(collection(db, DEALS), { ...input, createdAt: now, updatedAt: now });
  return created.id;
}

export async function getDeal(id: string): Promise<Deal | null> {
  const snap = await getDoc(doc(db, DEALS, id));
  return snap.exists() ? { ...(snap.data() as Deal), id: snap.id } : null;
}

/** Live deal view — the buyer sees the seller's shipment proof without reloading. */
export function watchDeal(id: string, onChange: (deal: Deal | null) => void) {
  return onSnapshot(doc(db, DEALS, id), (snap) =>
    onChange(snap.exists() ? { ...(snap.data() as Deal), id: snap.id } : null),
  );
}

export async function listDealsFor(uid: string, side: 'buyerUid' | 'sellerUid'): Promise<Deal[]> {
  const snap = await getDocs(
    query(collection(db, DEALS), where(side, '==', uid), orderBy('createdAt', 'desc'), fsLimit(50)),
  );
  return snap.docs.map((d) => ({ ...(d.data() as Deal), id: d.id }));
}

export async function updateDealStatus(id: string, status: DealStatus, contractId?: string) {
  await updateDoc(doc(db, DEALS, id), {
    status,
    updatedAt: Date.now(),
    ...(contractId ? { contractId } : {}),
  });
}

export async function appendEvidence(id: string, evidence: Evidence) {
  await updateDoc(doc(db, DEALS, id), { evidence: arrayUnion(evidence), updatedAt: Date.now() });
}

/**
 * The payout record for a deal.
 *
 * Kept as its own document rather than a field on the deal, because the deal's
 * commercial terms are frozen after creation by the security rules, and a
 * payout moves through states long after that freeze.
 */
export async function savePayout(payout: Payout) {
  await setDoc(doc(db, PAYOUTS, payout.dealId), { ...payout, updatedAt: Date.now() });
}

export async function getPayout(dealId: string): Promise<Payout | null> {
  const snap = await getDoc(doc(db, PAYOUTS, dealId));
  return snap.exists() ? (snap.data() as Payout) : null;
}

export async function updatePayout(dealId: string, patch: Partial<Payout>) {
  await updateDoc(doc(db, PAYOUTS, dealId), { ...patch, updatedAt: Date.now() });
}

export async function setPayoutStatus(dealId: string, status: PayoutStatus, failure?: string) {
  await updateDoc(doc(db, PAYOUTS, dealId), {
    status,
    updatedAt: Date.now(),
    ...(failure ? { failure } : {}),
  });
}
