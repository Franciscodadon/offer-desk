import { suggestArv, summarizeComps, withMetrics, type CompInput } from '../comps';

const comp = (over: Partial<CompInput> & { id: string }): CompInput => ({
  address: `${over.id} Test St`,
  sqft: null,
  soldPrice: null,
  distanceMi: null,
  ...over,
});

describe('withMetrics', () => {
  it('computes $/sqft per comp', () => {
    const [result] = withMetrics([comp({ id: '1', sqft: 1500, soldPrice: 300000 })]);
    expect(result.pricePerSqft).toBe(200);
  });

  it('leaves $/sqft null when a figure is missing', () => {
    const [noPrice] = withMetrics([comp({ id: '1', sqft: 1500 })]);
    const [noSqft] = withMetrics([comp({ id: '2', soldPrice: 300000 })]);
    expect(noPrice.pricePerSqft).toBeNull();
    expect(noSqft.pricePerSqft).toBeNull();
  });

  it('does not divide by a zero sqft', () => {
    const [result] = withMetrics([comp({ id: '1', sqft: 0, soldPrice: 300000 })]);
    expect(result.pricePerSqft).toBeNull();
  });
});

describe('summarizeComps', () => {
  it('averages three comps, per the PRD acceptance criterion', () => {
    const summary = summarizeComps([
      comp({ id: '1', sqft: 1500, soldPrice: 300000 }),
      comp({ id: '2', sqft: 1600, soldPrice: 336000 }),
      comp({ id: '3', sqft: 1400, soldPrice: 294000 }),
    ]);

    expect(summary.usableCount).toBe(3);
    expect(summary.averageSoldPrice).toBe(310000);
    // 200, 210, 210 -> 206.67
    expect(summary.averagePricePerSqft).toBeCloseTo(206.666, 2);
    expect(summary.averageSqft).toBe(1500);
  });

  it('keeps incomplete comps on the list but out of the averages', () => {
    const summary = summarizeComps([
      comp({ id: '1', sqft: 1500, soldPrice: 300000 }),
      comp({ id: '2' }),
    ]);
    expect(summary.comps).toHaveLength(2);
    expect(summary.usableCount).toBe(1);
    expect(summary.averageSoldPrice).toBe(300000);
  });

  it('returns nulls rather than NaN for an empty list', () => {
    const summary = summarizeComps([]);
    expect(summary.averageSoldPrice).toBeNull();
    expect(summary.averagePricePerSqft).toBeNull();
    expect(summary.usableCount).toBe(0);
  });

  it('averages the ratios, so one large comp cannot dominate $/sqft', () => {
    const summary = summarizeComps([
      comp({ id: '1', sqft: 1000, soldPrice: 200000 }), // 200/sqft
      comp({ id: '2', sqft: 4000, soldPrice: 600000 }), // 150/sqft
    ]);
    // Mean of the ratios is 175. The ratio of the means would be 160.
    expect(summary.averagePricePerSqft).toBe(175);
  });
});

describe('suggestArv', () => {
  const threeComps = [
    comp({ id: '1', sqft: 1500, soldPrice: 300000 }),
    comp({ id: '2', sqft: 1500, soldPrice: 310000 }),
    comp({ id: '3', sqft: 1500, soldPrice: 320000 }),
  ];

  it('suggests the comp average', () => {
    const result = suggestArv(threeComps, 1500);
    expect(result.suggested).toBe(310000);
    expect(result.basis).toBe(3);
  });

  it('notes upside when the subject is materially larger than the comps', () => {
    const result = suggestArv(threeComps, 1800);
    expect(result.bySqft).toBeGreaterThan(result.suggested!);
    expect(result.upside).toBeCloseTo(result.bySqft! - result.suggested!, 6);
  });

  it('does not claim upside for a trivial size difference', () => {
    // 2% larger is noise, not upside.
    const result = suggestArv(threeComps, 1530);
    expect(result.upside).toBeNull();
  });

  it('does not claim upside when the subject is smaller', () => {
    const result = suggestArv(threeComps, 1200);
    expect(result.upside).toBeNull();
    // The per-sqft read is still offered, it just is not framed as upside.
    expect(result.bySqft).toBeLessThan(result.suggested!);
  });

  it('handles an unknown subject size', () => {
    const result = suggestArv(threeComps, null);
    expect(result.suggested).toBe(310000);
    expect(result.bySqft).toBeNull();
    expect(result.upside).toBeNull();
  });

  it('returns an empty suggestion with no comps', () => {
    const result = suggestArv([], 1500);
    expect(result.suggested).toBeNull();
    expect(result.basis).toBe(0);
  });
});
