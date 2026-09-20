// One screen for both sign-in and registration. A producer can register before
// they own a wallet; linking one is a separate step on the account page.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Action, Eyebrow, Field, Notice, Shell, Spinner } from '../ui/kit';
import { ArrowUpRight } from '../ui/icons';

export function SignIn() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { next?: string } };
  const next = location.state?.next ?? '/deals';

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [country, setCountry] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp({ email, password, displayName, role, country });
      navigate(next);
    } catch (e) {
      setError(readableAuthError(e as Error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-20 md:py-32">
      <Shell>
        <div className="p-8">
          <Eyebrow>{mode === 'in' ? 'Welcome back' : 'New account'}</Eyebrow>
          <h1 className="mt-4 text-3xl leading-tight">
            {mode === 'in' ? 'Sign in to your deals.' : 'Trade with people you have not met yet.'}
          </h1>

          <div className="mt-8 space-y-4">
            {mode === 'up' && (
              <>
                <Field label="Name or business">
                  <input className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Rempah Nusantara" />
                </Field>
                <Field label="Country">
                  <input className="field" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Indonesia" />
                </Field>
                <Field label="You are here to">
                  <div className="flex gap-1 rounded-full bg-ink/[0.04] p-1">
                    {([['buyer', 'Buy goods'], ['seller', 'Sell goods']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRole(key)}
                        className={`flex-1 rounded-full px-4 py-2 text-[12px] transition-all duration-500 ease-fluid
                          ${role === key ? 'bg-paper text-ink shadow-ambient' : 'text-ink-mute hover:text-ink'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            <Field label="Email">
              <input className="field" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" hint={mode === 'up' ? 'At least six characters.' : undefined}>
              <input
                className="field"
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </Field>

            {error && <Notice tone="error">{error}</Notice>}

            <Action full trailing={busy ? <Spinner /> : <ArrowUpRight size={13} />} disabled={busy} onClick={submit}>
              {mode === 'in' ? 'Sign in' : 'Create account'}
            </Action>

            <button
              onClick={() => {
                setMode(mode === 'in' ? 'up' : 'in');
                setError('');
              }}
              className="w-full text-center text-[12px] text-ink-mute transition-colors duration-500 ease-fluid hover:text-ink"
            >
              {mode === 'in' ? 'No account yet? Create one.' : 'Already registered? Sign in.'}
            </button>
          </div>
        </div>
      </Shell>
    </main>
  );
}

/** Firebase auth codes are useful to developers and useless to a producer in a village. */
function readableAuthError(e: Error): string {
  const code = (e as { code?: string }).code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'That email and password do not match.';
  if (code.includes('email-already-in-use')) return 'An account already uses that email. Sign in instead.';
  if (code.includes('weak-password')) return 'Use a password of at least six characters.';
  if (code.includes('invalid-email')) return 'That email address does not look right.';
  if (code.includes('network')) return 'The network dropped. Check the connection and try again.';
  return e.message;
}
