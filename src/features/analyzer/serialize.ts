/**
 * Bridges the `analyses` table and the typed strategy models.
 *
 * The table keeps the figures every strategy shares in real columns (arv,
 * repairs, mao_pct, purchase, target_profit) so they can be queried and
 * indexed, and the strategy-specific rest in an `inputs` JSONB blob. That blob
 * is untrusted at read time - it may predate a field, or have been written by
 * an older build - so every read goes through a defaulted accessor rather than
 * a cast. A missing field becomes its default, never `undefined` leaking into
 * arithmetic as NaN.
 */
import {
  DEFAULT_MAO_PCT,
  defaultLoan,
  emptyHolding,
  emptyTransaction,
  type AnalysisStrategy,
  type BrrrrInputs,
  type FlipInputs,
  type HoldingCosts,
  type Loan,
  type TransactionCosts,
  type TurnkeyInputs,
  type WholesaleInputs,
} from '@/domain/analyzer';
import type { Analysis, DefaultTerms } from '@/domain/types';
import type { Json } from '@/lib/database.types';

/** Seed values pulled from the deal and org so a fresh analysis is not blank. */
export type AnalysisSeed = {
  arv: number;
  repairs: number;
  purchase: number;
  terms: DefaultTerms;
};

function asRecord(value: Json | null | undefined): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Reads a finite number, falling back when the value is missing or unusable. */
function num(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function str<T extends string>(
  source: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = source[key];
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** A column value, falling back when the column is null. */
function col(value: number | null | undefined, fallback: number): number {
  return value == null || !Number.isFinite(value) ? fallback : value;
}

// ---------------------------------------------------------------------------
// Loans, holding, transaction
// ---------------------------------------------------------------------------

const LOAN_BASES = ['purchase', 'repairs', 'purchase_plus_repairs', 'custom'] as const;
const LOAN_TYPES = ['interest_only', 'amortized'] as const;

function readLoan(raw: unknown): Loan {
  const source = asRecord(raw as Json);
  return {
    base: str(source, 'base', LOAN_BASES, defaultLoan.base),
    customBase: num(source, 'customBase', defaultLoan.customBase),
    downPct: num(source, 'downPct', defaultLoan.downPct),
    type: str(source, 'type', LOAN_TYPES, defaultLoan.type),
    ratePct: num(source, 'ratePct', defaultLoan.ratePct),
    pointsPct: num(source, 'pointsPct', defaultLoan.pointsPct),
    lenderFees: num(source, 'lenderFees', defaultLoan.lenderFees),
    amortYears: num(source, 'amortYears', defaultLoan.amortYears),
  };
}

function readLoans(source: Record<string, unknown>): Loan[] {
  const raw = source.loans;
  if (!Array.isArray(raw) || raw.length === 0) return [{ ...defaultLoan }];
  return raw.map(readLoan);
}

function readHolding(source: Record<string, unknown>): HoldingCosts {
  const holding = asRecord(source.holding as Json);
  return {
    taxes: num(holding, 'taxes', emptyHolding.taxes),
    insurance: num(holding, 'insurance', emptyHolding.insurance),
    utilities: num(holding, 'utilities', emptyHolding.utilities),
    hoa: num(holding, 'hoa', emptyHolding.hoa),
    other: num(holding, 'other', emptyHolding.other),
    months: num(holding, 'months', 6),
  };
}

function readTransaction(source: Record<string, unknown>): TransactionCosts {
  const txn = asRecord(source.txn as Json);
  return {
    agentPct: num(txn, 'agentPct', 0.06),
    transferPct: num(txn, 'transferPct', 0.01),
    buyingFlat: num(txn, 'buyingFlat', emptyTransaction.buyingFlat),
    sellingFlat: num(txn, 'sellingFlat', emptyTransaction.sellingFlat),
    buyerCredits: num(txn, 'buyerCredits', emptyTransaction.buyerCredits),
  };
}

// ---------------------------------------------------------------------------
// Per-strategy readers
// ---------------------------------------------------------------------------

export function readWholesaleInputs(
  analysis: Analysis | null,
  seed: AnalysisSeed,
): WholesaleInputs {
  const source = asRecord(analysis?.inputs);
  return {
    arv: col(analysis?.arv, seed.arv),
    repairs: col(analysis?.repairs, seed.repairs),
    maoPct: col(analysis?.mao_pct, seed.terms.maoPct ?? DEFAULT_MAO_PCT),
    assignmentFee: num(source, 'assignmentFee', seed.terms.assignmentFee ?? 10000),
    negotiationBuffer: num(
      source,
      'negotiationBuffer',
      seed.terms.negotiationBuffer ?? 0.05,
    ),
  };
}

export function readFlipInputs(analysis: Analysis | null, seed: AnalysisSeed): FlipInputs {
  const source = asRecord(analysis?.inputs);
  return {
    arv: col(analysis?.arv, seed.arv),
    repairs: col(analysis?.repairs, seed.repairs),
    purchase: col(analysis?.purchase, seed.purchase),
    targetProfit: col(analysis?.target_profit, 50000),
    loans: readLoans(source),
    holding: readHolding(source),
    transaction: readTransaction(source),
    mode: str(source, 'mode', ['profit', 'max_offer'] as const, 'max_offer'),
  };
}

export function readBrrrrInputs(analysis: Analysis | null, seed: AnalysisSeed): BrrrrInputs {
  const source = asRecord(analysis?.inputs);
  return {
    arv: col(analysis?.arv, seed.arv),
    repairs: col(analysis?.repairs, seed.repairs),
    maoPct: col(analysis?.mao_pct, seed.terms.maoPct ?? DEFAULT_MAO_PCT),
    purchase: col(analysis?.purchase, seed.purchase),
    closingPct: num(source, 'closingPct', 0.03),
    ltvPct: num(source, 'ltvPct', 0.75),
    refiRatePct: num(source, 'refiRatePct', 0.07),
    refiTermYears: num(source, 'refiTermYears', 30),
    monthlyRent: num(source, 'monthlyRent', 0),
    expensePct: num(source, 'expensePct', 0.4),
  };
}

export function readTurnkeyInputs(
  analysis: Analysis | null,
  seed: AnalysisSeed,
): TurnkeyInputs {
  const source = asRecord(analysis?.inputs);
  return {
    purchase: col(analysis?.purchase, seed.purchase),
    repairs: col(analysis?.repairs, seed.repairs),
    monthlyRent: num(source, 'monthlyRent', 0),
    expensePct: num(source, 'expensePct', 0.35),
    capRate: num(source, 'capRate', 0.07),
    sellingCostPct: num(source, 'sellingCostPct', 0.06),
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/**
 * Splits a strategy's inputs into the shared columns and the JSONB remainder,
 * and stores the computed outputs alongside. PRD 7.6: "Each analysis is saved
 * per deal, snapshotting inputs + computed outputs" - so a pitch generated last
 * month still shows the numbers it was generated from.
 */
export function toAnalysisRow(
  strategy: AnalysisStrategy,
  inputs: WholesaleInputs | FlipInputs | BrrrrInputs | TurnkeyInputs,
  computed: Record<string, unknown>,
): {
  strategy: AnalysisStrategy;
  arv: number | null;
  repairs: number | null;
  mao_pct: number | null;
  purchase: number | null;
  target_profit: number | null;
  inputs: Json;
  computed: Json;
} {
  const any = inputs as Partial<FlipInputs & WholesaleInputs & BrrrrInputs & TurnkeyInputs>;

  return {
    strategy,
    arv: any.arv ?? null,
    repairs: any.repairs ?? null,
    mao_pct: any.maoPct ?? null,
    purchase: any.purchase ?? null,
    target_profit: any.targetProfit ?? null,
    // The whole input set is written, shared columns included. The duplication
    // is deliberate: the columns are for querying, the blob is the exact record
    // of what produced `computed`.
    inputs: JSON.parse(JSON.stringify(inputs)) as Json,
    computed: JSON.parse(JSON.stringify(computed)) as Json,
  };
}
