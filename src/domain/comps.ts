/**
 * Comps math - PRD 7.7.
 *
 *   "Auto-compute $/sqft per comp and averages. ARV suggestion = comp average,
 *    with an upside note when the subject is larger than comps (comp avg $/sqft
 *    x subject sqft)."
 *
 * Pure functions over comp rows. Rows with missing figures are carried through
 * rather than dropped, because a comp the user is still typing should stay on
 * screen; they are simply excluded from the averages until they are complete.
 */

export type CompInput = {
  id: string;
  address: string;
  sqft: number | null;
  soldPrice: number | null;
  distanceMi: number | null;
};

export type CompWithMetrics = CompInput & {
  /** soldPrice / sqft, or null when either is missing or sqft is zero. */
  pricePerSqft: number | null;
};

export type CompSummary = {
  comps: CompWithMetrics[];
  /** How many comps had both a sold price and a sqft, and so counted. */
  usableCount: number;
  /** Straight average of sold price across usable comps. */
  averageSoldPrice: number | null;
  /**
   * Average of the per-comp $/sqft figures.
   *
   * This is the mean of the ratios, not the ratio of the means: each comp is
   * one opinion of the going rate and they weigh equally, so a single large
   * house cannot dominate the figure.
   */
  averagePricePerSqft: number | null;
  averageSqft: number | null;
};

/** Adds the derived $/sqft to each comp. */
export function withMetrics(comps: CompInput[]): CompWithMetrics[] {
  return comps.map((comp) => ({
    ...comp,
    pricePerSqft:
      comp.soldPrice != null && comp.sqft != null && comp.sqft > 0
        ? comp.soldPrice / comp.sqft
        : null,
  }));
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeComps(comps: CompInput[]): CompSummary {
  const enriched = withMetrics(comps);
  const usable = enriched.filter((comp) => comp.pricePerSqft != null);

  return {
    comps: enriched,
    usableCount: usable.length,
    averageSoldPrice: mean(usable.map((comp) => comp.soldPrice as number)),
    averagePricePerSqft: mean(usable.map((comp) => comp.pricePerSqft as number)),
    averageSqft: mean(usable.map((comp) => comp.sqft as number)),
  };
}

export type ArvSuggestion = {
  /** The headline suggestion: the comp average sold price. */
  suggested: number | null;
  /**
   * What the subject would be worth at the comps' average rate per sqft.
   * Present only when the subject's size is known.
   */
  bySqft: number | null;
  /**
   * Set when the subject is materially larger than the comps, so the straight
   * average understates it. The dollar figure is the gap between the two
   * methods - the upside the user should weigh, not apply automatically.
   */
  upside: number | null;
  /** How many comps the suggestion rests on. Three or more is a real read. */
  basis: number;
};

/** Below this the size difference is noise rather than upside. */
const MATERIAL_SIZE_DIFFERENCE = 0.05;

/**
 * Suggests an ARV from comps, per PRD 7.7. Returns both methods and the gap
 * between them rather than silently picking one, because the note is the point:
 * the user decides whether the subject really earns the larger number.
 */
export function suggestArv(comps: CompInput[], subjectSqft: number | null): ArvSuggestion {
  const summary = summarizeComps(comps);

  const suggested = summary.averageSoldPrice;
  const bySqft =
    summary.averagePricePerSqft != null && subjectSqft != null && subjectSqft > 0
      ? summary.averagePricePerSqft * subjectSqft
      : null;

  let upside: number | null = null;
  if (
    bySqft != null &&
    suggested != null &&
    summary.averageSqft != null &&
    summary.averageSqft > 0 &&
    subjectSqft != null
  ) {
    const sizeDifference = (subjectSqft - summary.averageSqft) / summary.averageSqft;
    if (sizeDifference > MATERIAL_SIZE_DIFFERENCE && bySqft > suggested) {
      upside = bySqft - suggested;
    }
  }

  return { suggested, bySqft, upside, basis: summary.usableCount };
}
