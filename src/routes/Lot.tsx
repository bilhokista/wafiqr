// A single lot, and the order form that turns it into a trade contract.
// Nothing here moves money: it settles the terms both sides will be held to.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createDeal, getListing } from '../lib/db';
import { seedById } from '../lib/seed';
import { useAuth } from '../lib/auth';
import { ARBITER_WALLET } from '../lib/config';
import type { Listing } from '../lib/types';
import { Action, Badge, Eyebrow, Field, Notice, Reveal, Shell, Spinner, shortAddress, usdc } from '../ui/kit';
import { ArrowUpRight, Clock, Scale, Shield } from '../ui/icons';

const DAY = 86400000;

export function Lot() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(0);
  const [shipDays, setShipDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    getListing(id)
      .then((found) => live && setListing(found ?? seedById(id)))
      .catch(() => live && setListing(seedById(id)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);

  useEffect(() => {
    if (listing) {
      setQuantity(listing.minOrder);
      setShipDays(listing.leadTimeDays);
    }
  }, [listing]);

  const total = useMemo(
    () => (listing ? Number((quantity * listing.pricePerUnit).toFixed(2)) : 0),
    [listing, quantity],
  );

  // Seeded lots are shelf dressing until real producers list. The market says
  // so in words; the order form enforces it so an example can never become a deal.
  const isDemo = listing?.id.startsWith('seed-') ?? false;

  async function startDeal() {
    if (!listing) return;
    if (listing.id.startsWith('seed-')) {
      setError('This is an example lot — ordering opens once real producers list.');
      return;
    }
    if (!user || !profile) {
      navigate('/signin', { state: { next: `/lot/${id}` } });
      return;
    }
    if (!profile.walletAddress) {
      setError('Link a Stellar wallet on your account first — the escrow pays out to it.');
      return;
    }
    if (quantity < listing.minOrder) {
      setError(`This seller ships from ${listing.minOrder} ${listing.unit} upward.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const dealId = await createDeal({
        listingId: listing.id,
        listingTitle: listing.title,
        imageUrl: listing.imageUrl,
        buyerUid: user.uid,
        buyerName: profile.displayName,
        buyerWallet: profile.walletAddress,
        sellerUid: listing.sellerUid,
        sellerName: listing.sellerName,
        sellerWallet: listing.sellerWallet,
        arbiterWallet: ARBITER_WALLET,
        quantity,
        unit: listing.unit,
        pricePerUnit: listing.pricePerUnit,
        amount: total,
        incoterm: listing.incoterm,
        specs: listing.specs,
        shipBy: Date.now() + shipDays * DAY,
        status: 'draft',
        contractId: '',
        evidence: [],
      });
      navigate(`/deal/${dealId}`);
    } catch (e) {
      setError(`Could not open the deal room: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-32 text-ink-mute md:px-8"><Spinner /> Loading lot…</div>;
  }

  if (!listing) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-32 md:px-8">
        <h1 className="text-4xl">That lot is gone.</h1>
        <p className="mt-4 text-ink-soft">It may have sold or been withdrawn by the producer.</p>
        <Link to="/" className="mt-8 inline-block"><Action variant="ghost">Back to the market</Action></Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-28">
      <Link to="/" className="text-[12px] text-ink-mute transition-colors duration-500 ease-fluid hover:text-ink">
        ← Market
      </Link>

      <div className="mt-8 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-7">
          <Reveal>
            <Shell>
              <div className="overflow-hidden rounded-core bg-paper-sunk" style={{ aspectRatio: '4 / 3' }}>
                {listing.imageUrl ? (
                  <img src={listing.imageUrl} alt={listing.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-6xl opacity-30">🫙</div>
                )}
              </div>
            </Shell>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 flex flex-wrap items-center gap-2">
              <Badge>{listing.category}</Badge>
              <Badge tone="good">{listing.incoterm}</Badge>
              <Badge tone="warn">min {listing.minOrder} {listing.unit}</Badge>
            </div>
            <h1 className="mt-5 text-[clamp(2.25rem,5vw,3.75rem)] leading-[1]">{listing.title}</h1>
            <p className="mt-3 text-[13px] text-ink-mute">
              {listing.sellerName} · {listing.sellerVillage} · origin {listing.origin}
            </p>
            <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-ink-soft">{listing.description}</p>

            <div className="mt-10 grid gap-3 sm:grid-cols-2">
              <Spec icon={<Scale size={16} />} label="Specification" value={listing.specs} />
              <Spec icon={<Clock size={16} />} label="Lead time" value={`${listing.leadTimeDays} days from order`} />
              <Spec icon={<Shield size={16} />} label="Arbiter on dispute" value={shortAddress(ARBITER_WALLET)} />
              <Spec icon={<Scale size={16} />} label="Seller payout wallet" value={shortAddress(listing.sellerWallet)} />
            </div>
          </Reveal>
        </div>

        <aside className="md:col-span-5">
          <Reveal delay={140}>
            <div className="md:sticky md:top-28">
              <Shell>
                <div className="p-7">
                  <Eyebrow>Trade contract</Eyebrow>
                  <h2 className="mt-4 text-2xl leading-tight">Agree the terms first.</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                    These terms are written into the escrow itself. Neither side can change them
                    once the buyer funds it.
                  </p>

                  <div className="mt-7 space-y-4">
                    <Field label={`Quantity (${listing.unit})`} hint={`Minimum ${listing.minOrder} ${listing.unit}`}>
                      <input
                        className="field font-mono"
                        type="number"
                        min={listing.minOrder}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                      />
                    </Field>
                    <Field label="Ship by" hint={`${new Date(Date.now() + shipDays * DAY).toDateString()} — the deadline the seller accepts.`}>
                      <input
                        className="field"
                        type="range"
                        min={7}
                        max={90}
                        value={shipDays}
                        onChange={(e) => setShipDays(Number(e.target.value))}
                      />
                    </Field>
                  </div>

                  <dl className="mt-7 space-y-2 border-t border-ink/[0.07] pt-6 text-[13px]">
                    <Row label="Unit price" value={usdc(listing.pricePerUnit)} />
                    <Row label="Incoterm" value={listing.incoterm} />
                    <Row label="Escrow holds" value={usdc(total)} strong />
                  </dl>

                  {isDemo && (
                    <div className="mt-5">
                      <Notice tone="info">Example lot for demo. Ordering opens once real producers list.</Notice>
                    </div>
                  )}
                  {error && <div className="mt-5"><Notice tone="error">{error}</Notice></div>}

                  <div className="mt-7">
                    <Action full trailing={busy ? <Spinner /> : <ArrowUpRight size={13} />} disabled={busy || isDemo} onClick={startDeal}>
                      {busy ? 'Opening deal room' : isDemo ? 'Example — not orderable' : 'Open the deal room'}
                    </Action>
                  </div>
                  <p className="mt-4 text-[11px] leading-relaxed text-ink-mute">
                    Nothing is paid yet. The next screen shows the full contract, and funding is a
                    separate, deliberate step.
                  </p>
                </div>
              </Shell>
            </div>
          </Reveal>
        </aside>
      </div>
    </main>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper-deep/50 p-5 ring-1 ring-ink/[0.05]">
      <div className="flex items-center gap-2 text-ink-mute">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{value}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-ink-mute">{label}</dt>
      <dd className={strong ? 'font-mono text-base' : 'font-mono'}>{value}</dd>
    </div>
  );
}
