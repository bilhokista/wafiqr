import { describe, expect, it } from 'vitest';
import { open, passphraseProblem, seal } from './vault';

// A low iteration count keeps the suite fast; the production default is
// exercised by the one test that checks it is the default.
const FAST = 1_000;
const SECRET = 'SBXYZEXAMPLESECRETNOTREALXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

describe('vault', () => {
  it('opens what it sealed with the same passphrase', async () => {
    const sealed = await seal(SECRET, 'correct horse battery', FAST);
    expect(await open(sealed, 'correct horse battery')).toBe(SECRET);
  });

  it('refuses the wrong passphrase with a sentence, not a crypto error', async () => {
    const sealed = await seal(SECRET, 'correct horse battery', FAST);
    await expect(open(sealed, 'correct horse batterx')).rejects.toThrow('That passphrase does not open this wallet.');
  });

  it('never stores the secret in the clear', async () => {
    const sealed = await seal(SECRET, 'correct horse battery', FAST);
    expect(JSON.stringify(sealed)).not.toContain(SECRET);
  });

  it('uses a fresh salt and iv every time', async () => {
    const a = await seal(SECRET, 'correct horse battery', FAST);
    const b = await seal(SECRET, 'correct horse battery', FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('detects a tampered ciphertext', async () => {
    const sealed = await seal(SECRET, 'correct horse battery', FAST);
    const bytes = atob(sealed.ciphertext).split('');
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 1);
    await expect(open({ ...sealed, ciphertext: btoa(bytes.join('')) }, 'correct horse battery')).rejects.toThrow();
  });

  it('rejects short passphrases before sealing anything', async () => {
    expect(passphraseProblem('short')).toMatch(/at least 10/);
    await expect(seal(SECRET, 'short', FAST)).rejects.toThrow(/at least 10/);
  });

  it('defaults to the OWASP iteration floor', async () => {
    const sealed = await seal(SECRET, 'correct horse battery');
    expect(sealed.iterations).toBe(600_000);
  });
});
