/**
 * Fix & Flip model - PRD 7.6 and appendix D.
 *
 * The model is linear in the purchase price, which is what makes the "Max
 * Offer" mode exact rather than iterative: profit(purchase) is a straight line,
 * so evaluating it at two points gives the slope and intercept, and the
 * purchase that produces any target profit follows directly. That holds for any
 * set of loans, including loans sized on purchase + repairs, because every term
 * in the chain is itself linear in the purchase.
 */
import type {
  FlipInputs,
  FlipResult,
  HoldingCosts,
  Loan,
  LoanBreakdown,
  TransactionCosts,
} from './types';

/**
 * Total interest paid on an amortizing loan over the first `months` payments.
 *
 * A flip rarely holds a loan to term, so this walks the schedule rather than
 * using the full-term interest. Linear in `principal`, which the max-offer
 * solve depends on.
 */
export function amortizedInterest(
  principal: number,
  annualRate: number,
  termYears: number,
  months: number,
): number {
  if (principal <= 0 || months <= 0) return 0;

  const monthlyRate = annualRate / 12;
  const termMonths = Math.max(1, Math.round(termYears * 12));

  // With no interest there is nothing to accrue, whatever the schedule.
  if (monthlyRate === 0) return 0;

  const payment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  let balance = principal;
  let interest = 0;
  const wholeMonths = Math.min(Math.floor(months), termMonths);

  for (let month = 0; month < wholeMonths; month += 1) {
    const monthInterest = balance * monthlyRate;
    interest += monthInterest;
    balance += monthInterest - payment;
    if (balance <= 0) return interest;
  }

  // A partial final month accrues proportionally.
  const remainder = months - wholeMonths;
  if (remainder > 0 && wholeMonths < termMonths) {
    interest += balance * monthlyRate * remainder;
  }

  return interest;
}

/** Simple interest over the hold period: loan x rate x (months / 12). */
export function interestOnlyInterest(
  principal: number,
  annualRate: number,
  months: number,
): number {
  if (principal <= 0 || months <= 0) return 0;
  return principal * annualRate * (months / 12);
}

/** Resolves a loan's "Financing Of" selector into a dollar amount. */
function resolveLoanBase(loan: Loan, purchase: number, repairs: number): number {
  switch (loan.base) {
    case 'purchase':
      return purchase;
    case 'repairs':
      return repairs;
    case 'purchase_plus_repairs':
      return purchase + repairs;
    case 'custom':
      return loan.customBase;
  }
}

function breakDownLoan(
  loan: Loan,
  purchase: number,
  repairs: number,
  months: number,
): LoanBreakdown {
  // A base can go negative if a custom amount is entered oddly; clamp so a
  // nonsensical input cannot produce a negative loan that credits the deal.
  const baseAmount = Math.max(0, resolveLoanBase(loan, purchase, repairs));
  const downPayment = baseAmount * loan.downPct;
  const loanAmount = baseAmount - downPayment;

  const interest =
    loan.type === 'amortized'
      ? amortizedInterest(loanAmount, loan.ratePct, loan.amortYears, months)
      : interestOnlyInterest(loanAmount, loan.ratePct, months);

  const points = loanAmount * loan.pointsPct;

  return {
    baseAmount,
    downPayment,
    loanAmount,
    interest,
    points,
    lenderFees: loan.lenderFees,
    total: interest + points + loan.lenderFees,
  };
}

/** Sum of the monthly carrying items multiplied by the months held. */
export function totalHolding(holding: HoldingCosts): number {
  const monthly =
    holding.taxes + holding.insurance + holding.utilities + holding.hoa + holding.other;
  return monthly * holding.months;
}

/**
 * Costs to sell, driven by the resale value rather than the purchase:
 * ARV x agent% + ARV x transfer% + flat selling costs + buyer credits.
 */
export function totalSelling(arv: number, transaction: TransactionCosts): number {
  return (
    arv * transaction.agentPct +
    arv * transaction.transferPct +
    transaction.sellingFlat +
    transaction.buyerCredits
  );
}

/**
 * Evaluates the full model at a given purchase price. This is the single
 * source of truth; max-offer mode solves against it rather than duplicating it.
 */
export function analyzeFlipAtPurchase(inputs: FlipInputs, purchase: number): FlipResult {
  const { arv, repairs, holding, transaction } = inputs;

  const loans = inputs.loans.map((loan) =>
    breakDownLoan(loan, purchase, repairs, holding.months),
  );

  const loanInterest = loans.reduce((sum, loan) => sum + loan.interest, 0);
  const loanPoints = loans.reduce((sum, loan) => sum + loan.points, 0);
  const lenderFees = loans.reduce((sum, loan) => sum + loan.lenderFees, 0);
  const financing = loanInterest + loanPoints + lenderFees;
  const downPayments = loans.reduce((sum, loan) => sum + loan.downPayment, 0);

  const holdingTotal = totalHolding(holding);
  const buying = transaction.buyingFlat;
  const selling = totalSelling(arv, transaction);
  const transactionTotal = buying + selling;

  const profit = arv - purchase - repairs - financing - holdingTotal - transactionTotal;

  const totalCashNeeded = downPayments + repairs + holdingTotal + financing + buying;
  const totalProjectCost = purchase + repairs + holdingTotal + financing + transactionTotal;

  return {
    purchase,
    profit,
    loans,
    financing,
    loanInterest,
    loanPoints,
    lenderFees,
    downPayments,
    holding: holdingTotal,
    buying,
    selling,
    transaction: transactionTotal,
    totalCashNeeded,
    totalProjectCost,
    margin: arv === 0 ? null : profit / arv,
    cashOnCash: totalCashNeeded === 0 ? null : profit / totalCashNeeded,
  };
}

/**
 * Solves for the highest purchase price that still nets `targetProfit`.
 *
 * Profit is linear in purchase, so two evaluations determine the line exactly.
 * The probe points are arbitrary as long as they differ; 0 and the ARV are used
 * because both are in a sane numeric range for any real deal.
 */
export function solveMaxOffer(inputs: FlipInputs): number {
  const probeA = 0;
  const probeB = inputs.arv > 0 ? inputs.arv : 100000;

  const profitA = analyzeFlipAtPurchase(inputs, probeA).profit;
  const profitB = analyzeFlipAtPurchase(inputs, probeB).profit;

  const slope = (profitB - profitA) / (probeB - probeA);

  // Every dollar of purchase costs at least a dollar of profit, so the slope is
  // always negative in practice. Guard anyway rather than dividing by zero.
  if (slope === 0 || !Number.isFinite(slope)) return 0;

  return (inputs.targetProfit - profitA) / slope + probeA;
}

/**
 * Runs the Fix & Flip model in whichever direction the user asked for.
 * PRD 7.6: "a Calculate my toggle - Max Offer solves for the highest purchase
 * that still nets a target profit; Profit takes a purchase price and returns
 * profit."
 */
export function analyzeFlip(inputs: FlipInputs): FlipResult {
  const purchase =
    inputs.mode === 'max_offer' ? solveMaxOffer(inputs) : inputs.purchase;
  return analyzeFlipAtPurchase(inputs, purchase);
}
