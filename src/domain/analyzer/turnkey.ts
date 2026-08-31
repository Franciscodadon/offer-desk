/**
 * Turnkey model - PRD appendix D. An income approach: the exit is a passive
 * buyer who prices the property off its yield rather than off comps.
 *
 *   NOI       = rent x 12 x (1 - expense%)
 *   salePrice = NOI / capRate
 *   profit    = salePrice - purchase - repairs - salePrice x sellingCost%
 */
import type { TurnkeyInputs, TurnkeyResult } from './types';

export function analyzeTurnkey(inputs: TurnkeyInputs): TurnkeyResult {
  const { purchase, repairs, monthlyRent, expensePct, capRate, sellingCostPct } = inputs;

  const noi = monthlyRent * 12 * (1 - expensePct);

  // A zero cap rate would imply an infinite price. Report zero instead, which
  // reads on screen as "not enough input yet" rather than as a fantasy number.
  const salePrice = capRate > 0 ? noi / capRate : 0;
  const sellingCosts = salePrice * sellingCostPct;
  const profit = salePrice - purchase - repairs - sellingCosts;

  const cost = purchase + repairs;

  return {
    noi,
    salePrice,
    sellingCosts,
    profit,
    returnOnCost: cost === 0 ? null : profit / cost,
  };
}
