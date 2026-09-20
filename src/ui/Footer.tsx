import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer
      className="mx-auto max-w-6xl px-4 pb-16 pt-24 md:px-8"
      style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="flex flex-wrap items-end justify-between gap-8 border-t border-ink/[0.07] pt-10">
        <div>
          <div className="font-display text-2xl tracking-[-0.03em]">wafiqr</div>
          <p className="mt-3 max-w-xs text-[12px] leading-relaxed text-ink-mute">
            Trade trust for producers who sell across a border for the first time.
            Escrow on Stellar via Trustless Work. Testnet pilot.
          </p>
        </div>
        <nav className="flex flex-wrap gap-6 text-[12px] text-ink-mute">
          <Link to="/" className="transition-colors duration-500 ease-fluid hover:text-ink">Market</Link>
          <Link to="/how" className="transition-colors duration-500 ease-fluid hover:text-ink">How trust works</Link>
          <Link to="/sell" className="transition-colors duration-500 ease-fluid hover:text-ink">Sell</Link>
          <a
            href="https://github.com/bilhokista/wafiqr"
            target="_blank"
            rel="noreferrer"
            className="transition-colors duration-500 ease-fluid hover:text-ink"
          >
            Source
          </a>
        </nav>
      </div>
    </footer>
  );
}
