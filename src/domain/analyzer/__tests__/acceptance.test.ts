/**
 * PRD 7.6 acceptance case.
 *
 * This is the contract the analyzer ships against, quoted from the PRD:
 *
 *   Accept (Flip, Max Offer): ARV 357,244; repairs 25,000; 1 loan financing
 *   Purchase at 25% down, interest-only 12.5%; holding 687/mo x 6; agent 6% +
 *   transfer 1% + buying 2,500 + selling 2,000; target profit 50,000 ->
 *   Max Offer 237,483, loan interest 11,132, holding 4,122, transaction
 *   29,507, margin 14.0%, cash-on-cash 49%, cash needed 102,125, project
 *   cost 307,244.
 *
 * Every figure is asserted to the dollar, as PRD 7.6 requires ("the exact deal
 * math is a product requirement - the app must reproduce these to the dollar").
 */
import { analyzeFlip } from '../flip';
import { defaultLoan, emptyHolding, type FlipInputs } from '../types';

const ACCEPTANCE_CASE: FlipInputs = {
  arv: 357244,
  repairs: 25000,
  purchase: 0, // solved for
  targetProfit: 50000,
  mode: 'max_offer',
  loans: [
    {
      ...defaultLoan,
      base: 'purchase',
      downPct: 0.25,
      type: 'interest_only',
      ratePct: 0.125,
      pointsPct: 0,
      lenderFees: 0,
    },
  ],
  holding: { ...emptyHolding, other: 687, months: 6 },
  transaction: {
    agentPct: 0.06,
    transferPct: 0.01,
    buyingFlat: 2500,
    sellingFlat: 2000,
    buyerCredits: 0,
  },
};

describe('PRD 7.6 acceptance case (Fix & Flip, Max Offer)', () => {
  const result = analyzeFlip(ACCEPTANCE_CASE);
  const dollars = (value: number) => Math.round(value);

  it('solves a max offer of 237,483', () => {
    expect(dollars(result.purchase)).toBe(237483);
  });

  it('reports loan interest of 11,132', () => {
    expect(dollars(result.loanInterest)).toBe(11132);
  });

  it('reports holding costs of 4,122', () => {
    expect(dollars(result.holding)).toBe(4122);
  });

  it('reports transaction costs of 29,507', () => {
    expect(dollars(result.transaction)).toBe(29507);
  });

  it('reports a margin of 14.0%', () => {
    expect((result.margin! * 100).toFixed(1)).toBe('14.0');
  });

  it('reports cash-on-cash of 49%', () => {
    expect((result.cashOnCash! * 100).toFixed(0)).toBe('49');
  });

  it('reports total cash needed of 102,125', () => {
    expect(dollars(result.totalCashNeeded)).toBe(102125);
  });

  it('reports a total project cost of 307,244', () => {
    expect(dollars(result.totalProjectCost)).toBe(307244);
  });

  it('hits the target profit it solved for', () => {
    expect(dollars(result.profit)).toBe(50000);
  });

  it('round-trips: feeding the solved purchase back in profit mode returns the target', () => {
    const check = analyzeFlip({
      ...ACCEPTANCE_CASE,
      mode: 'profit',
      purchase: result.purchase,
    });
    expect(dollars(check.profit)).toBe(50000);
    // Every other figure must match the max-offer run exactly; the two modes
    // are the same model solved for different unknowns.
    expect(dollars(check.totalCashNeeded)).toBe(102125);
    expect(dollars(check.totalProjectCost)).toBe(307244);
    expect(dollars(check.loanInterest)).toBe(11132);
  });

  it('reconciles: project cost plus target profit equals ARV', () => {
    // A structural check on the model rather than on one arithmetic result.
    expect(dollars(result.totalProjectCost + result.profit)).toBe(dollars(ACCEPTANCE_CASE.arv));
  });
});
