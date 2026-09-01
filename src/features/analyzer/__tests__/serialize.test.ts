import { analyzeFlip, defaultLoan } from '@/domain/analyzer';
import type { Analysis } from '@/domain/types';

import {
  readBrrrrInputs,
  readFlipInputs,
  readTurnkeyInputs,
  readWholesaleInputs,
  toAnalysisRow,
  type AnalysisSeed,
} from '../serialize';

const seed: AnalysisSeed = {
  arv: 350000,
  repairs: 25000,
  purchase: 200000,
  terms: {},
};

const analysis = (over: Partial<Analysis> = {}): Analysis => ({
  id: 'a1',
  org_id: 'org-1',
  deal_id: 'deal-1',
  strategy: 'flip',
  arv: null,
  repairs: null,
  mao_pct: null,
  market: null,
  purchase: null,
  target_profit: null,
  inputs: {},
  computed: {},
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  deleted_at: null,
  ...over,
});

describe('reading a missing analysis', () => {
  it('seeds every strategy from the deal rather than starting blank', () => {
    expect(readFlipInputs(null, seed).arv).toBe(350000);
    expect(readFlipInputs(null, seed).repairs).toBe(25000);
    expect(readWholesaleInputs(null, seed).arv).toBe(350000);
    expect(readBrrrrInputs(null, seed).purchase).toBe(200000);
    expect(readTurnkeyInputs(null, seed).repairs).toBe(25000);
  });

  it('gives a flip one default loan, so the financing section is never empty', () => {
    expect(readFlipInputs(null, seed).loans).toEqual([{ ...defaultLoan }]);
  });

  it('takes org default terms when they are set', () => {
    const withTerms = {
      ...seed,
      terms: { maoPct: 0.65, assignmentFee: 15000, negotiationBuffer: 0.08 },
    };
    const wholesale = readWholesaleInputs(null, withTerms);
    expect(wholesale.maoPct).toBe(0.65);
    expect(wholesale.assignmentFee).toBe(15000);
    expect(wholesale.negotiationBuffer).toBe(0.08);
  });
});

describe('reading a stored analysis', () => {
  it('prefers stored columns over the seed', () => {
    const stored = analysis({ arv: 400000, repairs: 60000, purchase: 210000 });
    const inputs = readFlipInputs(stored, seed);
    expect(inputs.arv).toBe(400000);
    expect(inputs.repairs).toBe(60000);
    expect(inputs.purchase).toBe(210000);
  });

  it('restores loans, holding, and transaction costs from the blob', () => {
    const stored = analysis({
      inputs: {
        mode: 'profit',
        loans: [{ base: 'repairs', downPct: 0.1, type: 'amortized', ratePct: 0.09 }],
        holding: { taxes: 300, months: 8 },
        txn: { agentPct: 0.05, buyingFlat: 1200 },
      },
    });
    const inputs = readFlipInputs(stored, seed);

    expect(inputs.mode).toBe('profit');
    expect(inputs.loans).toHaveLength(1);
    expect(inputs.loans[0].base).toBe('repairs');
    expect(inputs.loans[0].ratePct).toBe(0.09);
    expect(inputs.holding.taxes).toBe(300);
    expect(inputs.holding.months).toBe(8);
    expect(inputs.transaction.agentPct).toBe(0.05);
  });

  it('fills fields the stored blob never had, rather than leaving them undefined', () => {
    // A blob written by an older build must not leak undefined into the math.
    const stored = analysis({ inputs: { loans: [{ base: 'purchase' }] } });
    const loan = readFlipInputs(stored, seed).loans[0];

    expect(loan.downPct).toBe(defaultLoan.downPct);
    expect(loan.pointsPct).toBe(defaultLoan.pointsPct);
    expect(loan.lenderFees).toBe(defaultLoan.lenderFees);
    expect(Object.values(loan).every((value) => value !== undefined)).toBe(true);
  });

  it('ignores a value of the wrong type instead of trusting it', () => {
    const stored = analysis({
      inputs: { mode: 'nonsense', loans: [{ base: 'not-a-base', downPct: 'lots' }] },
    });
    const inputs = readFlipInputs(stored, seed);

    expect(inputs.mode).toBe('max_offer');
    expect(inputs.loans[0].base).toBe('purchase');
    expect(inputs.loans[0].downPct).toBe(defaultLoan.downPct);
  });

  it('survives an inputs blob that is not an object at all', () => {
    const stored = analysis({ inputs: 'corrupted' });
    expect(() => readFlipInputs(stored, seed)).not.toThrow();
    expect(readFlipInputs(stored, seed).loans).toEqual([{ ...defaultLoan }]);
  });

  it('reads a number stored as a string', () => {
    const stored = analysis({ inputs: { holding: { months: '9' } } });
    expect(readFlipInputs(stored, seed).holding.months).toBe(9);
  });
});

describe('toAnalysisRow', () => {
  it('splits shared figures into columns and keeps the full input blob', () => {
    const inputs = readFlipInputs(null, { ...seed, arv: 357244, repairs: 25000 });
    const result = analyzeFlip(inputs);
    const row = toAnalysisRow('flip', inputs, { profit: result.profit });

    expect(row.strategy).toBe('flip');
    expect(row.arv).toBe(357244);
    expect(row.repairs).toBe(25000);
    expect(row.target_profit).toBe(50000);
    expect((row.inputs as Record<string, unknown>).loans).toBeDefined();
    expect((row.computed as Record<string, unknown>).profit).toBeDefined();
  });

  it('round-trips: a saved row reads back into the same inputs', () => {
    const original = readFlipInputs(null, seed);
    original.holding.months = 7;
    original.loans[0].ratePct = 0.115;

    const row = toAnalysisRow('flip', original, {});
    const restored = readFlipInputs(
      analysis({
        arv: row.arv,
        repairs: row.repairs,
        purchase: row.purchase,
        target_profit: row.target_profit,
        mao_pct: row.mao_pct,
        inputs: row.inputs,
      }),
      seed,
    );

    expect(restored).toEqual(original);
  });

  it('produces JSON-safe values', () => {
    const row = toAnalysisRow('flip', readFlipInputs(null, seed), {});
    expect(() => JSON.stringify(row)).not.toThrow();
  });
});
