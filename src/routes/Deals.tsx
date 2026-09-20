// Both sides of the ledger for the signed-in account: what they are buying and selling.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDealsFor } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { Deal } from '../lib/types';
import { Action, Badge, Eyebrow, Reveal, Shell, Spinner, shortDate, usdc } from '../ui/kit';
import { ArrowUpRight } from '../ui/icons';

export function Deals() {
  const { user, loading: authLoading } = useAuth();
  const [side, setSide] = useState<'buyerUid' | 'sellerUid'>('buyerUid');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    listDealsFor(user.uid, side)
      .then((rows) => live && setDeals(rows))
      .catch((e) => live && setError((e as Error).message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [user, side]);

  if (authLoading) return <Centered><Spinner /> Checking your session…</Centered>;

  if (!user) {
    return (
      <Centered>
        <h1 className="text-4xl">Sign in to see your deals.</h1>
        <Link to="/signin" className="mt-8 inline-block"><Action trailing={<ArrowUpRight size={13} />}>Sign in</Action></Link>
      </Centered>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 md:px-8 md:py-28">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <Eyebrow>Ledger</Eyebrow>
          <h1 className="mt-4 text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.02]">My deals</h1>
        </div>
        <div className="flex gap-1 rounded-full bg-ink/[0.04] p-1">
          {([['buyerUid', 'Buying'], ['sellerUid', 'Selling']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSide(key)}
              className={`rounded-full px-5 py-2 text-[12px] transition-all duration-500 ease-fluid
                ${side === key ? 'bg-paper text-ink shadow-ambient' : 'text-ink-mute hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-8 text-[13px] text-spice-deep">{error}</p>}

      <div className="mt-10 space-y-3">
        {loading && <div className="h-24 animate-pulse rounded-squircle bg-paper-deep/60" />}
        {!loading && deals.length === 0 && (
          <Shell>
            <div className="p-10 text-center">
              <p className="text-[14px] text-ink-soft">
                {side === 'buyerUid' ? 'No purchases yet. The market is one click away.' : 'No orders yet. List a lot and buyers can find it.'}
              </p>
              <Link to={side === 'buyerUid' ? '/' : '/sell'} className="mt-6 inline-block">
                <Action variant="ghost">{side === 'buyerUid' ? 'Browse the market' : 'List a lot'}</Action>
              </Link>
            </div>
          </Shell>
        )}
        {deals.map((deal, i) => (
          <Reveal key={deal.id} delay={i * 60}>
            <Link to={`/deal/${deal.id}`} className="group block">
              <Shell className="transition-all duration-700 ease-fluid group-hover:shadow-lift">
                <div className="flex flex-wrap items-center gap-5 p-5">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-paper-sunk">
                    {deal.imageUrl && <img src={deal.imageUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg">{deal.listingTitle}</h2>
                    <p className="mt-1 text-[12px] text-ink-mute">
                      {deal.quantity} {deal.unit} · {side === 'buyerUid' ? `from ${deal.sellerName}` : `for ${deal.buyerName}`} · {shortDate(deal.createdAt)}
                    </p>
                  </div>
                  <Badge tone={deal.status === 'released' || deal.status === 'resolved' ? 'good' : deal.status === 'disputed' ? 'bad' : 'neutral'}>
                    {deal.status}
                  </Badge>
                  <span className="font-mono text-sm">{usdc(deal.amount)}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/[0.05]
                    transition-all duration-700 ease-fluid group-hover:translate-x-1 group-hover:-translate-y-px group-hover:bg-ink group-hover:text-paper">
                    <ArrowUpRight size={13} />
                  </span>
                </div>
              </Shell>
            </Link>
          </Reveal>
        ))}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-4 py-32 text-ink-soft md:px-8">{children}</main>;
}
