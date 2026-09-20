// Seller side: the producer's own lots, and the form that publishes a new one.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createListing, listSellerListings, setListingActive, uploadListingImage } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Incoterm, Listing } from '../lib/types';
import { Action, Badge, Eyebrow, Field, Notice, Reveal, Shell, Spinner, usdc } from '../ui/kit';
import { ArrowUpRight, Plus } from '../ui/icons';

const INCOTERMS: Incoterm[] = ['EXW', 'FOB', 'CIF', 'DDP'];
const CATEGORIES = ['spice', 'coffee', 'craft', 'textile'];

const emptyDraft = {
  title: '',
  origin: '',
  category: 'spice',
  unit: 'kg',
  minOrder: 10,
  pricePerUnit: 5,
  leadTimeDays: 14,
  incoterm: 'FOB' as Incoterm,
  specs: '',
  description: '',
  village: '',
};

export function Sell() {
  const { user, profile, loading: authLoading, linkWallet } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [posted, setPosted] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let live = true;
    listSellerListings(user.uid)
      .then((rows) => live && setListings(rows))
      .catch((e) => live && setError((e as Error).message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user, posted]);

  async function publish() {
    if (!user || !profile) return;
    if (!profile.walletAddress) {
      setError('Link a Stellar wallet first — buyers pay into an escrow that releases to it.');
      return;
    }
    if (!draft.title || !draft.specs) {
      setError('A buyer needs at minimum a title and a written specification.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const imageUrl = file ? await uploadListingImage(user.uid, file) : '';
      await createListing({
        sellerUid: user.uid,
        sellerName: profile.displayName,
        sellerVillage: draft.village || profile.country,
        sellerWallet: profile.walletAddress,
        title: draft.title,
        origin: draft.origin,
        category: draft.category,
        unit: draft.unit,
        minOrder: Number(draft.minOrder),
        pricePerUnit: Number(draft.pricePerUnit),
        leadTimeDays: Number(draft.leadTimeDays),
        incoterm: draft.incoterm,
        specs: draft.specs,
        description: draft.description,
        imageUrl,
        active: true,
      });
      setDraft(emptyDraft);
      setFile(null);
      setPosted(String(Date.now()));
    } catch (e) {
      setError(`Could not publish the lot: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) return <main className="mx-auto max-w-5xl px-4 py-32 md:px-8"><Spinner /></main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-32 md:px-8">
        <Eyebrow>For producers</Eyebrow>
        <h1 className="mt-5 text-[clamp(2.25rem,5vw,3.75rem)] leading-[1]">Sell a batch, not a container.</h1>
        <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-soft">
          Create an account, describe one lot honestly, and let a buyer abroad fund it into escrow.
          You get paid when the goods land, and the terms you agreed protect you as much as them.
        </p>
        <Link to="/signin" className="mt-8 inline-block">
          <Action trailing={<ArrowUpRight size={13} />}>Create a seller account</Action>
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-28">
      <Eyebrow>Seller desk</Eyebrow>
      <h1 className="mt-4 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">Your lots</h1>

      {!profile?.walletAddress && (
        <div className="mt-8">
          <Notice tone="error">
            No payout wallet linked yet.{' '}
            <button onClick={() => linkWallet().catch((e) => setError((e as Error).message))} className="underline underline-offset-4">
              Connect a Stellar wallet
            </button>
            .
          </Notice>
        </div>
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-12">
        <div className="md:col-span-7">
          <div className="space-y-3">
            {loading && <div className="h-24 animate-pulse rounded-squircle bg-paper-deep/60" />}
            {!loading && listings.length === 0 && (
              <Shell><div className="p-8 text-[14px] text-ink-soft">No lots published yet. The form beside this publishes your first one.</div></Shell>
            )}
            {listings.map((listing, i) => (
              <Reveal key={listing.id} delay={i * 60}>
                <Shell>
                  <div className="flex flex-wrap items-center gap-5 p-5">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-paper-sunk">
                      {listing.imageUrl && <img src={listing.imageUrl} alt="" className="h-full w-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg">{listing.title}</h2>
                      <p className="mt-1 text-[12px] text-ink-mute">
                        {usdc(listing.pricePerUnit)} / {listing.unit} · min {listing.minOrder} · {listing.incoterm}
                      </p>
                    </div>
                    <Badge tone={listing.active ? 'good' : 'neutral'}>{listing.active ? 'open' : 'withdrawn'}</Badge>
                    <button
                      onClick={async () => {
                        await setListingActive(listing.id, !listing.active);
                        setPosted(String(Date.now()));
                      }}
                      className="text-[11px] text-ink-mute transition-colors duration-500 ease-fluid hover:text-ink"
                    >
                      {listing.active ? 'Withdraw' : 'Reopen'}
                    </button>
                  </div>
                </Shell>
              </Reveal>
            ))}
          </div>
        </div>

        <div className="md:col-span-5">
          <Shell>
            <div className="p-7">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-spice/[0.08] text-spice"><Plus size={14} /></span>
                <h2 className="text-xl">Publish a lot</h2>
              </div>

              <div className="mt-6 space-y-4">
                <Field label="What you are selling">
                  <input className="field" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Korintji Cassia Bark — AA Grade" />
                </Field>
                <Field label="Origin">
                  <input className="field" value={draft.origin} onChange={(e) => setDraft({ ...draft, origin: e.target.value })} placeholder="Kerinci, Jambi" />
                </Field>
                <Field label="Your village or town">
                  <input className="field" value={draft.village} onChange={(e) => setDraft({ ...draft, village: e.target.value })} placeholder="Sungai Penuh" />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Category">
                    <select className="field" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Unit">
                    <input className="field" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="kg" />
                  </Field>
                  <Field label="Price per unit (USDC)">
                    <input className="field font-mono" type="number" min={0} step="0.01" value={draft.pricePerUnit} onChange={(e) => setDraft({ ...draft, pricePerUnit: Number(e.target.value) })} />
                  </Field>
                  <Field label="Minimum order">
                    <input className="field font-mono" type="number" min={1} value={draft.minOrder} onChange={(e) => setDraft({ ...draft, minOrder: Number(e.target.value) })} />
                  </Field>
                  <Field label="Lead time (days)">
                    <input className="field font-mono" type="number" min={1} value={draft.leadTimeDays} onChange={(e) => setDraft({ ...draft, leadTimeDays: Number(e.target.value) })} />
                  </Field>
                  <Field label="Incoterm">
                    <select className="field" value={draft.incoterm} onChange={(e) => setDraft({ ...draft, incoterm: e.target.value as Incoterm })}>
                      {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Specification" hint="The measurable facts an arbiter could check: grade, moisture, lab report, dimensions.">
                  <textarea className="field min-h-20" value={draft.specs} onChange={(e) => setDraft({ ...draft, specs: e.target.value })} />
                </Field>
                <Field label="The story of this lot">
                  <textarea className="field min-h-24" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </Field>
                <Field label="Photo">
                  <input className="field" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </Field>

                {error && <Notice tone="error">{error}</Notice>}
                {posted && !error && <Notice tone="info">Lot published. It is live in the market now.</Notice>}

                <Action full trailing={busy ? <Spinner /> : <ArrowUpRight size={13} />} disabled={busy} onClick={publish}>
                  {busy ? 'Publishing' : 'Publish this lot'}
                </Action>
              </div>
            </div>
          </Shell>
        </div>
      </div>
    </main>
  );
}
