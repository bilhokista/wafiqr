// "Get the money into your wallet", for someone who has only ever paid with
// QRIS, a bank transfer or a card.
//
// The panel asks the chain what is missing and shows one step at a time. The
// deposit step is the only one the person does elsewhere — at a licensed
// exchange or ramp — and the panel watches for it to land, so they do not have
// to come back and press refresh.
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { advanceTopUp, checkTopUp, fundWithFriendbot, TOP_UP_SOURCES, type TopUpStep } from '../lib/topup';
import { isMainnet } from '../lib/network';
import { Action, Badge, Notice, Spinner, usdc } from './kit';
import { ArrowUpRight } from './icons';

/** How often to look for a deposit while the panel is open. Horizon is cheap; people are impatient. */
const POLL_MS = 8000;

export function TopUpPanel({
  address,
  usdcNeeded,
  onReady,
}: {
  address: string;
  /** 0 means "just get this wallet able to receive USDC", which is what a seller needs. */
  usdcNeeded: number;
  onReady?: () => void;
}) {
  const [step, setStep] = useState<TopUpStep | null>(null);
  const [balances, setBalances] = useState<{ xlm: number; usdc: number } | null>(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const readyFired = useRef(false);

  async function refresh() {
    try {
      const { state, step: next } = await checkTopUp(address, usdcNeeded);
      setBalances({ xlm: state.xlm, usdc: state.usdc });
      setStep(next);
      if (next.kind === 'ready' && !readyFired.current) {
        readyFired.current = true;
        onReady?.();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    readyFired.current = false;
    refresh();
    QRCode.toDataURL(address, { margin: 1, width: 180 }).then(setQr).catch(() => setQr(''));
    // Only the deposit step is waiting on the outside world; poll just then.
  }, [address, usdcNeeded]);

  useEffect(() => {
    if (step?.kind !== 'deposit') return;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [step?.kind, address, usdcNeeded]);

  async function advance() {
    if (!step) return;
    setBusy(true);
    setError('');
    try {
      await advanceTopUp(address, step);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!step) return <p className="text-[13px] text-ink-mute"><Spinner /> Checking your wallet…</p>;

  return (
    <div className="space-y-4">
      {balances && (
        <div className="flex flex-wrap gap-2">
          <Badge>{balances.xlm.toFixed(2)} XLM</Badge>
          <Badge tone={step.kind === 'ready' ? 'good' : 'neutral'}>{usdc(balances.usdc)}</Badge>
          {!isMainnet && <Badge tone="warn">testnet</Badge>}
        </div>
      )}

      {step.kind === 'deposit' && (
        <>
          <p className="text-[13px] leading-relaxed text-ink-soft">
            {step.reason === 'new-account'
              ? 'This wallet is new and empty. '
              : 'This wallet needs a little more. '}
            Send about <strong>{step.xlmNeeded} XLM</strong> to it from an exchange or ramp you
            already use. Pay there with QRIS, a bank transfer or a card; withdraw on the{' '}
            <strong>Stellar</strong> network to the address below.
          </p>

          <div className="flex flex-col items-center gap-3 rounded-2xl bg-paper-deep/60 p-4 ring-1 ring-ink/[0.06]">
            {qr && <img src={qr} alt="Wallet address as a QR code" width={180} height={180} />}
            <p className="break-all text-center font-mono text-[12px]">{address}</p>
            <button
              className="text-[12px] text-spice underline underline-offset-4"
              onClick={() => {
                navigator.clipboard.writeText(address).then(() => setCopied(true)).catch(() => undefined);
              }}
            >
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>

          <p className="text-[12px] text-ink-mute">
            This is your own wallet, so leave the memo empty. Watching for the deposit…
          </p>

          {!isMainnet && step.reason === 'new-account' && (
            <Action
              full
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await fundWithFriendbot(address);
                  await refresh();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Testnet: fund it with play XLM
            </Action>
          )}

          <ul className="space-y-2">
            {TOP_UP_SOURCES.map((source) => (
              <li key={source.name} className="rounded-2xl border border-ink/10 px-4 py-3 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{source.name}</span>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-spice">
                      Open <ArrowUpRight size={11} />
                    </a>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-ink-mute">{source.how}</p>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-ink-mute">
            wafiqr does not sell or convert currency and is not paid by these providers. Each is the
            licensed party where it operates; you are their customer.
          </p>
        </>
      )}

      {step.kind === 'trustline' && (
        <>
          <p className="text-[13px] text-ink-soft">
            The XLM arrived. One more step lets this wallet hold USDC, the dollar the escrow is kept in.
          </p>
          <Action full disabled={busy} trailing={busy ? <Spinner /> : undefined} onClick={advance}>
            Let this wallet hold USDC
          </Action>
        </>
      )}

      {step.kind === 'swap' && (
        <>
          <p className="text-[13px] text-ink-soft">
            Turn about {step.xlmCost} XLM into {usdc(step.usdcToBuy)} at today’s rate on the Stellar
            exchange. If the price moves more than 1% before it settles, nothing happens and you can try again.
          </p>
          <Action full disabled={busy} trailing={busy ? <Spinner /> : undefined} onClick={advance}>
            Get {usdc(step.usdcToBuy)}
          </Action>
        </>
      )}

      {step.kind === 'ready' && (
        <Notice tone="info">
          {usdcNeeded > 0 ? `${usdc(usdcNeeded)} is ready in your wallet.` : 'This wallet can receive USDC.'}
        </Notice>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
