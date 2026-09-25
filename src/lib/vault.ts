// Encrypts a wallet secret under a passphrase only its owner knows.
//
// This is what keeps wafiqr out of custody. The secret is sealed in the
// browser before it goes anywhere, and what is stored — on the device and in
// Firestore for recovery — is ciphertext that wafiqr cannot open. Holding a key
// someone else can spend with is what makes a platform a custodian; holding a
// box it has no key to is not.
//
// WebCrypto only: PBKDF2-SHA256 to stretch the passphrase, AES-256-GCM to seal.
// No dependency, because the fewer hands this code passes through the better.

/** OWASP's 2023 floor for PBKDF2-SHA256. Slow on purpose: it is the guess rate. */
export const PBKDF2_ITERATIONS = 600_000;

/** Short enough to type on a phone, long enough that the iteration count matters. */
export const MIN_PASSPHRASE_LENGTH = 10;

export interface SealedSecret {
  v: 1;
  /** base64 */
  salt: string;
  /** base64 */
  iv: string;
  /** base64, AES-GCM output including the tag */
  ciphertext: string;
  iterations: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function passphraseProblem(passphrase: string): string | null {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    return `Use at least ${MIN_PASSPHRASE_LENGTH} characters. A short passphrase is the one part of this an attacker can guess.`;
  }
  return null;
}

export async function seal(secret: string, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<SealedSecret> {
  const problem = passphraseProblem(passphrase);
  if (problem) throw new Error(problem);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(secret)));

  return { v: 1, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext), iterations };
}

/**
 * Opens a sealed secret. A wrong passphrase fails the GCM tag check and comes
 * back as one plain sentence, not as a crypto exception nobody can act on.
 */
export async function open(sealed: SealedSecret, passphrase: string): Promise<string> {
  if (sealed.v !== 1) throw new Error(`Unknown vault version ${String(sealed.v)}.`);
  const key = await deriveKey(passphrase, fromBase64(sealed.salt), sealed.iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv) },
      key,
      fromBase64(sealed.ciphertext),
    );
    return decoder.decode(plain);
  } catch {
    throw new Error('That passphrase does not open this wallet.');
  }
}
