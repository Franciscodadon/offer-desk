/**
 * Verdict coloring - PRD 7.6: "Verdict coloring (good/thin/pass) on
 * margin/ROI."
 *
 * The thresholds are house defaults, not laws of arithmetic, so they live in
 * one exported table. When orgs get configurable underwriting (v2), this is the
 * shape that moves into `orgs.default_terms`.
 */
export type Verdict = 'good' | 'thin' | 'pass';

export type VerdictThresholds = {
  /** At or above this is 'good'. */
  good: number;
  /** At or above this is 'thin'; below it is 'pass'. */
  thin: number;
};

export const VERDICT_THRESHOLDS = {
  /** Fix & flip margin (profit / ARV). */
  flipMargin: { good: 0.15, thin: 0.1 },
  /** Fix & flip cash-on-cash return. */
  flipCashOnCash: { good: 0.3, thin: 0.15 },
  /** BRRRR cash-on-cash on capital left in the deal. */
  brrrrCashOnCash: { good: 0.12, thin: 0.08 },
  /** Turnkey return on total cost. */
  turnkeyReturnOnCost: { good: 0.15, thin: 0.08 },
} as const satisfies Record<string, VerdictThresholds>;

/**
 * Grades a ratio against a threshold pair. A null ratio - an undefined return
 * rather than a bad one - grades as null so the UI can show a dash instead of
 * a red pill.
 */
export function verdictFor(
  ratio: number | null | undefined,
  thresholds: VerdictThresholds,
): Verdict | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  if (ratio >= thresholds.good) return 'good';
  if (ratio >= thresholds.thin) return 'thin';
  return 'pass';
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  good: 'Good',
  thin: 'Thin',
  pass: 'Pass',
};
