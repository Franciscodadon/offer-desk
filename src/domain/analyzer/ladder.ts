/**
 * The offer ladder - every MAO percentage priced at once.
 *
 * The rule of thumb sets the purchase price (ARV x MAO% - repairs) and the
 * full Fix & Flip model then says what that purchase actually leaves. So each
 * rung is a real run of the verified model at a different purchase, not a
 * simplified stand-in: the margin column is the same figure the analyzer would
 * show if you typed that price in.
 *
 * The point of showing all eight is that the interesting fact is where margin
 * stops being acceptable, and that is a comparison, not a number. Tapping
 * through percentages to discover it one at a time is the interaction this
 * replaces.
 */
import { analyzeFlipAtPurchase } from './flip';
import { buyerPriceAt, MAO_PRESETS, maoLabel } from './mao';
import type { FlipInputs } from './types';
import { verdictFor, VERDICT_THRESHOLDS, type Verdict } from './verdict';

export type LadderRung = {
  maoPct: number;
  /** "70%" */
  label: string;
  /** ARV x MAO% - repairs: what the rule of thumb says to pay. */
  purchase: number;
  profit: number;
  /** profit / ARV. Null when ARV is zero. */
  margin: number | null;
  verdict: Verdict | null;
  isCurrent: boolean;
  /**
   * False when the rule of thumb prices this rung at or below zero, which
   * happens once repairs exceed what a buyer would pay for the finished
   * house. There is no offer to make, and the model must not be run on a
   * negative purchase: it returns a healthy-looking margin for a deal that
   * cannot be bought at all.
   */
  viable: boolean;
};

export type Ladder = {
  rungs: LadderRung[];
  /**
   * The highest percentage whose margin still grades above a pass, or null
   * when none of them do. This is the number an operator is actually looking
   * for: how far they can go before the deal stops working.
   */
  ceiling: LadderRung | null;
  /** The first rung that grades as a pass, i.e. where it stops working. */
  breaks: LadderRung | null;
};

/**
 * Prices every preset against one deal.
 *
 * `currentMaoPct` only marks a rung; it does not change any figure, so the
 * ladder reads the same whatever is selected.
 */
export function flipLadder(inputs: FlipInputs, currentMaoPct: number): Ladder {
  const rungs: LadderRung[] = MAO_PRESETS.map((maoPct) => {
    const purchase = buyerPriceAt(inputs.arv, inputs.repairs, maoPct);
    const isCurrent = Math.abs(maoPct - currentMaoPct) < 0.0005;

    if (purchase <= 0) {
      return {
        maoPct,
        label: maoLabel(maoPct),
        purchase,
        profit: 0,
        margin: null,
        verdict: null,
        isCurrent,
        viable: false,
      };
    }

    const result = analyzeFlipAtPurchase(inputs, purchase);

    return {
      maoPct,
      label: maoLabel(maoPct),
      purchase,
      profit: result.profit,
      margin: result.margin,
      verdict: verdictFor(result.margin, VERDICT_THRESHOLDS.flipMargin),
      isCurrent,
      viable: true,
    };
  });

  // Rungs rise with the percentage, so the last acceptable one is the ceiling
  // and the first unacceptable one is where it breaks.
  const acceptable = rungs.filter(
    (rung) => rung.viable && (rung.verdict === 'good' || rung.verdict === 'thin'),
  );
  const ceiling = acceptable.length > 0 ? acceptable[acceptable.length - 1] : null;
  const breaks = rungs.find((rung) => rung.viable && rung.verdict === 'pass') ?? null;

  return { rungs, ceiling, breaks };
}
