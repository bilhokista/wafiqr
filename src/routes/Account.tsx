// Account: the profile a counterparty sees, and the wallet the escrow pays.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { saveUserProfile } from '../lib/db';
import { addUsdcTrustline } from '../lib/trustline';
import { Action, Badge, Eyebrow, Field, Notice, Shell, Spinner } from '../ui/kit';
import { ArrowUpRight } from '../ui/icons';
import { WalletPanel } from '../ui/WalletPanel';

export function Account() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');

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
              <WalletPanel />
            </Field>

            {profile.walletAddress && profile.walletKind !== 'embedded' && (
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
            <Field
              label="Country"
              hint={profile.country
                ? 'Set once and fixed, because wafiqr only settles trades that cross a border.'
                : 'Where you buy from or ship from. You can set this once; wafiqr only settles trades that cross a border.'}
            >
              <input
                className="field"
                value={country || profile.country}
                disabled={!!profile.country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Singapore"
              />
            </Field>
            <Action
              full
              disabled={!!busy || ((!displayName || displayName === profile.displayName) && (!country || country === profile.country))}
              onClick={() => act('Save profile', async () => {
                await saveUserProfile({ ...profile, displayName: displayName || profile.displayName, country: country || profile.country });
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
