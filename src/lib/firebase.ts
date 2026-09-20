// Firebase app singleton. Config comes from Vite env so the repo stays key-free.
// Without keys the SDK is never initialised: getAuth() throws auth/invalid-api-key
// at import time, which would take the whole page down before it paints.
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

/** True when the deployment has real Firebase credentials wired up. */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId);

const app: FirebaseApp | null = isFirebaseConfigured ? getApps()[0] ?? initializeApp(config) : null;

const OFFLINE = 'Firebase is not configured. Copy .env.example to .env and fill in the project keys.';

/**
 * Stands in for a Firebase service when there are no credentials. Touching any
 * property throws a message a developer can act on, rather than a stack trace
 * from deep inside the SDK at module load.
 */
function offlineService<T>(name: string): T {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(`${name}: ${OFFLINE}`);
      },
    },
  ) as T;
}

export const auth: Auth = app ? getAuth(app) : offlineService<Auth>('auth');
export const db: Firestore = app ? getFirestore(app) : offlineService<Firestore>('firestore');
export const storage: FirebaseStorage = app ? getStorage(app) : offlineService<FirebaseStorage>('storage');
