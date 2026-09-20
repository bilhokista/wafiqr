// The deal room. One contract, two parties, one shared timeline.
// Which actions appear depends on who is signed in and what the chain says.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { watchDeal } from '../lib/db';
import { useAuth } from '../lib/auth';
import {
  approveForDeal,
  deployForDeal,
  disputeForDeal,
  fundForDeal,
  releaseForDeal,
  shipForDeal,
  syncFromChain,
  termsText,
} from '../lib/escrow';
import { addUsdcTrustline, buyUsdcWithXlm } from '../lib/trustline';
import type { Deal, DealStatus } from '../lib/types';
import { Action, Badge, Eyebrow, Field, Notice, Shell, Spinner, shortAddress, shortDate, usdc } from '../ui/kit';
import { ArrowRight, Clock, Scale, Shield, Ship, Wallet } from '../ui/icons';

const STEPS: { key: DealStatus; label: string; who: string }[] = [
  { key: 'draft', label: 'Terms agreed', who: 'Both' },
  { key: 'deployed', label: 'Escrow created', who: 'Buyer' },
  { key: 'funded', label: 'Payment locked', who: 'Buyer' },
  { key: 'shipped', label: 'Goods shipped', who: 'Seller' },
  { key: 'approved', label: 'Delivery confirmed', who: 'Buyer' },
  { key: 'released', label: 'Seller paid', who: 'Buyer' },
];

export function DealRoom() {
  const { id = '' } = useParams();
  const { user, profile } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [link, setLink] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const stop = watchDeal(id, (next) => {
      setDeal(next);
      setLoading(false);
    });
    return stop;
  }, [id]);

  // The chain is the source of truth; reconcile the mirror once on open.
  useEffect(() => {
    if (deal?.contractId) syncFromChain(deal).catch(() => undefined);
    // Only re-run when the escrow identity changes, not on every field edit.
  }, [deal?.contractId]);

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-32 text-ink-mute md:px-8"><Spinner /> Opening the deal room…</div>;
  }
  if (!deal) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-32 md:px-8">
        <h1 className="text-4xl">No such deal.</h1>
        <Link to="/deals" className="mt-8 inline-block"><Action variant="ghost">My deals</Action></Link>
      </div>
    );
  }

  const isBuyer = user?.uid === deal.buyerUid;
  const isSeller = user?.uid === deal.sellerUid;
  const role: 'buyer' | 'seller' | 'watcher' = isBuyer ? 'buyer' : isSeller ? 'seller' : 'watcher';
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === deal.status));
  const overdue = deal.status === 'funded' && Date.now() > deal.shipBy;

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-28">
      <Link to="/deals" className="text-[12px] text-ink-mute transition-colors duration-500 ease-fluid hover:text-ink">
        ← My deals
      </Link>

      <header className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Deal {deal.id.slice(0, 8)}</Eyebrow>
          <h1 className="mt-4 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">{deal.listingTitle}</h1>
          <p className="mt-3 text-[13px] text-ink-mute">
            {deal.buyerName} buying from {deal.sellerName} · opened {shortDate(deal.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <StatusBadge status={deal.status} />
          <span className="font-mono text-2xl">{usdc(deal.amount)}</span>
        </div>
      </header>

      {role === 'watcher' && (
        <div className="mt-8"><Notice tone="info">You are viewing this deal as an observer. Only the buyer and the seller can act on it.</Notice></div>
      )}
      {overdue && (
        <div className="mt-8"><Notice tone="error">The ship-by date has passed and no shipment evidence has been filed. The buyer may open a dispute.</Notice></div>
      )}

      <section className="mt-10">
        <Stepper index={stepIndex} status={deal.status} />
      </section>

      <div className="mt-12 grid gap-4 md:grid-cols-12">
        <div className="md:col-span-7">
          <Shell className="h-full">
            <div className="p-7">
              <Eyebrow>The contract</Eyebrow>
              <dl className="mt-6 space-y-3 text-[13px]">
                <Term label="Quantity" value={`${deal.quantity} ${deal.unit} at ${usdc(deal.pricePerUnit)} each`} />
                <Term label="Specification" value={deal.specs} />
                <Term label="Incoterm" value={deal.incoterm} />
                <Term label="Ship by" value={shortDate(deal.shipBy)} />
                <Term label="Buyer wallet" value={shortAddress(deal.buyerWallet)} mono />
                <Term label="Seller wallet" value={shortAddress(deal.sellerWallet)} mono />
                <Term label="Arbiter" value={shortAddress(deal.arbiterWallet)} mono />
                <Term label="Escrow contract" value={deal.contractId ? shortAddress(deal.contractId) : 'not created yet'} mono />
              </dl>
              <p className="mt-6 rounded-2xl bg-paper-deep/60 p-4 font-mono text-[11px] leading-relaxed text-ink-mute">
                {termsText(deal)}
              </p>
              <p className="mt-3 text-[11px] text-ink-mute">
                This exact text is stored in the escrow on Stellar, so the terms are auditable by
                anyone who reads the contract.
              </p>
            </div>
          </Shell>
        </div>

        <div className="md:col-span-5">
          <Shell className="h-full">
            <div className="flex h-full flex-col p-7">
              <Eyebrow>{role === 'seller' ? 'Your move, seller' : 'Your move, buyer'}</Eyebrow>

              <div className="mt-6 flex-1 space-y-3">
                {isBuyer && deal.status === 'draft' && (
                  <>
                    <Action variant="ghost" full disabled={!!busy} onClick={() => act('Add USDC trustline', () => addUsdcTrustline(deal.buyerWallet).then(() => undefined))}>
                      Add USDC trustline (one time)
                    </Action>
                    <Action variant="ghost" full disabled={!!busy} onClick={() => act('Get USDC', () => buyUsdcWithXlm(deal.buyerWallet, deal.amount + 1).then(() => undefined))}>
                      Swap XLM for {usdc(deal.amount + 1)}
                    </Action>
                    <Action full trailing={busy ? <Spinner /> : <ArrowRight size={13} />} disabled={!!busy} onClick={() => act('Create escrow', () => deployForDeal(deal).then(() => undefined))}>
                      Create the escrow
                    </Action>
                  </>
                )}

                {isBuyer && deal.status === 'deployed' && (
                  <Action full trailing={busy ? <Spinner /> : <Wallet size={13} />} disabled={!!busy} onClick={() => act('Fund escrow', () => fundForDeal(deal))}>
                    Lock {usdc(deal.amount)}
                  </Action>
                )}

                {isSeller && deal.status === 'funded' && (
                  <>
                    <Field label="Tracking number">
                      <input className="field font-mono" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="DHL 4821 9933 01" />
                    </Field>
                    <Field label="What you shipped">
                      <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="5 L in two sealed tins, GC-MS sheet inside, packing video recorded." />
                    </Field>
                    <Field label="Proof link" hint="Packing photos, the lab sheet, or the courier receipt.">
                      <input className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
                    </Field>
                    <Action full trailing={busy ? <Spinner /> : <Ship size={13} />} disabled={!!busy || !tracking || !note} onClick={() => act('File shipment', () => shipForDeal(deal, { trackingNumber: tracking, note, link: link || undefined }))}>
                      File the shipment proof
                    </Action>
                  </>
                )}

                {isBuyer && deal.status === 'shipped' && (
                  <>
                    <Field label="Inspection note">
                      <textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Two tins arrived sealed. Aroma and colour match the sample." />
                    </Field>
                    <Action full trailing={busy ? <Spinner /> : <ArrowRight size={13} />} disabled={!!busy} onClick={() => act('Confirm delivery', () => approveForDeal(deal, note))}>
                      Confirm the goods arrived
                    </Action>
                    <Field label="Or state what went wrong">
                      <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Only 3 of 5 L arrived; one tin leaked." />
                    </Field>
                    <Action variant="ghost" full disabled={!!busy || !reason} onClick={() => act('Open dispute', () => disputeForDeal(deal, { uid: user!.uid, role: 'buyer', wallet: deal.buyerWallet }, reason))}>
                      Open a dispute
                    </Action>
                  </>
                )}

                {isBuyer && deal.status === 'approved' && (
                  <Action full trailing={busy ? <Spinner /> : <ArrowRight size={13} />} disabled={!!busy} onClick={() => act('Release funds', () => releaseForDeal(deal))}>
                    Release {usdc(deal.amount)} to {deal.sellerName}
                  </Action>
                )}

                {isSeller && deal.status === 'shipped' && (
                  <>
                    <Notice tone="info">Shipment filed. The buyer confirms on arrival, and the escrow releases to your wallet.</Notice>
                    <Field label="Dispute the buyer's silence">
                      <input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Delivered 12 days ago, buyer has not responded." />
                    </Field>
                    <Action variant="ghost" full disabled={!!busy || !reason} onClick={() => act('Open dispute', () => disputeForDeal(deal, { uid: user!.uid, role: 'seller', wallet: deal.sellerWallet }, reason))}>
                      Open a dispute
                    </Action>
                  </>
                )}

                {deal.status === 'disputed' && (
                  <Notice tone="info">
                    The arbiter {shortAddress(deal.arbiterWallet)} now reads the contract and every piece of
                    evidence below, then splits the locked {usdc(deal.amount)} with written reasoning.
                  </Notice>
                )}

                {(deal.status === 'released' || deal.status === 'resolved') && (
                  <div className="flex items-center gap-3 rounded-2xl bg-sage/10 px-4 py-4 text-sage-deep">
                    <Shield size={18} />
                    <span className="text-[13px]">
                      {deal.status === 'released' ? 'Paid out. The trade closed clean.' : 'Closed by the arbiter.'}
                    </span>
                  </div>
                )}

                {profile && !profile.walletAddress && (
                  <Notice tone="error">Link a Stellar wallet on your account before signing anything.</Notice>
                )}
              </div>

              {error && <div className="mt-5"><Notice tone="error">{error}</Notice></div>}

              <button
                onClick={() => act('Sync', () => syncFromChain(deal).then(() => undefined))}
                className="mt-6 self-start text-[11px] text-ink-mute transition-colors duration-500 ease-fluid hover:text-ink"
              >
                Re-read state from the chain
              </button>
            </div>
          </Shell>
        </div>
      </div>

      <section className="mt-4">
        <Shell>
          <div className="p-7">
            <Eyebrow>Evidence trail</Eyebrow>
            {deal.evidence.length === 0 ? (
              <p className="mt-6 text-[13px] text-ink-mute">
                Nothing filed yet. Every shipment proof, inspection note and dispute statement lands here,
                time-stamped, visible to both sides and to the arbiter.
              </p>
            ) : (
              <ol className="mt-6 space-y-5">
                {[...deal.evidence].sort((a, b) => a.at - b.at).map((item, i) => (
                  <li key={`${item.at}-${i}`} className="flex gap-4">
                    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-ink-soft">
                      {item.kind === 'shipment' ? <Ship size={14} /> : item.kind === 'dispute' ? <Scale size={14} /> : <Clock size={14} />}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.kind === 'dispute' ? 'bad' : 'neutral'}>{item.byRole}</Badge>
                        <span className="text-[11px] text-ink-mute">{shortDate(item.at)}</span>
                        {item.trackingNumber && <span className="font-mono text-[11px] text-ink-soft">{item.trackingNumber}</span>}
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{item.note}</p>
                      {item.link && (
                        <a href={item.link} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] text-spice underline underline-offset-4">
                          Open the attached proof
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Shell>
      </section>
    </main>
  );
}

function Stepper({ index, status }: { index: number; status: DealStatus }) {
  const broken = status === 'disputed' || status === 'resolved';
  return (
    <div className="flex flex-wrap gap-2">
      {STEPS.map((step, i) => {
        const done = i < index || status === 'released' || status === 'resolved';
        const current = i === index && !broken;
        return (
          <div
            key={step.key}
            className={`flex-1 rounded-2xl px-4 py-3 ring-1 transition-all duration-700 ease-fluid
              ${current ? 'bg-ink text-paper ring-ink' : done ? 'bg-sage/10 text-sage-deep ring-sage/20' : 'bg-paper-deep/50 text-ink-mute ring-ink/[0.05]'}`}
            style={{ minWidth: 132 }}
          >
            <div className="text-[10px] uppercase tracking-[0.16em] opacity-70">{step.who}</div>
            <div className="mt-1 text-[12px] font-medium">{step.label}</div>
          </div>
        );
      })}
      {broken && (
        <div className="flex-1 rounded-2xl bg-spice/10 px-4 py-3 text-spice-deep ring-1 ring-spice/20" style={{ minWidth: 132 }}>
          <div className="text-[10px] uppercase tracking-[0.16em] opacity-70">Arbiter</div>
          <div className="mt-1 text-[12px] font-medium">{status === 'resolved' ? 'Ruling delivered' : 'Reviewing evidence'}</div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: DealStatus }) {
  const tone = status === 'released' || status === 'resolved' ? 'good' : status === 'disputed' ? 'bad' : 'neutral';
  return <Badge tone={tone}>{status}</Badge>;
}

function Term({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink/[0.05] pb-3 last:border-0">
      <dt className="text-ink-mute">{label}</dt>
      <dd className={`max-w-[60%] text-right text-ink-soft ${mono ? 'font-mono text-[12px]' : ''}`}>{value}</dd>
    </div>
  );
}
