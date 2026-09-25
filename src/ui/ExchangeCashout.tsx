// The seller's road from released USDC to rupiah, through their own exchange.
//
// It works today because it needs nobody's permission: the seller already has
// an account at a licensed exchange, the exchange already takes deposits on
// Stellar, and selling and withdrawing to a bank is what that account is for.
// wafiqr builds one payment and records where it went.
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { destinationProblems, quoteCashout } from '../lib/cashout';
import { loadPrivateProfile, savePrivateProfile } from '../lib/db';
import { cashoutAmount, cashoutForDeal, confirmBankArrival } from '../lib/escrow';
import type { Deal, ExchangeDestination, Payout } from '../lib/types';
import { Action, Field, Notice, Spinner, usdc } from './kit';
import { Wallet } from './icons';

const EMPTY: ExchangeDestination = { exchange: '', address: '', memo: '', memoType: 'text', asset: 'XLM' };

export function ExchangeCashout({ deal, payout, onChange }: { deal: Deal; payout: Payout | null; onChange: () => void }) {
  const { user } = useAuth();
  const [dest, setDest] = useState<ExchangeDestination>(EMPTY);
  const [quote, setQuote] = useState<{ receive: number; send: number } | null>(null);
  const [idr, setIdr] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // The destination is the seller's to keep on file, privately, so the second
  // trade does not mean copying the memo out of the exchange app again.
  useEffect(() => {
    if (!user) return;
    loadPrivateProfile(user.uid)
      .then((p) => p?.exchangeDestination && setDest(p.exchangeDestination))
      .catch(() => undefined);
  }, [user]);

  const sent = payout?.rail === 'exchange' && payout.status === 'submitted';
  const problems = destinationProblems(dest, deal.sellerWallet);

  function set<K extends keyof ExchangeDestination>(key: K, value: ExchangeDestination[K]) {
    setDest((prev) => ({ ...prev, [key]: value }));
    setQuote(null);
  }

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

  if (sent) {
    return (
      <div className="space-y-4">
        <Notice tone="info">
          Sent to your {payout!.provider} account. Sell it there and withdraw the rupiah to your bank,
          the same way you would with anything else you hold at {payout!.provider}.
        </Notice>
        <Field label="Rupiah that reached your bank (optional)" hint="Recorded as your statement, so the buyer can see the trade finished.">
          <input className="field font-mono" inputMode="numeric" value={idr} onChange={(e) => setIdr(e.target.value.replace(/\D/g, ''))} placeholder="1250000" />
        </Field>
        <Action
          full
          disabled={!!busy}
          trailing={busy ? <Spinner /> : undefined}
          onClick={() => run('Confirm', async () => {
            await confirmBankArrival(deal, idr ? Number(idr) : undefined);
            onChange();
          })}
        >
          The rupiah is in my bank
        </Action>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-ink-soft">
        Send it to your own exchange account, sell it there, and withdraw to your bank. Open your
        exchange app, choose deposit {dest.asset}, network <strong>Stellar</strong>, and copy the
        address and memo it shows.
      </p>

      <Field label="Exchange">
        <input className="field" value={dest.exchange} onChange={(e) => set('exchange', e.target.value)} placeholder="Indodax" />
      </Field>
      <Field label="Deposit address" hint="Starts with G. Copy it from the exchange; do not type it.">
        <input className="field font-mono" value={dest.address} onChange={(e) => set('address', e.target.value.trim())} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Field label="Memo" hint="Required. Without it the exchange cannot tell the money is yours.">
            <input className="field font-mono" value={dest.memo} onChange={(e) => set('memo', e.target.value)} />
          </Field>
        </div>
        <Field label="Memo type">
          <select className="field" value={dest.memoType} onChange={(e) => set('memoType', e.target.value as 'text' | 'id')}>
            <option value="text">Text</option>
            <option value="id">ID</option>
          </select>
        </Field>
      </div>
      <Field label="Your exchange takes" hint="Most exchanges take XLM on Stellar. Pick USDC only if yours lists USDC on the Stellar network.">
        <select className="field" value={dest.asset} onChange={(e) => set('asset', e.target.value as 'XLM' | 'USDC')}>
          <option value="XLM">XLM (converted from your USDC on the way)</option>
          <option value="USDC">USDC</option>
        </select>
      </Field>

      {dest.address && problems.length > 0 && (
        <Notice tone="error">{problems.join(' ')}</Notice>
      )}

      {quote !== null && (
        <div className="rounded-2xl border border-ink/10 px-4 py-4 text-[13px]">
          Your {dest.exchange || 'exchange'} account receives at least{' '}
          <strong>{quote.receive.toFixed(2)} {dest.asset}</strong> for {usdc(quote.send)}
          {quote.send < deal.amount && ' (the escrow service took its fee at release)'}.
          {dest.asset === 'XLM' && ' The rupiah amount is whatever your exchange pays for that XLM when you sell.'}
        </div>
      )}

      <Action
        full
        variant="ghost"
        disabled={!!busy || problems.length > 0}
        trailing={busy === 'Quote' ? <Spinner /> : undefined}
        onClick={() => run('Quote', async () => {
          const send = await cashoutAmount(deal, payout?.usdcAmount);
          if (send <= 0) throw new Error('There is no USDC in your wallet yet. Has the escrow been released to it?');
          setQuote({ send, receive: (await quoteCashout(send, dest.asset)).receive });
        })}
      >
        See what arrives
      </Action>

      <Action
        full
        disabled={!!busy || problems.length > 0 || quote === null}
        trailing={busy === 'Send' ? <Spinner /> : <Wallet size={13} />}
        onClick={() => run('Send', async () => {
          if (user) await savePrivateProfile({ uid: user.uid, exchangeDestination: dest, updatedAt: Date.now() });
          await cashoutForDeal(deal, dest);
          onChange();
        })}
      >
        Send to my exchange
      </Action>

      <p className="text-[11px] text-ink-mute">
        Check the memo twice against the exchange app. A payment with the wrong memo cannot be
        pulled back from here; only the exchange's support can match it to you, and slowly.
      </p>

      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
