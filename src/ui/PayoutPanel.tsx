// The last panel in the deal room, and the one that used to lie.
//
// Before this, a released escrow showed "Paid out. The trade closed clean." to
// both sides. The buyer's half of that was true. The seller's was not: the
// money was USDC in a Stellar account, and the producer this was built for
// cannot spend USDC, cannot show it to a bank, and cannot report it as export
// proceeds. Closing the deal room on that sentence told the one person taking
// the risk that they had been paid, when they had been given a balance.
//
// So this panel shows the last mile as what it is — a separate leg, with its
// own state, that is not finished until rupiah is in an account.
import { useEffect, useState } from 'react';
import { getPayout } from '../lib/db';
import { quotePayout, sendPayout } from '../lib/escrow';
import {
  activeProvider,
  isHimbara,
  repatriationCheck,
  settlementText,
  type Quote,
} from '../lib/payout';
import type { Deal, Payout } from '../lib/types';
import { Action, Badge, Field, Notice, Spinner, usdc } from './kit';
import { Wallet } from './icons';
import { ExchangeCashout } from './ExchangeCashout';

/** State banks, by the code the seller picks. Only these satisfy placement. */
const BANKS: { code: string; name: string }[] = [
  { code: 'BMRI', name: 'Bank Mandiri' },
  { code: 'BBRI', name: 'Bank BRI' },
  { code: 'BBNI', name: 'Bank BNI' },
  { code: 'BTN', name: 'Bank BTN' },
  { code: 'BCA', name: 'Bank Central Asia' },
  { code: 'OTHER', name: 'Another bank' },
];

export function PayoutPanel({
  deal,
  role,
}: {
  deal: Deal;
  role: 'buyer' | 'seller' | 'watcher';
}) {
  const [payout, setPayout] = useState<Payout | null>(null);
  const [loading, setLoading] = useState(true);
  const [bankCode, setBankCode] = useState('BMRI');
  const [account, setAccount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getPayout(deal.id)
      .then(setPayout)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [deal.id]);

  if (loading) {
    return (
      <div className="text-[13px] text-ink-mute">
        <Spinner /> Checking the payout…
      </div>
    );
  }

  const settled = payout?.status === 'settled';

  // The buyer paid and is entitled to know whether the money arrived. They are
  // not entitled to the seller's bank details, and the record does not hold the
  // account number anyway.
  if (role !== 'seller') {
    return (
      <div className="rounded-2xl bg-sage/10 px-4 py-4 text-[13px] text-sage-deep">
        {settled
          ? `The seller reports the proceeds reached their bank. ${payout!.settlement?.himbara ? 'State bank.' : ''}`
          : payout?.status === 'submitted'
            ? `Released, and sent on to the seller’s ${payout.provider || 'exchange'} account. Withdrawing to their bank is the seller’s last step.`
            : 'Released to the seller’s Stellar account. Converting to their local currency is the seller’s next step, and it is not finished yet.'}
      </div>
    );
  }

  if (settled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-sage/10 px-4 py-4 text-sage-deep">
          <Wallet size={18} />
          <span className="text-[13px]">Rupiah received. This trade is finished.</span>
        </div>
        {payout!.settlement && <p className="text-[12px] text-ink-mute">{settlementText(payout!.settlement)}</p>}
      </div>
    );
  }

  const check = repatriationCheck('bank', bankCode);
  const provider = activeProvider();
  const configured = provider.name !== 'none';

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      // Shown verbatim. When no provider is configured this is the honest
      // sentence "wafiqr cannot convert USDC to rupiah itself", and softening
      // it would leave a seller waiting for something that is not coming.
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-6">
      <ExchangeCashout deal={deal} payout={payout} onChange={() => getPayout(deal.id).then(setPayout)} />

      <details className="rounded-2xl border border-ink/10 px-4 py-3">
        <summary className="cursor-pointer text-[13px] text-ink-soft">Straight to a bank account instead</summary>
        <div className="mt-4">
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink-mute">
          {usdc(deal.amount)} is in your Stellar account. That is not rupiah yet.
        </span>
        <Badge tone={payout?.status === 'failed' ? 'bad' : 'warn'}>
          {payout?.status === 'submitted' ? 'Converting' : 'Not converted'}
        </Badge>
      </div>

      <Field label="Bank">
        <select className="field" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
          {BANKS.map((b) => (
            <option key={b.code} value={b.code}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Account number"
        hint="Sent to the licensed provider and not stored here. Only the last digits are kept."
      >
        <input
          className="field font-mono"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="1234567890"
        />
      </Field>

      {!isHimbara(bankCode) && (
        <Notice tone="info">
          {check.reason} This does not stop you. If this shipment is not a natural-resource
          export above the reporting threshold, the rule does not bind you — but only you and
          your customs broker know that, so wafiqr records the choice rather than making it.
        </Notice>
      )}

      {quote && (
        <div className="rounded-2xl border border-ink/10 px-4 py-4 text-[13px]">
          <div>Rp {quote.idrAmount.toLocaleString('id-ID')}</div>
          <div className="mt-1 text-[12px] text-ink-mute">
            at Rp {quote.idrPerUsdc.toLocaleString('id-ID')} per USDC · fee {usdc(quote.feeUsdc)} ·
            good until {new Date(quote.expiresAt).toLocaleTimeString('id-ID')}
          </div>
        </div>
      )}

      <Action
        full
        variant="ghost"
        disabled={!!busy || !account}
        trailing={busy === 'Quote' ? <Spinner /> : undefined}
        onClick={() =>
          run('Quote', async () => {
            const q = await quotePayout(deal, {
              usdcAmount: deal.amount,
              bankAccount: account,
              bankCode,
            });
            setQuote(q);
          })
        }
      >
        See what you would receive
      </Action>

      <Action
        full
        disabled={!!busy || !quote}
        trailing={busy === 'Convert' ? <Spinner /> : <Wallet size={13} />}
        onClick={() =>
          run('Convert', async () => {
            await sendPayout(deal, {
              usdcAmount: deal.amount,
              bankAccount: account,
              bankCode,
              from: deal.sellerWallet,
            });
            setPayout(await getPayout(deal.id));
          })
        }
      >
        Send to my bank
      </Action>

      {!configured && (
        <p className="text-[12px] text-ink-mute">
          No licensed provider is connected yet, so the buttons above will refuse. wafiqr cannot
          convert USDC to rupiah itself — that needs a party holding an Indonesian licence, and
          pretending otherwise on this screen would be the one lie this product cannot afford.
        </p>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </div>
        </div>
      </details>
    </div>
  );
}
