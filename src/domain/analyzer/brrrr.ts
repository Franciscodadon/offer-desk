/**
 * BRRRR model - PRD appendix D.
 *
 *   MAO       = ARV x MAO% - repairs
 *   allIn     = purchase + repairs + (purchase + repairs) x closing%
 *   refi      = ARV x LTV%
 *   cashLeft  = allIn - refi
 *   cashFlow  = rent x (1 - expense%) - amortize(refi, rate, term)
 *   CoC       = 12 x cashFlow / cashLeft
 *
 * The point of the strategy is how little stays in the deal, so `cashLeftIn`
 * can legitimately be zero or negative when the refinance returns more than was
 * put in. Cash-on-cash is undefined there rather than infinite, so it is null.
 */
import type { BrrrrInputs, BrrrrResult } from './types';

/**
 * Level monthly payment on an amortizing loan.
 * Falls back to straight principal repayment when the rate is zero.
 */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  termYears: number,
): number {
  if (principal <= 0) return 0;

  const termMonths = Math.max(1, Math.round(termYears * 12));
  const monthlyRate = annualRate / 12;

  if (monthlyRate === 0) return principal / termMonths;

  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));
}

export function analyzeBrrrr(inputs: BrrrrInputs): BrrrrResult {
  const {
    arv,
    repairs,
    maoPct,
    purchase,
    closingPct,
    ltvPct,
    refiRatePct,
    refiTermYears,
    monthlyRent,
    expensePct,
  } = inputs;

  const mao = arv * maoPct - repairs;

  const closingCosts = (purchase + repairs) * closingPct;
  const allIn = purchase + repairs + closingCosts;

  const refiLoan = arv * ltvPct;
  const cashLeftIn = allIn - refiLoan;

  const monthlyDebtService = monthlyPayment(refiLoan, refiRatePct, refiTermYears);
  const monthlyCashFlow = monthlyRent * (1 - expensePct) - monthlyDebtService;
  const annualCashFlow = monthlyCashFlow * 12;

  return {
    mao,
    allIn,
    closingCosts,
    refiLoan,
    cashLeftIn,
    monthlyDebtService,
    monthlyCashFlow,
    annualCashFlow,
    // Nothing left in the deal means an undefined return, not an infinite one.
    cashOnCash: cashLeftIn <= 0 ? null : annualCashFlow / cashLeftIn,
  };
}
