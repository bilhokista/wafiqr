// The wallet section of the account page.
//
// Most people this is for have never held a crypto wallet, so the default is
// one wafiqr makes for them in this browser. The one thing they have to do is
// keep a secret key safe, and the screen says so plainly once, at the moment it
// matters. Freighter stays one tap away for anyone who already has it.
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  createEmbeddedWallet,
  findVault,
  importEmbeddedWallet,
  isEmbeddedUnlocked,
  lockEmbeddedWallets,
  onWalletChange,
  unlockEmbeddedWallet,
} from '../lib/embeddedWallet';
import { passphraseProblem } from '../lib/vault';
import type { WalletVault } from '../lib/types';
import { Action, Badge, Field, Notice, Spinner, shortAddress } from './kit';
import { Wallet } from './icons';

type Mode = 'idle' | 'create' | 'restore';

export function WalletPanel() {
  const { user, profile, linkWallet, adoptEmbeddedWallet } = useAuth();
  const [vault, setVault] = useState<WalletVault | null>(null);
  const [checked, setChecked] = useState(false);
  const [, rerender] = useState(0);
  const [mode, setMode] = useState<Mode>('idle');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [secret, setSecret] = useState('');
  const [shownSecret, setShownSecret] = useState('');
  const [savedIt, setSavedIt] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => onWalletChange(() => rerender((n) => n + 1)), []);

  useEffect(() => {
    if (!user) return;
    findVault(user.uid)
      .then(setVault)
      .catch(() => setVault(null))
      .finally(() => setChecked(true));
  }, [user]);

  if (!user || !profile) return null;
  if (!checked) return <p className="text-[13px] text-ink-mute"><Spinner /> Looking for your wallet…</p>;

  const uid = user.uid;
  const unlocked = vault ? isEmbeddedUnlocked(vault.publicKey) : false;
  const usingEmbedded = vault?.publicKey === profile.walletAddress;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  function passphraseCheck(): string | null {
    const problem = passphraseProblem(passphrase);
    if (problem) return problem;
    if (passphrase !== confirm) return 'The two passphrases do not match.';
    return null;
  }

  // The secret is on screen exactly once. Nothing moves on until the owner
  // says they have it, because after this there is no way to show it again.
  if (shownSecret) {
    return (
      <div className="space-y-4">
        <Notice tone="error">
          Write this secret key on paper and keep it somewhere safe. It is the only way back into
          your wallet if you forget your passphrase or lose this phone. wafiqr does not have a copy
          and cannot recover it for you. Anyone who sees it can spend your money.
        </Notice>
        <p className="break-all rounded-2xl bg-paper-deep/60 px-4 py-4 font-mono text-[13px] ring-1 ring-ink/[0.06]">
          {shownSecret}
        </p>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={savedIt} onChange={(e) => setSavedIt(e.target.checked)} />
          I wrote it down.
        </label>
        <Action full disabled={!savedIt} onClick={() => setShownSecret('')}>
          Done
        </Action>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl bg-paper-deep/60 px-4 py-3 font-mono text-[12px] ring-1 ring-ink/[0.06]">
        <Wallet size={14} />
        <span className="truncate">{profile.walletAddress ? shortAddress(profile.walletAddress) : 'no wallet yet'}</span>
        {profile.walletAddress && (
          <Badge tone={usingEmbedded ? (unlocked ? 'good' : 'warn') : 'neutral'}>
            {usingEmbedded ? (unlocked ? 'wafiqr wallet · unlocked' : 'wafiqr wallet · locked') : 'Freighter'}
          </Badge>
        )}
      </div>

      {/* A wafiqr wallet exists: unlock it, or come back to it. */}
      {vault && !unlocked && mode === 'idle' && (
        <>
          <Field label="Passphrase" hint="Unlocks your wallet in this tab until you close it.">
            <input type="password" className="field" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          </Field>
          <Action
            full
            disabled={!!busy || !passphrase}
            trailing={busy === 'Unlock' ? <Spinner /> : undefined}
            onClick={() => run('Unlock', async () => {
              const address = await unlockEmbeddedWallet(uid, passphrase);
              setPassphrase('');
              if (profile.walletAddress !== address) await adoptEmbeddedWallet(address);
            })}
          >
            Unlock my wallet
          </Action>
          <button className="text-[12px] text-ink-mute underline underline-offset-4" onClick={() => setMode('restore')}>
            Forgot the passphrase? Restore with your secret key
          </button>
        </>
      )}

      {vault && unlocked && (
        <>
          {!usingEmbedded && (
            <Action full variant="ghost" disabled={!!busy} onClick={() => run('Use wallet', () => adoptEmbeddedWallet(vault.publicKey))}>
              Use my wafiqr wallet for trades
            </Action>
          )}
          <Action full variant="ghost" onClick={() => lockEmbeddedWallets()}>
            Lock it now
          </Action>
        </>
      )}

      {/* No wafiqr wallet yet: make one, or bring Freighter. */}
      {!vault && mode === 'idle' && (
        <>
          <Action full onClick={() => setMode('create')}>
            Make me a wallet
          </Action>
          <p className="text-[12px] text-ink-mute">
            No app to install. It lives in this browser, locked with a passphrase only you know.
          </p>
        </>
      )}

      {mode === 'create' && (
        <>
          <Field label="Choose a passphrase" hint="At least 10 characters. A sentence you will remember is better than a short password.">
            <input type="password" className="field" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          </Field>
          <Field label="Type it again">
            <input type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Action
            full
            disabled={!!busy}
            trailing={busy === 'Create' ? <Spinner /> : undefined}
            onClick={() => run('Create', async () => {
              const problem = passphraseCheck();
              if (problem) throw new Error(problem);
              const made = await createEmbeddedWallet(uid, passphrase);
              await adoptEmbeddedWallet(made.publicKey);
              setVault(await findVault(uid));
              setPassphrase('');
              setConfirm('');
              setMode('idle');
              setShownSecret(made.secret);
            })}
          >
            Make the wallet
          </Action>
          <button className="text-[12px] text-ink-mute" onClick={() => setMode('idle')}>Cancel</button>
        </>
      )}

      {mode === 'restore' && (
        <>
          <Field label="Secret key" hint="The one you wrote down. It starts with S.">
            <input className="field font-mono" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </Field>
          <Field label="New passphrase">
            <input type="password" className="field" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          </Field>
          <Field label="Type it again">
            <input type="password" className="field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Action
            full
            disabled={!!busy || !secret}
            trailing={busy === 'Restore' ? <Spinner /> : undefined}
            onClick={() => run('Restore', async () => {
              const problem = passphraseCheck();
              if (problem) throw new Error(problem);
              const address = await importEmbeddedWallet(uid, secret, passphrase);
              await adoptEmbeddedWallet(address);
              setVault(await findVault(uid));
              setSecret('');
              setPassphrase('');
              setConfirm('');
              setMode('idle');
            })}
          >
            Restore the wallet
          </Action>
          <button className="text-[12px] text-ink-mute" onClick={() => setMode('idle')}>Cancel</button>
        </>
      )}

      {mode === 'idle' && (
        <Action
          full
          variant="ghost"
          disabled={!!busy}
          onClick={() => run('Link Freighter', async () => {
            await linkWallet();
          })}
        >
          {profile.walletKind === 'external' ? 'Link a different Freighter wallet' : 'I already use Freighter'}
        </Action>
      )}

      {busy && <p className="text-[12px] text-ink-mute"><Spinner /> {busy}…</p>}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}

/** Just the passphrase box, for the places a locked wallet blocks the next step. */
export function UnlockWallet() {
  const { user } = useAuth();
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;

  return (
    <div className="space-y-3 rounded-2xl bg-paper-deep/60 p-4 ring-1 ring-ink/[0.06]">
      <p className="text-[13px] text-ink-soft">Your wafiqr wallet is locked. Unlock it to sign.</p>
      <input
        type="password"
        className="field"
        placeholder="Passphrase"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
      />
      <Action
        full
        disabled={busy || !passphrase}
        trailing={busy ? <Spinner /> : undefined}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            await unlockEmbeddedWallet(user.uid, passphrase);
            setPassphrase('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Unlock
      </Action>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
