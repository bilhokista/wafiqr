// Reads a transaction the Trustless Work API built before anyone signs it.
//
// Every escrow action arrives as unsigned XDR from a server wafiqr does not
// run. Freighter shows its user that XDR before signing; an embedded wallet
// would sign it blind. If that server were compromised or simply wrong — a
// different receiver, a bigger amount, an extra operation, a contract that is
// not an escrow — a blind signature would move the money, and the "wafiqr
// never controls funds" promise would quietly become "whoever controls the API
// does". So nothing is signed until the transaction has been decoded and
// matched, field by field, against what this app asked for.
//
// Pure: no network. The one check that needs the chain — which code the
// escrow contract runs — lives in escrowCode.ts.
import { Address, FeeBumpTransaction, TransactionBuilder, scValToNative, type Transaction } from '@stellar/stellar-sdk';

/** Soroban fees on these calls run 0.05–0.15 XLM. Anything near this is not a fee, it is a drain. */
export const MAX_FEE_STROOPS = 20_000_000; // 2 XLM

/** Who the escrow must name. Everything else in a transaction is checked against these. */
export interface DealParties {
  buyer: string;
  seller: string;
  arbiter: string;
  usdcContract: string;
}

export type TwIntent =
  | { kind: 'deploy'; signer: string; amount: number; parties: DealParties; wasmHash: string }
  | { kind: 'fund'; signer: string; contractId: string; amount: number; parties: DealParties }
  | { kind: 'approve'; signer: string; contractId: string }
  | { kind: 'status'; signer: string; contractId: string }
  | { kind: 'release'; signer: string; contractId: string }
  | { kind: 'dispute'; signer: string; contractId: string }
  | {
      kind: 'resolve';
      signer: string;
      contractId: string;
      distributions: { address: string; amount: number }[];
    };

const FUNCTION: Record<TwIntent['kind'], string> = {
  deploy: 'tw_new_single_release_escrow',
  fund: 'fund_escrow',
  approve: 'approve_milestone',
  status: 'change_milestone_status',
  release: 'release_funds',
  dispute: 'dispute_escrow',
  resolve: 'resolve_dispute',
};

export function toStroops(amount: number): bigint {
  return BigInt(Math.round(amount * 1e7));
}

interface EscrowStruct {
  amount?: bigint;
  platform_fee?: number | bigint;
  roles?: Record<string, string>;
  trustline?: { address?: string };
}

function isEscrowStruct(value: unknown): value is EscrowStruct {
  return typeof value === 'object' && value !== null && 'roles' in value && 'trustline' in value;
}

function hex(bytes: unknown): string {
  if (!(bytes instanceof Uint8Array)) return '';
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** What the escrow's own terms must say, wherever the transaction carries them. */
function escrowProblems(escrow: EscrowStruct, intent: { signer: string; parties: DealParties }, expectAmount?: bigint): string[] {
  const problems: string[] = [];
  const roles = escrow.roles ?? {};
  const { parties } = intent;

  if (roles.receiver !== parties.seller) problems.push(`the escrow pays ${roles.receiver ?? 'nobody'}, not the seller`);
  if (roles.service_provider !== parties.seller) problems.push('the escrow names a different seller');
  if (roles.dispute_resolver !== parties.arbiter) problems.push('the escrow names a different arbiter');
  if (roles.approver !== parties.buyer) problems.push('someone other than the buyer approves delivery');
  if (roles.release_signer !== parties.buyer) problems.push('someone other than the buyer releases the funds');
  if (escrow.trustline?.address !== parties.usdcContract) problems.push('the escrow holds a token that is not USDC');
  if (escrow.platform_fee !== undefined && Number(escrow.platform_fee) !== 0) {
    problems.push(`the escrow takes a platform fee of ${String(escrow.platform_fee)}`);
  }
  if (expectAmount !== undefined && escrow.amount !== expectAmount) {
    problems.push(`the escrow is for ${String(escrow.amount)} stroops, not ${String(expectAmount)}`);
  }
  return problems;
}

const STELLAR_ADDRESS = /^[GC][A-Z2-7]{55}$/;

/** A Map<Address, i128> argument, or empty for anything that is not one. */
function distributionEntries(value: unknown): [string, bigint][] {
  const entries: [unknown, unknown][] =
    value instanceof Map ? [...value.entries()] : typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.entries(value) : [];
  if (entries.length === 0) return [];
  const isDistribution = entries.every(([k, v]) => typeof k === 'string' && STELLAR_ADDRESS.test(k) && typeof v === 'bigint');
  return isDistribution ? (entries as [string, bigint][]) : [];
}

/**
 * Everything about `unsignedXdr` that does not match `intent`, as short
 * phrases. An empty list is the only answer that lets a signature happen.
 */
export function transactionProblems(unsignedXdr: string, passphrase: string, intent: TwIntent): string[] {
  let parsed: Transaction | FeeBumpTransaction;
  try {
    parsed = TransactionBuilder.fromXDR(unsignedXdr, passphrase);
  } catch (e) {
    return [`the transaction could not be read (${(e as Error).message})`];
  }
  if (parsed instanceof FeeBumpTransaction) return ['it is a fee-bump wrapper, which this app never asks for'];
  const tx = parsed;

  const problems: string[] = [];
  if (tx.source !== intent.signer) problems.push(`it is sent from ${tx.source}, not from your wallet`);
  if (Number(tx.fee) > MAX_FEE_STROOPS) problems.push(`its fee is ${Number(tx.fee) / 1e7} XLM`);
  if (tx.operations.length !== 1) return [...problems, `it has ${tx.operations.length} operations instead of one`];

  const op = tx.operations[0];
  if (op.type !== 'invokeHostFunction') return [...problems, `it is a ${op.type}, not an escrow call`];
  if (op.source && op.source !== intent.signer) problems.push('its operation runs as another account');

  // A source-account credential means the envelope signature is the whole
  // authorisation. Any other kind would be authority this screen did not ask for.
  for (const entry of op.auth ?? []) {
    const kind = (entry as unknown as { credentials?: { type?: string } }).credentials?.type;
    if (kind !== 'sorobanCredentialsSourceAccount') problems.push(`it carries a ${kind ?? 'strange'} authorisation`);
  }

  const func = op.func as unknown as {
    type?: string;
    invokeContract?: { contractAddress: unknown; functionName: unknown; args: unknown[] };
  };
  if (func.type !== 'hostFunctionTypeInvokeContract' || !func.invokeContract) {
    return [...problems, 'it does something other than call a contract'];
  }

  const call = func.invokeContract;
  const contract = Address.fromScAddress(call.contractAddress as Parameters<typeof Address.fromScAddress>[0]).toString();
  const fn = String(call.functionName);
  let args: unknown[];
  try {
    args = call.args.map((a) => scValToNative(a as Parameters<typeof scValToNative>[0]));
  } catch {
    return [...problems, 'its arguments could not be read'];
  }

  if (fn !== FUNCTION[intent.kind]) problems.push(`it calls ${fn}, not ${FUNCTION[intent.kind]}`);
  if (intent.kind !== 'deploy' && contract !== intent.contractId) {
    problems.push(`it calls contract ${contract}, not this deal's escrow`);
  }

  switch (intent.kind) {
    case 'deploy': {
      if (args[0] !== intent.signer) problems.push('the escrow would be created for another account');
      if (hex(args[1]) !== intent.wasmHash) problems.push('the escrow would run code this app has not checked');
      const init = Array.isArray(args[4]) ? args[4][0] : undefined;
      if (!isEscrowStruct(init)) problems.push('the escrow terms are missing');
      else problems.push(...escrowProblems(init, intent, toStroops(intent.amount)));
      break;
    }
    case 'fund': {
      if (args[0] !== intent.signer) problems.push('the funds would be drawn from another account');
      const amount = args[args.length - 1];
      if (typeof amount !== 'bigint' || amount !== toStroops(intent.amount)) {
        problems.push(`it moves ${String(amount)} stroops, not ${String(toStroops(intent.amount))}`);
      }
      const terms = args.find(isEscrowStruct);
      if (terms) problems.push(...escrowProblems(terms, intent));
      break;
    }
    case 'approve':
      if (!args.includes(intent.signer)) problems.push('it approves as someone else');
      break;
    case 'status':
      if (args[args.length - 1] !== intent.signer) problems.push('it files the shipment as someone else');
      break;
    case 'release':
    case 'dispute':
      if (args[0] !== intent.signer) problems.push('it acts as someone else');
      break;
    case 'resolve': {
      if (args[0] !== intent.signer) problems.push('it rules as someone other than the arbiter');
      const expected = new Map(intent.distributions.map((d) => [d.address, toStroops(d.amount)]));
      const actual = args.map(distributionEntries).find((e) => e.length > 0) ?? [];
      if (actual.length !== expected.size) problems.push('the split pays a different set of people');
      for (const [address, amount] of actual) {
        if (expected.get(address) !== amount) problems.push(`the split pays ${address} ${String(amount)} stroops`);
      }
      break;
    }
  }

  return problems;
}

/** Throws in words a person can act on when the transaction is not what was asked for. */
export function assertTransactionMatches(unsignedXdr: string, passphrase: string, intent: TwIntent) {
  const problems = transactionProblems(unsignedXdr, passphrase, intent);
  if (problems.length) {
    throw new Error(
      `Not signed. The escrow service returned a transaction that does not match this deal: ${problems.join('; ')}. Nothing was sent.`,
    );
  }
}
