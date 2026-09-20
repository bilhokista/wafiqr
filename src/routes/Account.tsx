// Account: the profile a counterparty sees, and the wallet the escrow pays.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { saveUserProfile } from '../lib/db';
import { addUsdcTrustline } from '../lib/trustline';
import { Action, Badge, Eyebrow, Field, Notice, Shell, Spinner, shortAddress } from '../ui/kit';
import { ArrowUpRight, Wallet } from '../ui/icons';

export function Account() {
  const { user, profile, loading, linkWallet, refreshProfile } = useAuth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('');

  if (loading) return <main className="mx-auto max-w-lg px-4 py-32"><Spinner /></main>;

  if (!user || !profile) {
    return (
      <main className="mx-auto max-w-lg px-4 py-32">
        <h1 className="text-3xl">Not signed in.</h1>
        <Link to="/signin" className="mt-8 inline-block"><Action trailing={<ArrowUpRight size={13} />}>Sign in</Action></Link>
      </main>
    );
  }

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-20 md:py-32">
      <Shell>
        <div className="p-8">
          <Eyebrow>Account</Eyebrow>
          <h1 className="mt-4 text-3xl leading-tight">{profile.displayName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge>{profile.role}</Badge>
            {profile.country && <Badge>{profile.country}</Badge>}
            <Badge tone={profile.walletAddress ? 'good' : 'warn'}>
              {profile.walletAddress ? 'wallet linked' : 'no wallet'}
            </Badge>
          </div>
          <p className="mt-4 text-[13px] text-ink-mute">{profile.email}</p>

          <div className="mt-8 space-y-4">
            <Field label="Stellar wallet" hint="Escrow funds settle to this address. It is public by design — counterparties can verify it.">
              <div className="flex items-center gap-3 rounded-2xl bg-paper-deep/60 px-4 py-3 font-mono text-[12px] ring-1 ring-ink/[0.06]">
                <Wallet size={14} />
                <span className="truncate">{profile.walletAddress ? shortAddress(profile.walletAddress) : 'not linked'}</span>
              </div>
            </Field>

            <Action
              variant="ghost"
              full
              disabled={!!busy}
              onClick={() => act('Link wallet', async () => {
                const address = await linkWallet();
                setMessage(`Wallet ${shortAddress(address)} linked.`);
              })}
            >
              {profile.walletAddress ? 'Link a different wallet' : 'Connect a Stellar wallet'}
            </Action>

            {profile.walletAddress && (
              <Action
                variant="ghost"
                full
                disabled={!!busy}
                onClick={() => act('Add USDC trustline', async () => {
                  await addUsdcTrustline(profile.walletAddress);
                  setMessage('USDC trustline added. The wallet can now hold escrow payouts.');
                })}
              >
                Add the USDC trustline
              </Action>
            )}

            <Field label="Display name">
              <input
                className="field"
                value={displayName || profile.displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Action
              full
              disabled={!!busy || !displayName || displayName === profile.displayName}
              onClick={() => act('Save profile', async () => {
                await saveUserProfile({ ...profile, displayName });
                await refreshProfile();
                setMessage('Profile saved.');
              })}
            >
              Save changes
            </Action>

            {busy && <p className="text-[12px] text-ink-mute"><Spinner /> {busy}…</p>}
            {message && <Notice tone="info">{message}</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </div>
      </Shell>
    </main>
  );
}
