// Evidence that the mechanism works, as opposed to a claim that it does.
//
// A product whose whole offer is trust cannot ask for trust on its own say-so.
// The usual fix at this stage is a testimonial or a transaction counter, and
// both are worth nothing here: the reader has no way to check either, and the
// first producer who discovers a number was invented is the last one who ever
// comes back.
//
// What we have instead is better and cost nothing to obtain. Two escrows ran
// on Stellar testnet — one settled, one disputed and split by the arbiter —
// and both are on a public ledger with contract ids anyone can open. A reader
// who does not believe us does not have to.
import { Eyebrow, Shell } from './kit';
import { ArrowUpRight } from './icons';

/**
 * The runs, verbatim from `scripts/e2e-testnet.mjs` on the date shown.
 *
 * Hard-coded on purpose. These are historical facts about two specific
 * transactions, not live figures, and dressing them up as a live counter would
 * be the exact move this component exists to avoid.
 */
const RUNS = [
  {
    path: 'Settled',
    contractId: 'CACDT5HM4SP3HNU6TXDJ3GHWMBDV5QU4HZ4NK5XA75MFH6CP3LHS2HNK',
    outcome: 'Buyer confirmed arrival. 9.97 USDC released to the seller.',
  },
  {
    path: 'Disputed',
    contractId: 'CDR54QT3GJLSJDI2SGT2BFVY4PQGJ6WYCJOD3HZOQ2XS3ARGWSCDJWWV',
    outcome: 'Arbiter read the evidence and split the 10 USDC: 7 buyer, 3 seller.',
  },
];

const RAN_ON = '20 September 2026';

export function Proof() {
  return (
    <section>
      <Eyebrow>Proof</Eyebrow>
      <h2 className="mt-4 text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.05]">
        Both outcomes, on a ledger you can open
      </h2>
      <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-ink-soft">
        Two escrows ran on Stellar testnet on {RAN_ON} — one where the goods arrived and one
        where the buyer disputed. Neither is a screenshot. The contract ids below go to a public
        explorer, so you can read what happened without taking our word for it.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {RUNS.map((run) => (
          <Shell key={run.contractId}>
            <div className="p-6">
              <div className="text-[12px] uppercase tracking-wide text-ink-mute">{run.path}</div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{run.outcome}</p>
              <a
                className="mt-4 inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-ink-mute transition-colors duration-500 ease-fluid hover:text-ink"
                href={`https://stellar.expert/explorer/testnet/contract/${run.contractId}`}
                target="_blank"
                rel="noreferrer"
              >
                {run.contractId}
                <ArrowUpRight size={11} />
              </a>
            </div>
          </Shell>
        ))}
      </div>

      <p className="mt-6 max-w-2xl text-[12px] leading-relaxed text-ink-mute">
        Testnet, and said plainly rather than buried: no real money has moved through wafiqr yet,
        and the lots on the market are examples until producers list their own. What the runs above
        establish is that the escrow holds, releases and splits correctly — which is the part a
        producer is being asked to rely on.
      </p>
    </section>
  );
}
