/**
 * MAO percentages - the rule of thumb an operator works in.
 *
 * The percentage a cash buyer pays against ARV is picked from a short list in
 * practice, not typed: 70% is the classic rule, and the rest are the standard
 * moves up and down from it for a hotter or colder market. Typing 0.7 into a
 * field is the wrong interaction for a value with eight real options.
 */

/** 50% to 85% in five-point steps, stored as ratios. */
export const MAO_PRESETS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85] as const;

/** The 70% rule. Used when an org has set no default of its own. */
export const DEFAULT_MAO_PCT = 0.7;

/** `0.7` -> `"70%"`. Presets are whole numbers, so no decimals are needed. */
export function maoLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * True when a ratio is one of the presets, within floating-point tolerance.
 * A stored 0.7000000000000001 must still light up the 70% button.
 */
export function isPreset(ratio: number): boolean {
  return MAO_PRESETS.some((preset) => Math.abs(preset - ratio) < 0.0005);
}

/**
 * The buyer's price at a given percentage: ARV x MAO% - repairs.
 *
 * This is the same chain as the wholesale model, exposed on its own so a
 * screen can price every preset at once without running a full analysis per
 * row.
 */
export function buyerPriceAt(arv: number, repairs: number, maoPct: number): number {
  return arv * maoPct - repairs;
}

export type MaoRung = {
  maoPct: number;
  label: string;
  buyerPrice: number;
  isCurrent: boolean;
};

/**
 * Every preset priced against one deal, for showing the ladder rather than
 * making someone tap through it.
 */
export function maoLadder(arv: number, repairs: number, current: number): MaoRung[] {
  return MAO_PRESETS.map((maoPct) => ({
    maoPct,
    label: maoLabel(maoPct),
    buyerPrice: buyerPriceAt(arv, repairs, maoPct),
    isCurrent: Math.abs(maoPct - current) < 0.0005,
  }));
}
