// Auth context. A Stellar wallet is linked on the profile, not at sign-up, so a
// village producer can register before they own one.
//
// Two ways in, and Google is the one that matters here. Asking a producer to
// invent and remember a password for a site they have never heard of is a step
// where people leave, and almost everyone this product is for already has a
// Google account on the phone in their hand. Email and password stay for buyers
// abroad who prefer them, and for anyone without one.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { loadUserProfile, saveUserProfile } from './db';
import type { UserProfile } from './types';

interface AuthValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (input: SignUpInput) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Google sign-in, for both first visit and return. Google decides which it is,
   * so the caller does not have to ask someone whether they already have an
   * account — a question people get wrong about themselves.
   */
  signInWithGoogle: (role: 'buyer' | 'seller', country: string) => Promise<void>;
  signOut: () => Promise<void>;
  linkWallet: () => Promise<string>;
  /** Points the profile at a wallet wafiqr made in this browser. */
  adoptEmbeddedWallet: (address: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  role: 'buyer' | 'seller';
  country: string;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Without credentials there is no auth service to subscribe to. The app still
    // renders; it just has no signed-in user.
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      setProfile(next ? await loadUserProfile(next.uid) : null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile,
      loading,
      async signUp({ email, password, displayName, role, country }) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName });
        const fresh: UserProfile = {
          uid: credential.user.uid,
          email,
          displayName,
          role,
          country,
          walletAddress: '',
          createdAt: Date.now(),
        };
        await saveUserProfile(fresh);
        setProfile(fresh);
      },
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signInWithGoogle(role, country) {
        const credential = await signInWithPopup(auth, new GoogleAuthProvider());
        const existing = await loadUserProfile(credential.user.uid);

        // A returning account keeps the role and country it already chose. Only
        // the first sign-in writes them, so signing in again cannot silently
        // turn a seller into a buyer.
        if (existing) {
          setProfile(existing);
          return;
        }

        const fresh: UserProfile = {
          uid: credential.user.uid,
          email: credential.user.email ?? '',
          displayName: credential.user.displayName ?? credential.user.email ?? 'Unnamed',
          role,
          country,
          walletAddress: '',
          createdAt: Date.now(),
        };
        await saveUserProfile(fresh);
        setProfile(fresh);
      },
      async signOut() {
        await fbSignOut(auth);
        setProfile(null);
      },
      async linkWallet() {
        if (!user) throw new Error('Sign in before linking a wallet');
        // The Stellar SDK is heavy and only needed the moment someone links a
        // wallet, so it loads on demand instead of on first paint.
        const { connectWallet } = await import('./wallet');
        const walletAddress = await connectWallet();
        await saveUserProfile({ ...(profile as UserProfile), uid: user.uid, walletAddress, walletKind: 'external' });
        setProfile((prev) => (prev ? { ...prev, walletAddress, walletKind: 'external' } : prev));
        return walletAddress;
      },
      async adoptEmbeddedWallet(walletAddress) {
        if (!user) throw new Error('Sign in before making a wallet');
        await saveUserProfile({ ...(profile as UserProfile), uid: user.uid, walletAddress, walletKind: 'embedded' });
        setProfile((prev) => (prev ? { ...prev, walletAddress, walletKind: 'embedded' } : prev));
      },
      async refreshProfile() {
        if (user) setProfile(await loadUserProfile(user.uid));
      },
    }),
    [user, profile, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
