/**
 * Deal analyzer types - PRD 7.6 and appendix D.
 *
 * This module is a specification, not an approximation. Appendix D gives the
 * formulas and section 7.6 gives an acceptance case the app must reproduce to
 * the dollar; `__tests__/acceptance.test.ts` holds that case.
 *
 * Conventions used throughout:
 *   - Every money value is whole dollars as a number. Nothing is rounded until
 *     it is displayed, so intermediate figures never drift.
 *   - Every rate is a ratio, not a percentage: 12.5% is 0.125, never 12.5.
 *     `parseNumericInput` reads what the user types; the UI divides by 100 once
 *     at the boundary so the math only ever sees ratios.
 *   - A missing input is `null`, never 0, so a half-typed field cannot quietly
 *     become a real number in the math.
 */

export type AnalysisStrategy = 'wholesale' | 'flip' | 'brrrr' | 'turnkey';

// ---------------------------------------------------------------------------
// Financing (Fix & Flip)
// ---------------------------------------------------------------------------

/** What a loan is sized against, per PRD 7.6's "Financing Of" selector. */
export type LoanBase = 'purchase' | 'repairs' | 'purchase_plus_repairs' | 'custom';

export type LoanType = 'interest_only' | 'amortized';

export type Loan = {
  base: LoanBase;
  /** Used only when `base` is 'custom'. */
  customBase: number;
  /** Share of the base paid in cash, as a ratio. 0.25 means 25% down. */
  downPct: number;
  type: LoanType;
  /** Annual interest rate as a ratio. 0.125 is 12.5%. */
  ratePct: number;
  /** Origination points as a ratio of the loan amount. */
  pointsPct: number;
  lenderFees: number;
  /** Amortization term in years. Ignored for interest-only loans. */
  amortYears: number;
};

export const defaultLoan: Loan = {
  base: 'purchase',
  customBase: 0,
  downPct: 0.25,
  type: 'interest_only',
  ratePct: 0.125,
  pointsPct: 0,
  lenderFees: 0,
  amortYears: 30,
};

/** Per-loan figures, kept so the analyzer can always show its work. */
export type LoanBreakdown = {
  /** The amount the loan is sized against, after resolving `base`. */
  baseAmount: number;
  downPayment: number;
  loanAmount: number;
  interest: number;
  points: number;
  lenderFees: number;
  /** interest + points + lenderFees */
  total: number;
};

// ---------------------------------------------------------------------------
// Holding and transaction costs
// ---------------------------------------------------------------------------

/** Monthly carrying costs plus the number of months carried. */
export type HoldingCosts = {
  taxes: number;
  insurance: number;
  utilities: number;
  hoa: number;
  other: number;
  months: number;
};

export const emptyHolding: HoldingCosts = {
  taxes: 0,
  insurance: 0,
  utilities: 0,
  hoa: 0,
  other: 0,
  months: 0,
};

export type TransactionCosts = {
  /** Listing agent commission on the sale, as a ratio of ARV. */
  agentPct: number;
  /** Transfer tax on the sale, as a ratio of ARV. */
  transferPct: number;
  /** Flat costs to buy: inspection, title, recording. */
  buyingFlat: number;
  /** Flat costs to sell, on top of the percentage costs above. */
  sellingFlat: number;
  /** Credits given to the end buyer at closing. */
  buyerCredits: number;
};

export const emptyTransaction: TransactionCosts = {
  agentPct: 0,
  transferPct: 0,
  buyingFlat: 0,
  sellingFlat: 0,
  buyerCredits: 0,
};

// ---------------------------------------------------------------------------
// Wholesale
// ---------------------------------------------------------------------------

export type WholesaleInputs = {
  arv: number;
  repairs: number;
  /** The buyer's rule of thumb, as a ratio. 0.7 is the 70% rule. */
  maoPct: number;
  assignmentFee: number;
  /** Room left to negotiate up from the first offer, as a ratio. */
  negotiationBuffer: number;
};

export type WholesaleResult = {
  /** What a cash buyer should pay: ARV x MAO% - repairs. */
  buyerPrice: number;
  /** The most you can go to contract for and still make your fee. */
  mao: number;
  /** What to open at, leaving negotiating room below your MAO. */
  initialOffer: number;
  /** Your assignment fee, i.e. buyerPrice - mao. */
  fee: number;
};

// ---------------------------------------------------------------------------
// Fix & Flip
// ---------------------------------------------------------------------------

/**
 * 'profit' takes a purchase price and returns the profit.
 * 'max_offer' solves for the highest purchase that still nets `targetProfit`.
 * PRD 7.6 calls this the "Calculate my" toggle.
 */
export type FlipMode = 'profit' | 'max_offer';

export type FlipInputs = {
  arv: number;
  repairs: number;
  /** Read in 'profit' mode; solved for in 'max_offer' mode. */
  purchase: number;
  /** Read in 'max_offer' mode. */
  targetProfit: number;
  loans: Loan[];
  holding: HoldingCosts;
  transaction: TransactionCosts;
  mode: FlipMode;
};

export type FlipResult = {
  /** The purchase price used: the input in 'profit' mode, the solution in 'max_offer'. */
  purchase: number;
  profit: number;

  loans: LoanBreakdown[];
  /** Interest + points + lender fees across every loan. */
  financing: number;
  loanInterest: number;
  loanPoints: number;
  lenderFees: number;
  downPayments: number;

  holding: number;
  buying: number;
  selling: number;
  /** buying + selling */
  transaction: number;

  totalCashNeeded: number;
  totalProjectCost: number;
  /** profit / ARV. Null when ARV is 0, rather than Infinity. */
  margin: number | null;
  /** profit / totalCashNeeded. Null when no cash is required. */
  cashOnCash: number | null;
};

// ---------------------------------------------------------------------------
// BRRRR
// ---------------------------------------------------------------------------

export type BrrrrInputs = {
  arv: number;
  repairs: number;
  maoPct: number;
  /** The purchase actually being modeled, which need not equal the MAO. */
  purchase: number;
  /** Buying closing costs as a ratio of (purchase + repairs). */
  closingPct: number;
  /** Refinance loan-to-value, as a ratio of ARV. */
  ltvPct: number;
  /** Annual rate on the refinance, as a ratio. */
  refiRatePct: number;
  refiTermYears: number;
  monthlyRent: number;
  /** Operating expenses as a ratio of rent: vacancy, repairs, management. */
  expensePct: number;
};

export type BrrrrResult = {
  /** ARV x MAO% - repairs. */
  mao: number;
  allIn: number;
  closingCosts: number;
  refiLoan: number;
  /** All-in minus the refinance proceeds. Negative means you pulled out more than you put in. */
  cashLeftIn: number;
  monthlyDebtService: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  /** Annual cash flow over cash left in. Null when nothing is left in the deal. */
  cashOnCash: number | null;
};

// ---------------------------------------------------------------------------
// Turnkey
// ---------------------------------------------------------------------------

export type TurnkeyInputs = {
  purchase: number;
  repairs: number;
  monthlyRent: number;
  expensePct: number;
  /** The cap rate a passive buyer will accept, as a ratio. */
  capRate: number;
  /** Selling costs as a ratio of the sale price. */
  sellingCostPct: number;
};

export type TurnkeyResult = {
  /** Net operating income, annualized. */
  noi: number;
  /** NOI / cap rate - what an income buyer pays. */
  salePrice: number;
  sellingCosts: number;
  profit: number;
  /** profit / (purchase + repairs). Null when nothing was invested. */
  returnOnCost: number | null;
};
