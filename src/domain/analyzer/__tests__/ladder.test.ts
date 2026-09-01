import { analyzeFlipAtPurchase } from '../flip';
import { flipLadder } from '../ladder';
import { defaultLoan, emptyHolding, type FlipInputs } from '../types';

// The PRD 7.6 acceptance case, so the ladder is checked against the same model
// the rest of the analyzer is verified on.
const inputs: FlipInputs = {
  arv: 357244,
  repairs: 25000,
  purchase: 0,
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

describe('flipLadder', () => {
  const ladder = flipLadder(inputs, 0.7);

  it('prices all eight presets', () => {
    expect(ladder.rungs).toHaveLength(8);
    expect(ladder.rungs.map((r) => r.label)).toEqual([
      '50%', '55%', '60%', '65%', '70%', '75%', '80%', '85%',
    ]);
  });

  it('sets each purchase from the rule of thumb', () => {
    // 357,244 x 0.70 - 25,000
    const at70 = ladder.rungs.find((r) => r.label === '70%');
    expect(at70?.purchase).toBeCloseTo(225070.8, 2);
  });

  it('reports the same margin the full model would at that purchase', () => {
    // The ladder must not be a simplified stand-in for the real analyzer.
    for (const rung of ladder.rungs.filter((r) => r.viable)) {
      const direct = analyzeFlipAtPurchase(inputs, rung.purchase);
      expect(rung.profit).toBeCloseTo(direct.profit, 6);
      expect(rung.margin).toBeCloseTo(direct.margin as number, 9);
    }
  });

  it('falls as the percentage rises', () => {
    for (let i = 1; i < ladder.rungs.length; i += 1) {
      expect(ladder.rungs[i].purchase).toBeGreaterThan(ladder.rungs[i - 1].purchase);
      expect(ladder.rungs[i].profit).toBeLessThan(ladder.rungs[i - 1].profit);
    }
  });

  it('marks the current rung and only that one', () => {
    expect(ladder.rungs.filter((r) => r.isCurrent).map((r) => r.label)).toEqual(['70%']);
  });

  it('names the highest percentage that still works', () => {
    // The number an operator is actually looking for.
    expect(ladder.ceiling).not.toBeNull();
    expect(ladder.ceiling?.verdict === 'good' || ladder.ceiling?.verdict === 'thin').toBe(true);

    // Nothing above the ceiling is still acceptable.
    const above = ladder.rungs.filter((r) => r.maoPct > (ladder.ceiling as { maoPct: number }).maoPct);
    expect(above.every((r) => r.verdict === 'pass')).toBe(true);
  });

  it('names where it stops working', () => {
    expect(ladder.breaks).not.toBeNull();
    expect(ladder.breaks?.verdict).toBe('pass');
    // The break sits above the ceiling.
    expect(ladder.breaks!.maoPct).toBeGreaterThan(ladder.ceiling!.maoPct);
  });

  it('reports no ceiling when the deal never works', () => {
    // Costs that leave nothing at any percentage.
    const hopeless = flipLadder({ ...inputs, transaction: { ...inputs.transaction, sellingFlat: 250000 } }, 0.7);
    expect(hopeless.ceiling).toBeNull();
    expect(hopeless.rungs.filter((r) => r.viable).every((r) => r.verdict === 'pass')).toBe(true);
  });

  it('does not price a rung the rule of thumb puts below zero', () => {
    // Repairs above what a buyer pays for the finished house. Running the
    // model on a negative purchase returns a healthy-looking margin for a deal
    // that cannot be bought at all, which is worse than showing nothing.
    const underwater = flipLadder({ ...inputs, repairs: 300000 }, 0.7);
    const sunk = underwater.rungs.filter((r) => r.purchase <= 0);

    expect(sunk.length).toBeGreaterThan(0);
    for (const rung of sunk) {
      expect(rung.viable).toBe(false);
      expect(rung.margin).toBeNull();
      expect(rung.verdict).toBeNull();
    }
    // And an unbuyable rung is never offered as the ceiling.
    expect(underwater.ceiling?.viable ?? true).toBe(true);
  });

  it('reports no break when every rung still works', () => {
    // A deal with almost no costs works at every percentage.
    const generous = flipLadder(
      {
        ...inputs,
        repairs: 0,
        loans: [],
        holding: emptyHolding,
        transaction: { agentPct: 0, transferPct: 0, buyingFlat: 0, sellingFlat: 0, buyerCredits: 0 },
      },
      0.7,
    );
    expect(generous.breaks).toBeNull();
    expect(generous.ceiling?.label).toBe('85%');
  });

  it('marks nothing current when the percentage is off the ladder', () => {
    expect(flipLadder(inputs, 0.72).rungs.some((r) => r.isCurrent)).toBe(false);
  });
});
