/**
 * Deal analyzer - PRD 7.6, formulas from appendix D.
 *
 * Pure functions only: no React, no I/O, no formatting. Screens feed these
 * numbers in and format the results at the edge, which is what lets the whole
 * model be verified by `__tests__/acceptance.test.ts` against the PRD's stated
 * acceptance case.
 */
export * from './types';
export {
  buyerPriceAt,
  DEFAULT_MAO_PCT,
  isPreset,
  MAO_PRESETS,
  maoLabel,
  maoLadder,
  type MaoRung,
} from './mao';
export { analyzeWholesale } from './wholesale';
export {
  amortizedInterest,
  analyzeFlip,
  analyzeFlipAtPurchase,
  interestOnlyInterest,
  solveMaxOffer,
  totalHolding,
  totalSelling,
} from './flip';
export { analyzeBrrrr, monthlyPayment } from './brrrr';
export { analyzeTurnkey } from './turnkey';
export {
  VERDICT_LABELS,
  VERDICT_THRESHOLDS,
  verdictFor,
  type Verdict,
  type VerdictThresholds,
} from './verdict';
