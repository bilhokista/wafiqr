// wafiqr escrow widget — the embeddable piece a seller drops into their own page.
// One deal: buyer funds USDC into a Trustless Work single-release escrow; funds
// release when the buyer confirms the goods arrived, or an arbiter resolves a dispute.
import { useState } from 'react';
import { connectWallet } from './lib/wallet';
import { addUsdcTrustline, buyUsdcWithXlm } from './lib/trustline';
import {
  deploySingleRelease,
  fundEscrow,
  approveMilestone,
  releaseFunds,
  disputeEscrow,
  resolveDispute,
  USDC_TESTNET_ISSUER,
  type DeployBody,
} from './lib/trustlessWork';

type Stage = 'draft' | 'deployed' | 'funded' | 'shipped' | 'approved' | 'released' | 'disputed' | 'resolved';

export interface DealConfig {
  title: string;
  description: string;
  amount: number; // USDC
  seller: string; // Stellar address, receives funds
  arbiter: string; // Stellar address, resolves disputes
  platformAddress: string; // wafiqr fee address
}

export function WafiqrEscrow({ deal }: { deal: DealConfig }) {
  const [buyer, setBuyer] = useState('');
  const [contractId, setContractId] = useState('');
  const [stage, setStage] = useState<Stage>('draft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [trusted, setTrusted] = useState(false);

  async function act(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(`${label} failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const connect = () => act('Connect wallet', async () => setBuyer(await connectWallet()));

  const addTrustline = () =>
    act('Add USDC trustline', async () => {
      await addUsdcTrustline(buyer);
      setTrusted(true);
    });

  const getUsdc = () =>
    act('Get USDC', async () => {
      await buyUsdcWithXlm(buyer, deal.amount + 1);
    });

  const deploy = () =>
    act('Create escrow', async () => {
      const body: DeployBody = {
        signer: buyer,
        engagementId: `wafiqr-${Date.now()}`,
        title: deal.title,
        description: deal.description,
        amount: deal.amount,
        platformFee: 0,
        // Single-wallet integration demo: every role is the connected wallet, so only
        // one testnet account needs a USDC trustline. Swap in real seller/arbiter/
        // platform accounts (each with a USDC trustline) for a realistic multi-party demo.
        roles: {
          approver: buyer,
          serviceProvider: buyer,
          releaseSigner: buyer,
          platformAddress: buyer,
          disputeResolver: buyer,
          receiver: buyer,
        },
        milestones: [{ description: 'Goods delivered and received' }],
        trustline: { address: USDC_TESTNET_ISSUER, symbol: 'USDC' },
      };
      const res = await deploySingleRelease(body);
      setContractId(res.contractId ?? res.escrow?.contractId ?? '');
      setStage('deployed');
    });

  const fund = () =>
    act('Fund escrow', async () => {
      await fundEscrow({ contractId, signer: buyer, amount: deal.amount });
      setStage('funded');
    });

  const approve = () =>
    act('Confirm delivery', async () => {
      await approveMilestone({ contractId, approver: buyer, milestoneIndex: '0' });
      setStage('approved');
    });

  const release = () =>
    act('Release funds', async () => {
      await releaseFunds({ contractId, releaseSigner: buyer });
      setStage('released');
    });

  const dispute = () =>
    act('Open dispute', async () => {
      await disputeEscrow({ contractId, disputeResolver: buyer });
      setStage('disputed');
    });

  const resolve = () =>
    act('Resolve dispute', async () => {
      // Demo: arbiter refunds the buyer in full. distributions sum the escrow funds.
      await resolveDispute({ contractId, disputeResolver: buyer, distributions: [[buyer, deal.amount]] });
      setStage('resolved');
    });

  return (
    <div style={box}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{deal.title}</div>
      <div style={{ color: '#666', fontSize: 13, marginBottom: 10 }}>{deal.description}</div>
      <div style={row}><span>Amount</span><b>{deal.amount} USDC</b></div>
      <div style={row}><span>Escrow</span><span style={mono}>{contractId ? short(contractId) : '—'}</span></div>
      <div style={{ ...row, marginBottom: 12 }}><span>Status</span><b style={{ color: statusColor(stage) }}>{stage}</b></div>

      {!buyer ? (
        <button style={btn} disabled={busy} onClick={connect}>Connect wallet to buy</button>
      ) : (
        <>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Buyer: {short(buyer)}</div>
          {stage === 'draft' && !trusted && (
            <button style={btnGhost} disabled={busy} onClick={addTrustline}>Add USDC trustline (one-time)</button>
          )}
          {(stage === 'draft' || stage === 'deployed') && (
            <button style={btnGhost} disabled={busy} onClick={getUsdc}>Get {deal.amount} USDC (swap from XLM)</button>
          )}
          {stage === 'draft' && <button style={btn} disabled={busy} onClick={deploy}>Create escrow</button>}
          {stage === 'deployed' && <button style={btn} disabled={busy} onClick={fund}>Fund {deal.amount} USDC</button>}
          {stage === 'funded' && (
            <div style={{ fontSize: 13, color: '#666' }}>
              Funds locked. Seller ships and submits proof, then:
              <button style={{ ...btn, marginTop: 8 }} disabled={busy} onClick={() => setStage('shipped')}>Mark shipped (seller)</button>
            </div>
          )}
          {stage === 'shipped' && (
            <>
              <button style={btn} disabled={busy} onClick={approve}>Confirm goods received</button>
              <button style={btnGhost} disabled={busy} onClick={dispute}>Open dispute</button>
            </>
          )}
          {stage === 'approved' && <button style={btn} disabled={busy} onClick={release}>Release to seller</button>}
          {stage === 'disputed' && <button style={btn} disabled={busy} onClick={resolve}>Arbiter: resolve</button>}
          {stage === 'released' && <div style={done}>✓ Paid to seller. Trade complete.</div>}
          {stage === 'resolved' && <div style={done}>✓ Dispute resolved by arbiter.</div>}
        </>
      )}
      {error && <div style={{ color: '#c0392b', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

const short = (a: string) => (a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-5)}` : a);
const statusColor = (s: Stage) => (s === 'released' || s === 'resolved' ? '#27ae60' : s === 'disputed' ? '#c0392b' : '#2c3e50');
const box: React.CSSProperties = { border: '1px solid #e2e2e2', borderRadius: 12, padding: 18, maxWidth: 360, fontFamily: 'system-ui, sans-serif', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: '#444' };
const mono: React.CSSProperties = { fontFamily: 'monospace', fontSize: 12 };
const btn: React.CSSProperties = { width: '100%', padding: '10px 12px', border: 'none', borderRadius: 8, background: '#2c3e50', color: '#fff', fontWeight: 600, cursor: 'pointer', marginTop: 6 };
const btnGhost: React.CSSProperties = { ...btn, background: '#fff', color: '#c0392b', border: '1px solid #e2e2e2' };
const done: React.CSSProperties = { color: '#27ae60', fontWeight: 600, fontSize: 14 };
