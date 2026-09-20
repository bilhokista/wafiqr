// The marketplace: an editorial split hero over an asymmetric bento of listings.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listActiveListings } from '../lib/db';
import { SEED_LISTINGS } from '../lib/seed';
import type { Listing } from '../lib/types';
import { Action, Badge, Eyebrow, Reveal, Shell, usdc } from '../ui/kit';
import { ArrowUpRight, Leaf, Scale, Ship } from '../ui/icons';

const CATEGORIES = ['all', 'spice', 'coffee', 'craft', 'textile'] as const;

export function Market() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    listActiveListings(category === 'all' ? undefined : category)
      // An empty or unreachable catalog still shows the seeded demo goods, so the
      // marketplace is never a blank page during a pitch.
      .then((rows) => live && setListings(rows.length ? rows : filterSeed(category)))
      .catch(() => live && setListings(filterSeed(category)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [category]);

  return (
    <main>
      <section className="mx-auto max-w-6xl px-4 py-24 md:px-8 md:py-40">
        <div className="grid items-end gap-12 md:grid-cols-12">
          <div className="md:col-span-7">
            <Reveal>
              <Eyebrow>Cross-border trade · Stellar escrow</Eyebrow>
              <h1 className="mt-6 text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">
                The first export
                <br />
                without the fear
                <br />
                <span className="text-spice">of being cheated.</span>
              </h1>
            </Reveal>
          </div>
          <div className="md:col-span-5">
            <Reveal delay={120}>
              <p className="max-w-sm text-[15px] leading-relaxed text-ink-soft">
                A producer in a village lists one batch. A buyer anywhere funds it in USDC.
                The money waits in an on-chain escrow until the goods arrive — and if they
                do not, an arbiter both sides agreed on reads the evidence and decides.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Action
                  trailing={<ArrowUpRight size={13} />}
                  onClick={() => document.getElementById('catalog')?.scrollIntoView()}
                >
                  Browse the market
                </Action>
                <Link to="/sell">
                  <Action variant="ghost">List your goods</Action>
                </Link>
              </div>
            </Reveal>
          </div>
        </div>

        <div className="mt-28 grid gap-4 md:grid-cols-3">
          {PILLARS.map((card, i) => (
            <Reveal key={card.title} delay={i * 90}>
              <Shell className="h-full">
                <div className="flex h-full flex-col gap-4 p-7">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-spice/[0.08] text-spice">
                    {card.icon}
                  </span>
                  <h3 className="text-xl">{card.title}</h3>
                  <p className="text-[13px] leading-relaxed text-ink-soft">{card.body}</p>
                </div>
              </Shell>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="catalog" className="mx-auto max-w-6xl px-4 pb-32 md:px-8">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <Eyebrow>Open lots</Eyebrow>
            <h2 className="mt-4 text-[clamp(2rem,4vw,3rem)] leading-[1.05]">Goods waiting for a buyer</h2>
          </div>
          <div className="flex flex-wrap gap-1 rounded-full bg-ink/[0.04] p-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full px-4 py-2 text-[12px] capitalize transition-all duration-500 ease-fluid
                  ${category === c ? 'bg-paper text-ink shadow-ambient' : 'text-ink-mute hover:text-ink'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-72 animate-pulse rounded-squircle bg-paper-deep/60 md:col-span-4" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-12">
            {listings.map((listing, i) => (
              <div key={listing.id} className={i % 5 === 0 ? 'md:col-span-8' : 'md:col-span-4'}>
                <Reveal delay={(i % 3) * 80}>
                  <ListingCard listing={listing} wide={i % 5 === 0} />
                </Reveal>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const PILLARS = [
  {
    icon: <Scale size={18} />,
    title: 'Terms first, money second',
    body: 'Quantity, grade, Incoterm, ship-by date and the named arbiter are agreed and written into the contract before a single dollar moves.',
  },
  {
    icon: <Ship size={18} />,
    title: 'Proof, not promises',
    body: 'The seller files the waybill and packing evidence against the milestone. Both sides watch the same timeline.',
  },
  {
    icon: <Leaf size={18} />,
    title: 'No container minimum',
    body: 'A five-litre batch is a real export here. Small producers reach buyers that wholesalers never route to them.',
  },
];

function ListingCard({ listing, wide }: { listing: Listing; wide: boolean }) {
  return (
    <Link to={`/lot/${listing.id}`} className="group block">
      <Shell className="h-full transition-all duration-700 ease-fluid group-hover:shadow-lift">
        <div className={`flex h-full ${wide ? 'flex-col sm:flex-row' : 'flex-col'}`}>
          <div
            className={`relative overflow-hidden rounded-core bg-paper-sunk ${wide ? 'sm:w-1/2' : ''}`}
            style={{ aspectRatio: wide ? '4 / 3' : '5 / 4' }}
          >
            {listing.imageUrl ? (
              <img
                src={listing.imageUrl}
                alt={listing.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-[1200ms] ease-fluid group-hover:scale-[1.04]"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-4xl opacity-30">🫙</div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-3 p-6">
            <div className="flex items-center gap-2">
              <Badge>{listing.category}</Badge>
              <Badge tone="good">{listing.incoterm}</Badge>
            </div>
            <h3 className="text-[22px] leading-tight">{listing.title}</h3>
            <p className="text-[12px] text-ink-mute">
              {listing.origin} · min {listing.minOrder} {listing.unit} · ready in {listing.leadTimeDays} days
            </p>
            {wide && <p className="text-[13px] leading-relaxed text-ink-soft">{listing.description}</p>}
            <div className="mt-auto flex items-baseline justify-between pt-4">
              <span className="font-mono text-sm">
                {usdc(listing.pricePerUnit)}
                <span className="text-ink-mute"> / {listing.unit}</span>
              </span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.05]
                  transition-all duration-700 ease-fluid group-hover:translate-x-1
                  group-hover:-translate-y-px group-hover:bg-ink group-hover:text-paper"
              >
                <ArrowUpRight size={13} />
              </span>
            </div>
          </div>
        </div>
      </Shell>
    </Link>
  );
}

const filterSeed = (category: string) =>
  category === 'all' ? SEED_LISTINGS : SEED_LISTINGS.filter((l) => l.category === category);
