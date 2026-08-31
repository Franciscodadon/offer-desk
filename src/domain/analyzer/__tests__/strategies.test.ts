import { analyzeBrrrr, monthlyPayment } from '../brrrr';
import { amortizedInterest, analyzeFlip, interestOnlyInterest } from '../flip';
import { analyzeTurnkey } from '../turnkey';
import { defaultLoan, emptyHolding, emptyTransaction, type FlipInputs } from '../types';
import { VERDICT_THRESHOLDS, verdictFor } from '../verdict';
import { analyzeWholesale } from '../wholesale';

describe('analyzeWholesale', () => {
  const inputs = {
    arv: 300000,
    repairs: 40000,
    maoPct: 0.7,
    assignmentFee: 10000,
    negotiationBuffer: 0.1,
  };

  it('follows the appendix D chain', () => {
    const result = analyzeWholesale(inputs);
    // 300,000 x 0.7 - 40,000
    expect(result.buyerPrice).toBe(170000);
    // buyerPrice - assignment fee
    expect(result.mao).toBe(160000);
    // MAO x (1 - buffer), rounded
    expect(result.initialOffer).toBe(144000);
    expect(result.fee).toBe(10000);
  });

  it('keeps the fee equal to the spread it was defined from', () => {
    const result = analyzeWholesale(inputs);
    expect(result.fee).toBeCloseTo(result.buyerPrice - result.mao, 6);
  });

  it('rounds only the opening offer', () => {
    const result = analyzeWholesale({ ...inputs, arv: 300001, negotiationBuffer: 0.07 });
    expect(Number.isInteger(result.initialOffer)).toBe(true);
    // The MAO itself is left exact so downstream math does not inherit a rounding.
    expect(Number.isInteger(result.mao)).toBe(false);
  });

  it('can go negative when repairs swamp the ARV, rather than clamping to zero', () => {
    // A deal that does not work must look like it does not work.
    const result = analyzeWholesale({ ...inputs, repairs: 250000 });
    expect(result.buyerPrice).toBeLessThan(0);
  });
});

describe('interest calculations', () => {
  it('computes interest-only as loan x rate x months/12', () => {
    expect(interestOnlyInterest(178112.25, 0.125, 6)).toBeCloseTo(11132.02, 1);
  });

  it('returns zero interest for a zero-length hold', () => {
    expect(interestOnlyInterest(200000, 0.125, 0)).toBe(0);
  });

  it('accrues less on an amortizing loan than interest-only, since principal falls', () => {
    const principal = 200000;
    const io = interestOnlyInterest(principal, 0.08, 12);
    const amortized = amortizedInterest(principal, 0.08, 30, 12);
    expect(amortized).toBeLessThan(io);
    // Over one year of a 30-year note the difference is small but real.
    expect(amortized).toBeGreaterThan(io * 0.95);
  });

  it('handles a zero rate without dividing by zero', () => {
    expect(amortizedInterest(200000, 0, 30, 12)).toBe(0);
    expect(monthlyPayment(120000, 0, 10)).toBeCloseTo(1000, 6);
  });

  it('is linear in principal, which the max-offer solve depends on', () => {
    const single = amortizedInterest(100000, 0.09, 30, 8);
    const double = amortizedInterest(200000, 0.09, 30, 8);
    expect(double).toBeCloseTo(single * 2, 6);
  });
});

describe('analyzeFlip', () => {
  const base: FlipInputs = {
    arv: 400000,
    repairs: 50000,
    purchase: 250000,
    targetProfit: 60000,
    mode: 'profit',
    loans: [],
    holding: { ...emptyHolding, taxes: 300, insurance: 150, months: 6 },
    transaction: { ...emptyTransaction, agentPct: 0.06, buyingFlat: 2000, sellingFlat: 1500 },
  };

  it('computes profit for an all-cash purchase', () => {
    const result = analyzeFlip(base);
    // holding: (300 + 150) x 6 = 2,700
    expect(result.holding).toBe(2700);
    // selling: 400,000 x 6% + 1,500 = 25,500; buying: 2,000
    expect(result.transaction).toBe(27500);
    // 400,000 - 250,000 - 50,000 - 0 - 2,700 - 27,500
    expect(result.profit).toBe(69800);
    expect(result.financing).toBe(0);
  });

  it('requires the full purchase in cash when there is no loan', () => {
    const result = analyzeFlip(base);
    // No loans means no down payments, so cash needed excludes the purchase
    // itself by the appendix D definition; the caller sees project cost for
    // the all-in figure.
    expect(result.downPayments).toBe(0);
    expect(result.totalProjectCost).toBe(250000 + 50000 + 2700 + 0 + 27500);
  });

  it('solves max offer and profit mode to the same point', () => {
    const solved = analyzeFlip({ ...base, mode: 'max_offer', targetProfit: 60000 });
    const checked = analyzeFlip({ ...base, mode: 'profit', purchase: solved.purchase });
    expect(checked.profit).toBeCloseTo(60000, 6);
  });

  it('handles a loan sized on purchase plus repairs', () => {
    const result = analyzeFlip({
      ...base,
      loans: [
        {
          ...defaultLoan,
          base: 'purchase_plus_repairs',
          downPct: 0.2,
          type: 'interest_only',
          ratePct: 0.1,
          pointsPct: 0.02,
          lenderFees: 1500,
        },
      ],
    });

    const loan = result.loans[0];
    expect(loan.baseAmount).toBe(300000);
    expect(loan.downPayment).toBeCloseTo(60000, 6);
    expect(loan.loanAmount).toBeCloseTo(240000, 6);
    // 240,000 x 10% x 0.5
    expect(loan.interest).toBeCloseTo(12000, 6);
    // 240,000 x 2%
    expect(loan.points).toBeCloseTo(4800, 6);
    expect(result.financing).toBeCloseTo(12000 + 4800 + 1500, 6);
  });

  it('solves max offer exactly even when the loan is sized on purchase plus repairs', () => {
    // The interesting case: purchase appears inside the financing term too, so
    // a naive solve that treats financing as fixed would be wrong.
    const inputs: FlipInputs = {
      ...base,
      mode: 'max_offer',
      targetProfit: 45000,
      loans: [
        { ...defaultLoan, base: 'purchase_plus_repairs', downPct: 0.15, ratePct: 0.11 },
      ],
    };
    const solved = analyzeFlip(inputs);
    const verified = analyzeFlip({ ...inputs, mode: 'profit', purchase: solved.purchase });
    expect(verified.profit).toBeCloseTo(45000, 6);
  });

  it('sums several loans independently', () => {
    const result = analyzeFlip({
      ...base,
      loans: [
        { ...defaultLoan, base: 'purchase', downPct: 0.25, ratePct: 0.12 },
        { ...defaultLoan, base: 'repairs', downPct: 0, ratePct: 0.14, lenderFees: 900 },
      ],
    });
    expect(result.loans).toHaveLength(2);
    expect(result.lenderFees).toBe(900);
    expect(result.financing).toBeCloseTo(
      result.loanInterest + result.loanPoints + result.lenderFees,
      6,
    );
  });

  it('reports null rather than Infinity when ARV or cash needed is zero', () => {
    const result = analyzeFlip({
      ...base,
      arv: 0,
      repairs: 0,
      purchase: 0,
      holding: emptyHolding,
      transaction: emptyTransaction,
    });
    expect(result.margin).toBeNull();
    expect(result.cashOnCash).toBeNull();
  });

  it('does not credit the deal for a negative custom loan base', () => {
    const result = analyzeFlip({
      ...base,
      loans: [{ ...defaultLoan, base: 'custom', customBase: -50000 }],
    });
    expect(result.loans[0].loanAmount).toBe(0);
    expect(result.financing).toBe(0);
  });

  it('reports a loss as a loss', () => {
    const result = analyzeFlip({ ...base, purchase: 380000 });
    expect(result.profit).toBeLessThan(0);
    expect(result.margin).toBeLessThan(0);
  });
});

describe('analyzeBrrrr', () => {
  const inputs = {
    arv: 300000,
    repairs: 45000,
    maoPct: 0.75,
    purchase: 150000,
    closingPct: 0.03,
    ltvPct: 0.75,
    refiRatePct: 0.07,
    refiTermYears: 30,
    monthlyRent: 2200,
    expensePct: 0.4,
  };

  it('follows the appendix D chain', () => {
    const result = analyzeBrrrr(inputs);
    // 300,000 x 0.75 - 45,000
    expect(result.mao).toBe(180000);
    // (150,000 + 45,000) x 3%
    expect(result.closingCosts).toBeCloseTo(5850, 6);
    expect(result.allIn).toBeCloseTo(200850, 6);
    // 300,000 x 75%
    expect(result.refiLoan).toBe(225000);
    // Pulled out more than went in.
    expect(result.cashLeftIn).toBeCloseTo(-24150, 6);
  });

  it('reports an undefined return, not an infinite one, when nothing is left in', () => {
    const result = analyzeBrrrr(inputs);
    expect(result.cashLeftIn).toBeLessThan(0);
    expect(result.cashOnCash).toBeNull();
  });

  it('computes cash-on-cash when capital does stay in the deal', () => {
    const result = analyzeBrrrr({ ...inputs, purchase: 210000 });
    expect(result.cashLeftIn).toBeGreaterThan(0);
    expect(result.cashOnCash).toBeCloseTo(result.annualCashFlow / result.cashLeftIn, 9);
  });

  it('nets rent down by the expense ratio before debt service', () => {
    const result = analyzeBrrrr(inputs);
    // 2,200 x (1 - 0.4) = 1,320 of net rent
    expect(result.monthlyCashFlow + result.monthlyDebtService).toBeCloseTo(1320, 6);
    expect(result.annualCashFlow).toBeCloseTo(result.monthlyCashFlow * 12, 6);
  });
});

describe('analyzeTurnkey', () => {
  const inputs = {
    purchase: 180000,
    repairs: 30000,
    monthlyRent: 2000,
    expensePct: 0.35,
    capRate: 0.07,
    sellingCostPct: 0.06,
  };

  it('prices off yield, per appendix D', () => {
    const result = analyzeTurnkey(inputs);
    // 2,000 x 12 x (1 - 0.35)
    expect(result.noi).toBeCloseTo(15600, 6);
    // NOI / cap rate
    expect(result.salePrice).toBeCloseTo(222857.14, 2);
    expect(result.sellingCosts).toBeCloseTo(result.salePrice * 0.06, 6);
    expect(result.profit).toBeCloseTo(
      result.salePrice - 180000 - 30000 - result.sellingCosts,
      6,
    );
  });

  it('does not produce an infinite price from a zero cap rate', () => {
    const result = analyzeTurnkey({ ...inputs, capRate: 0 });
    expect(result.salePrice).toBe(0);
    expect(Number.isFinite(result.profit)).toBe(true);
  });

  it('reports null return when nothing was invested', () => {
    const result = analyzeTurnkey({ ...inputs, purchase: 0, repairs: 0 });
    expect(result.returnOnCost).toBeNull();
  });
});

describe('verdictFor', () => {
  it('grades against the threshold table', () => {
    expect(verdictFor(0.2, VERDICT_THRESHOLDS.flipMargin)).toBe('good');
    expect(verdictFor(0.12, VERDICT_THRESHOLDS.flipMargin)).toBe('thin');
    expect(verdictFor(0.04, VERDICT_THRESHOLDS.flipMargin)).toBe('pass');
  });

  it('treats a threshold as inclusive', () => {
    expect(verdictFor(0.15, VERDICT_THRESHOLDS.flipMargin)).toBe('good');
    expect(verdictFor(0.1, VERDICT_THRESHOLDS.flipMargin)).toBe('thin');
  });

  it('grades a loss as pass', () => {
    expect(verdictFor(-0.05, VERDICT_THRESHOLDS.flipMargin)).toBe('pass');
  });

  it('returns null for an undefined ratio rather than a red pill', () => {
    expect(verdictFor(null, VERDICT_THRESHOLDS.flipMargin)).toBeNull();
    expect(verdictFor(Number.NaN, VERDICT_THRESHOLDS.flipMargin)).toBeNull();
  });
});
