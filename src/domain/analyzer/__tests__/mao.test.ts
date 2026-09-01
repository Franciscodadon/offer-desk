import {
  buyerPriceAt,
  DEFAULT_MAO_PCT,
  isPreset,
  MAO_PRESETS,
  maoLabel,
  maoLadder,
} from '../mao';

describe('MAO_PRESETS', () => {
  it('runs 50 to 85 in five-point steps', () => {
    expect(MAO_PRESETS.map((p) => Math.round(p * 100))).toEqual([
      50, 55, 60, 65, 70, 75, 80, 85,
    ]);
  });

  it('defaults to the 70% rule', () => {
    expect(DEFAULT_MAO_PCT).toBe(0.7);
    expect(MAO_PRESETS).toContain(DEFAULT_MAO_PCT);
  });
});

describe('maoLabel', () => {
  it('renders a ratio as a whole percentage', () => {
    expect(maoLabel(0.7)).toBe('70%');
    expect(maoLabel(0.85)).toBe('85%');
  });
});

describe('isPreset', () => {
  it('recognizes a preset', () => {
    expect(isPreset(0.7)).toBe(true);
  });

  it('recognizes a stored value that drifted in floating point', () => {
    // A round trip through JSON and arithmetic must still light the button.
    expect(isPreset(0.7000000000000001)).toBe(true);
  });

  it('does not claim a hand-typed value is a preset', () => {
    expect(isPreset(0.72)).toBe(false);
  });
});

describe('buyerPriceAt', () => {
  it('follows ARV x MAO% - repairs', () => {
    expect(buyerPriceAt(357244, 25000, 0.7)).toBeCloseTo(225070.8, 2);
  });

  it('can go negative when repairs swamp the ARV', () => {
    expect(buyerPriceAt(100000, 200000, 0.7)).toBeLessThan(0);
  });
});

describe('maoLadder', () => {
  it('prices every preset in one pass', () => {
    const ladder = maoLadder(357244, 25000, 0.7);
    expect(ladder).toHaveLength(8);
    expect(ladder[0].label).toBe('50%');
    expect(ladder[7].label).toBe('85%');
  });

  it('marks the current rung, and only that one', () => {
    const ladder = maoLadder(357244, 25000, 0.7);
    expect(ladder.filter((rung) => rung.isCurrent).map((r) => r.label)).toEqual(['70%']);
  });

  it('marks nothing current when the value is off the ladder', () => {
    const ladder = maoLadder(357244, 25000, 0.72);
    expect(ladder.some((rung) => rung.isCurrent)).toBe(false);
  });

  it('rises with the percentage', () => {
    const ladder = maoLadder(357244, 25000, 0.7);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i].buyerPrice).toBeGreaterThan(ladder[i - 1].buyerPrice);
    }
  });
});
