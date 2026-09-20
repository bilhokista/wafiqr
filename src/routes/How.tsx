// The trust explainer. This is the page that answers "why not just wire the money?"
import { Link } from 'react-router-dom';
import { Action, Eyebrow, Reveal, Shell } from '../ui/kit';
import { ArrowUpRight, Scale, Shield, Ship, Wallet } from '../ui/icons';

const STAGES = [
  {
    icon: <Scale size={18} />,
    title: 'The terms are written before the money',
    body: 'Quantity, grade, Incoterm, ship-by date and the arbiter both sides accept are fixed in the deal room. That text is stored inside the escrow contract on Stellar, so it cannot be quietly rewritten later.',
    who: 'Buyer and seller',
  },
  {
    icon: <Wallet size={18} />,
    title: 'The buyer locks USDC, not trust',
    body: 'Funding moves the money out of the buyer’s wallet and into a contract neither party controls alone. The seller can see it is there before spending a rupiah on packing.',
    who: 'Buyer',
  },
  {
    icon: <Ship size={18} />,
    title: 'The seller files proof, not a promise',
    body: 'Tracking number, packing evidence and any lab sheet are recorded against the milestone and time-stamped. Both sides read the same trail; so does the arbiter if it comes to that.',
    who: 'Seller',
  },
  {
    icon: <Shield size={18} />,
    title: 'Release, or a ruling on the evidence',
    body: 'If the goods match the contract, the buyer confirms and the funds release. If they do not, the arbiter reads the terms and the evidence, splits the balance, and writes down why.',
    who: 'Buyer, or the arbiter',
  },
];

export function How() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-20 md:px-8 md:py-32">
      <Reveal>
        <Eyebrow>How trust works here</Eyebrow>
        <h1 className="mt-6 max-w-2xl text-[clamp(2.25rem,5.5vw,4.25rem)] leading-[1]">
          A stranger abroad, and no one has to go first.
        </h1>
        <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Small producers lose exports to a single question: who pays before the other delivers.
          Advance payment exposes the buyer. Payment on arrival exposes the seller. wafiqr removes
          the question by putting the money somewhere neither side can take it from.
        </p>
      </Reveal>

      <div className="mt-24 space-y-4">
        {STAGES.map((stage, i) => (
          <Reveal key={stage.title} delay={i * 80}>
            <Shell>
              <div className="grid gap-6 p-8 md:grid-cols-12">
                <div className="md:col-span-1">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-spice/[0.08] text-spice">
                    {stage.icon}
                  </span>
                </div>
                <div className="md:col-span-8">
                  <h2 className="text-2xl leading-tight">{stage.title}</h2>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{stage.body}</p>
                </div>
                <div className="md:col-span-3 md:text-right">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">Signs this step</span>
                  <p className="mt-1 text-[13px] text-ink-soft">{stage.who}</p>
                  <p className="mt-4 font-mono text-[11px] text-ink-mute">step {i + 1} of 4</p>
                </div>
              </div>
            </Shell>
          </Reveal>
        ))}
      </div>

      <Reveal delay={120}>
        <section className="mt-24 grid gap-4 md:grid-cols-2">
          <Shell>
            <div className="p-8">
              <h3 className="text-xl">What the chain actually holds</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                A Trustless Work single-release escrow on Stellar, denominated in USDC, with five named
                roles: approver, service provider, release signer, dispute resolver and receiver. wafiqr
                writes the trade terms into the contract title, description and milestone, so the record
                reads as a trade, not a transfer.
              </p>
            </div>
          </Shell>
          <Shell>
            <div className="p-8">
              <h3 className="text-xl">What it does not do</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
                It does not inspect goods, clear customs, or guarantee quality. It holds the money and
                the evidence so a human arbiter can judge a dispute on a record both sides helped build.
                Running on Stellar testnet during the pilot.
              </p>
            </div>
          </Shell>
        </section>
      </Reveal>

      <Reveal delay={160}>
        <div className="mt-20 flex flex-wrap gap-3">
          <Link to="/"><Action trailing={<ArrowUpRight size={13} />}>See what is for sale</Action></Link>
          <Link to="/sell"><Action variant="ghost">List your own lot</Action></Link>
        </div>
      </Reveal>
    </main>
  );
}
