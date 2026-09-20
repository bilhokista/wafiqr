// Auth context: email/password accounts with a Stellar wallet linked on the profile.
// A village producer can register before they own a wallet, then link one later.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
  signOut: () => Promise<void>;
  linkWallet: () => Promise<string>;
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
        await saveUserProfile({ ...(profile as UserProfile), uid: user.uid, walletAddress });
        setProfile((prev) => (prev ? { ...prev, walletAddress } : prev));
        return walletAddress;
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
