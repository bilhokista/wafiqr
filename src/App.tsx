// Demo host page: a small Indonesian exporter's own storefront, with the wafiqr
// escrow widget embedded — the way any seller would drop it into their site.
import { WafiqrEscrow, type DealConfig } from './WafiqrEscrow';

// Demo counterparties (replace with real testnet addresses to run end to end).
const deal: DealConfig = {
  title: 'Pure Nutmeg Essential Oil — 5 L',
  description: 'Banda Islands nutmeg oil, GC-MS report included. Ships DHL from Jakarta.',
  amount: 10,
  seller: 'GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO',
  arbiter: 'GBFRCU73YKD5NUWBL2SLSZHBAP6IH3MNWIKMUYOIZXGBIUP74WLTGGNJ', // arbiter account from scripts/e2e-testnet.mjs
  platformAddress: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
};

export function App() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 720, margin: '40px auto', padding: '0 20px', color: '#222' }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Rempah Nusantara</div>
        <div style={{ color: '#777' }}>Sari Wangi, Bogor · exporting since this changed everything</div>
      </header>

      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ height: 180, background: '#f1ede6', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8a', fontSize: 48 }}>🫙</div>
          <h2 style={{ marginBottom: 4 }}>{deal.title}</h2>
          <p style={{ color: '#555', lineHeight: 1.5 }}>
            A buyer anywhere can order a single batch — no marketplace, no container minimum. Their
            payment sits in an on-chain escrow and releases only once the goods arrive. If something
            goes wrong, an agreed arbiter decides on the evidence.
          </p>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <WafiqrEscrow deal={deal} />
          <div style={{ maxWidth: 360, fontSize: 12, color: '#999', marginTop: 10 }}>
            Powered by wafiqr · escrow on Stellar via Trustless Work · testnet demo
          </div>
        </div>
      </div>
    </div>
  );
}
