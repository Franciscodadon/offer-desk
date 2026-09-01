/**
 * One editor per exit strategy - PRD 7.6.
 *
 * Each editor owns its own input state, recomputes on every keystroke (the
 * models are pure and cheap, so there is nothing to debounce), and reports the
 * current inputs and outputs upward so the screen can save a snapshot.
 *
 * Editors are mounted with a key derived from the stored row, so switching
 * strategy or loading a saved analysis re-seeds state through remount rather
 * than through an effect that writes state during render.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Text } from '@/components/ui';
import {
  analyzeBrrrr,
  analyzeFlip,
  flipLadder,
  analyzeTurnkey,
  analyzeWholesale,
  defaultLoan,
  verdictFor,
  VERDICT_THRESHOLDS,
  type BrrrrInputs,
  type FlipInputs,
  type Loan,
  type LoanBase,
  DEFAULT_MAO_PCT,
  type TurnkeyInputs,
  type WholesaleInputs,
} from '@/domain/analyzer';
import { formatMoney, formatPercent } from '@/lib/format';
import { spacing } from '@/theme/tokens';

import { MoneyInput, NumberInput, PercentInput, ResultRow, VerdictPill, fieldStyles } from './fields';
import { MaoPresets } from './MaoPresets';
import { OfferLadder } from './OfferLadder';

/** Reports the live inputs and computed outputs so the screen can save them. */
export type EditorReport<TInputs> = (state: {
  inputs: TInputs;
  computed: Record<string, unknown>;
}) => void;

// ---------------------------------------------------------------------------
// Wholesale
// ---------------------------------------------------------------------------

export function WholesaleEditor({
  initial,
  onChange,
}: {
  initial: WholesaleInputs;
  onChange: EditorReport<WholesaleInputs>;
}) {
  const [inputs, setInputs] = useState(initial);
  const result = analyzeWholesale(inputs);

  useEffect(() => {
    onChange({ inputs, computed: { ...result } });
    // `result` is derived from `inputs`, so inputs alone drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  const set = <K extends keyof WholesaleInputs>(key: K, value: WholesaleInputs[K]) =>
    setInputs((previous) => ({ ...previous, [key]: value }));

  return (
    <>
      <Card>
        <Text variant="label" tone="muted">
          Inputs
        </Text>
        <View style={fieldStyles.row}>
          <MoneyInput label="ARV" value={inputs.arv} onChange={(v) => set('arv', v)} />
          <MoneyInput
            label="Repairs"
            value={inputs.repairs}
            onChange={(v) => set('repairs', v)}
          />
        </View>
        <MaoPresets
          value={inputs.maoPct}
          onChange={(v) => set('maoPct', v)}
          buyerPrice={result.buyerPrice}
        />
        <View style={fieldStyles.row}>
          <MoneyInput
            label="Assignment fee"
            value={inputs.assignmentFee}
            onChange={(v) => set('assignmentFee', v)}
          />
          <PercentInput
            label="Negotiation buffer"
            value={inputs.negotiationBuffer}
            onChange={(v) => set('negotiationBuffer', v)}
            hint="Room below your MAO."
          />
        </View>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Results
        </Text>
        <ResultRow label="Open at" value={formatMoney(result.initialOffer)} emphasis />
        <ResultRow label="Your max contract (MAO)" value={formatMoney(result.mao)} />
        <ResultRow label="Sale price to buyer" value={formatMoney(result.buyerPrice)} />
        <ResultRow
          label="Your fee"
          value={formatMoney(result.fee)}
          tone={result.fee > 0 ? 'positive' : 'negative'}
        />
        {result.mao <= 0 ? (
          <Text variant="caption" tone="negative">
            Repairs and the buyer&apos;s rule leave nothing to contract for. This one
            does not work at this ARV.
          </Text>
        ) : null}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Fix & Flip
// ---------------------------------------------------------------------------

const LOAN_BASE_LABELS: Record<LoanBase, string> = {
  purchase: 'Purchase',
  repairs: 'Rehab',
  purchase_plus_repairs: 'Price + rehab',
  custom: 'Custom',
};

export function FlipEditor({
  initial,
  onChange,
}: {
  initial: FlipInputs;
  onChange: EditorReport<FlipInputs>;
}) {
  const [inputs, setInputs] = useState(initial);
  // The ladder is where the screen opens; the full model is one tap away.
  // Someone underwriting wants the comparison first and the audit second.
  const [showFullModel, setShowFullModel] = useState(false);
  const [maoPct, setMaoPct] = useState(DEFAULT_MAO_PCT);
  const result = analyzeFlip(inputs);
  const ladder = flipLadder(inputs, maoPct);

  useEffect(() => {
    onChange({ inputs, computed: { ...result } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  const set = <K extends keyof FlipInputs>(key: K, value: FlipInputs[K]) =>
    setInputs((previous) => ({ ...previous, [key]: value }));

  const setLoan = (index: number, patch: Partial<Loan>) =>
    setInputs((previous) => ({
      ...previous,
      loans: previous.loans.map((loan, i) => (i === index ? { ...loan, ...patch } : loan)),
    }));

  const marginVerdict = verdictFor(result.margin, VERDICT_THRESHOLDS.flipMargin);

  /** Takes the offer a rung prices into the model as a fixed purchase. */
  function takeRung(nextMaoPct: number) {
    const rung = ladder.rungs.find((candidate) => candidate.maoPct === nextMaoPct);
    setMaoPct(nextMaoPct);
    if (!rung?.viable) return;
    setInputs((previous) => ({ ...previous, mode: 'profit', purchase: rung.purchase }));
  }

  return (
    <>
      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted">
            Offer ladder
          </Text>
          <Button
            label={showFullModel ? 'Hide full model' : 'Full model'}
            variant="ghost"
            fullWidth={false}
            onPress={() => setShowFullModel((value) => !value)}
          />
        </View>
        <View style={fieldStyles.row}>
          <MoneyInput label="ARV" value={inputs.arv} onChange={(v) => set('arv', v)} />
          <MoneyInput
            label="Repairs"
            value={inputs.repairs}
            onChange={(v) => set('repairs', v)}
          />
        </View>
      </Card>

      <OfferLadder ladder={ladder} onSelect={takeRung} />

      {!showFullModel ? null : (
      <>
      <Card>
        <Text variant="label" tone="muted">
          Calculate my
        </Text>
        <View style={styles.chipRow}>
          <Chip
            label="Max offer"
            selected={inputs.mode === 'max_offer'}
            onPress={() => set('mode', 'max_offer')}
          />
          <Chip
            label="Profit"
            selected={inputs.mode === 'profit'}
            onPress={() => set('mode', 'profit')}
          />
        </View>
        <View style={fieldStyles.row}>
          {inputs.mode === 'max_offer' ? (
            <MoneyInput
              label="Target profit"
              value={inputs.targetProfit}
              onChange={(v) => set('targetProfit', v)}
            />
          ) : (
            <MoneyInput
              label="Purchase price"
              value={inputs.purchase}
              onChange={(v) => set('purchase', v)}
            />
          )}
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted">
            Financing
          </Text>
          <Button
            label="Add loan"
            variant="ghost"
            fullWidth={false}
            onPress={() =>
              setInputs((previous) => ({
                ...previous,
                loans: [...previous.loans, { ...defaultLoan }],
              }))
            }
          />
        </View>

        {inputs.loans.length === 0 ? (
          <Text variant="caption" tone="subtle">
            All cash. Add a loan to model financing costs.
          </Text>
        ) : null}

        {inputs.loans.map((loan, index) => (
          <View key={index} style={styles.loan}>
            <Text variant="caption" tone="muted">
              Financing of
            </Text>
            <View style={styles.chipRow}>
              {(Object.keys(LOAN_BASE_LABELS) as LoanBase[]).map((base) => (
                <Chip
                  key={base}
                  label={LOAN_BASE_LABELS[base]}
                  selected={loan.base === base}
                  onPress={() => setLoan(index, { base })}
                />
              ))}
            </View>

            {loan.base === 'custom' ? (
              <MoneyInput
                label="Custom amount"
                value={loan.customBase}
                onChange={(v) => setLoan(index, { customBase: v })}
              />
            ) : null}

            <View style={styles.chipRow}>
              <Chip
                label="Interest only"
                selected={loan.type === 'interest_only'}
                onPress={() => setLoan(index, { type: 'interest_only' })}
              />
              <Chip
                label="Amortized"
                selected={loan.type === 'amortized'}
                onPress={() => setLoan(index, { type: 'amortized' })}
              />
            </View>

            <View style={fieldStyles.row}>
              <PercentInput
                label="Down %"
                value={loan.downPct}
                onChange={(v) => setLoan(index, { downPct: v })}
              />
              <PercentInput
                label="Rate %"
                value={loan.ratePct}
                onChange={(v) => setLoan(index, { ratePct: v })}
              />
              <PercentInput
                label="Points %"
                value={loan.pointsPct}
                onChange={(v) => setLoan(index, { pointsPct: v })}
              />
              <MoneyInput
                label="Lender fees"
                value={loan.lenderFees}
                onChange={(v) => setLoan(index, { lenderFees: v })}
              />
              {loan.type === 'amortized' ? (
                <NumberInput
                  label="Term (years)"
                  value={loan.amortYears}
                  onChange={(v) => setLoan(index, { amortYears: v })}
                />
              ) : null}
            </View>

            {inputs.loans.length > 1 ? (
              <Button
                label="Remove loan"
                variant="ghost"
                fullWidth={false}
                onPress={() =>
                  setInputs((previous) => ({
                    ...previous,
                    loans: previous.loans.filter((_, i) => i !== index),
                  }))
                }
              />
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Holding costs (per month)
        </Text>
        <View style={fieldStyles.row}>
          <MoneyInput
            label="Taxes"
            value={inputs.holding.taxes}
            onChange={(v) => set('holding', { ...inputs.holding, taxes: v })}
          />
          <MoneyInput
            label="Insurance"
            value={inputs.holding.insurance}
            onChange={(v) => set('holding', { ...inputs.holding, insurance: v })}
          />
          <MoneyInput
            label="Utilities"
            value={inputs.holding.utilities}
            onChange={(v) => set('holding', { ...inputs.holding, utilities: v })}
          />
          <MoneyInput
            label="HOA"
            value={inputs.holding.hoa}
            onChange={(v) => set('holding', { ...inputs.holding, hoa: v })}
          />
          <MoneyInput
            label="Other"
            value={inputs.holding.other}
            onChange={(v) => set('holding', { ...inputs.holding, other: v })}
          />
          <NumberInput
            label="Months held"
            value={inputs.holding.months}
            onChange={(v) => set('holding', { ...inputs.holding, months: v })}
          />
        </View>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Transaction costs
        </Text>
        <View style={fieldStyles.row}>
          <PercentInput
            label="Agent %"
            value={inputs.transaction.agentPct}
            onChange={(v) => set('transaction', { ...inputs.transaction, agentPct: v })}
          />
          <PercentInput
            label="Transfer %"
            value={inputs.transaction.transferPct}
            onChange={(v) => set('transaction', { ...inputs.transaction, transferPct: v })}
          />
          <MoneyInput
            label="Buying costs"
            value={inputs.transaction.buyingFlat}
            onChange={(v) => set('transaction', { ...inputs.transaction, buyingFlat: v })}
          />
          <MoneyInput
            label="Selling costs"
            value={inputs.transaction.sellingFlat}
            onChange={(v) => set('transaction', { ...inputs.transaction, sellingFlat: v })}
          />
          <MoneyInput
            label="Buyer credits"
            value={inputs.transaction.buyerCredits}
            onChange={(v) => set('transaction', { ...inputs.transaction, buyerCredits: v })}
          />
        </View>
      </Card>

      </>
      )}

      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted">
            Results
          </Text>
          <VerdictPill verdict={marginVerdict} />
        </View>

        <ResultRow
          label={inputs.mode === 'max_offer' ? 'Max offer' : 'Purchase'}
          value={formatMoney(result.purchase)}
          emphasis
        />
        <ResultRow
          label="Profit"
          value={formatMoney(result.profit)}
          tone={result.profit >= 0 ? 'positive' : 'negative'}
        />
        <ResultRow label="Profit margin" value={formatPercent(result.margin)} />
        <ResultRow label="Cash on cash" value={formatPercent(result.cashOnCash, 0)} />
        <ResultRow label="Total cash needed" value={formatMoney(result.totalCashNeeded)} />
        <ResultRow label="Total project cost" value={formatMoney(result.totalProjectCost)} />

        <View style={styles.spacer} />

        <ResultRow label="Loan interest" value={formatMoney(result.loanInterest)} tone="muted" />
        <ResultRow label="Points and fees" value={formatMoney(result.loanPoints + result.lenderFees)} tone="muted" />
        <ResultRow label="Holding" value={formatMoney(result.holding)} tone="muted" />
        <ResultRow label="Transaction" value={formatMoney(result.transaction)} tone="muted" />
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// BRRRR
// ---------------------------------------------------------------------------

export function BrrrrEditor({
  initial,
  onChange,
}: {
  initial: BrrrrInputs;
  onChange: EditorReport<BrrrrInputs>;
}) {
  const [inputs, setInputs] = useState(initial);
  const result = analyzeBrrrr(inputs);

  useEffect(() => {
    onChange({ inputs, computed: { ...result } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  const set = <K extends keyof BrrrrInputs>(key: K, value: BrrrrInputs[K]) =>
    setInputs((previous) => ({ ...previous, [key]: value }));

  return (
    <>
      <Card>
        <Text variant="label" tone="muted">
          Buy and rehab
        </Text>
        <View style={fieldStyles.row}>
          <MoneyInput label="ARV" value={inputs.arv} onChange={(v) => set('arv', v)} />
          <MoneyInput label="Repairs" value={inputs.repairs} onChange={(v) => set('repairs', v)} />
          <MoneyInput label="Purchase" value={inputs.purchase} onChange={(v) => set('purchase', v)} />
        </View>
        <View style={fieldStyles.row}>
          <PercentInput
            label="Closing %"
            value={inputs.closingPct}
            onChange={(v) => set('closingPct', v)}
            hint="Of price + rehab."
          />
        </View>
      </Card>

      <Card>
        <MaoPresets
          value={inputs.maoPct}
          onChange={(v) => set('maoPct', v)}
          buyerPrice={result.mao}
          label="MAO percentage"
        />
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Refinance and rent
        </Text>
        <View style={fieldStyles.row}>
          <PercentInput label="Refi LTV %" value={inputs.ltvPct} onChange={(v) => set('ltvPct', v)} />
          <PercentInput label="Refi rate %" value={inputs.refiRatePct} onChange={(v) => set('refiRatePct', v)} />
          <NumberInput label="Term (years)" value={inputs.refiTermYears} onChange={(v) => set('refiTermYears', v)} />
        </View>
        <View style={fieldStyles.row}>
          <MoneyInput label="Monthly rent" value={inputs.monthlyRent} onChange={(v) => set('monthlyRent', v)} />
          <PercentInput
            label="Expenses %"
            value={inputs.expensePct}
            onChange={(v) => set('expensePct', v)}
            hint="Vacancy, repairs, management."
          />
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted">
            Results
          </Text>
          <VerdictPill verdict={verdictFor(result.cashOnCash, VERDICT_THRESHOLDS.brrrrCashOnCash)} />
        </View>

        <ResultRow label="MAO" value={formatMoney(result.mao)} emphasis />
        <ResultRow label="All in" value={formatMoney(result.allIn)} />
        <ResultRow label="Refinance loan" value={formatMoney(result.refiLoan)} />
        <ResultRow
          label="Cash left in deal"
          value={formatMoney(result.cashLeftIn)}
          tone={result.cashLeftIn <= 0 ? 'positive' : 'default'}
        />
        <ResultRow
          label="Monthly cash flow"
          value={formatMoney(result.monthlyCashFlow)}
          tone={result.monthlyCashFlow >= 0 ? 'positive' : 'negative'}
        />
        <ResultRow label="Cash on cash" value={formatPercent(result.cashOnCash)} />

        {result.cashLeftIn <= 0 ? (
          <Text variant="caption" tone="muted">
            The refinance returns more than went in, so there is no cash left to
            measure a return against. That is the strategy working, not an error.
          </Text>
        ) : null}
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// Turnkey
// ---------------------------------------------------------------------------

export function TurnkeyEditor({
  initial,
  onChange,
}: {
  initial: TurnkeyInputs;
  onChange: EditorReport<TurnkeyInputs>;
}) {
  const [inputs, setInputs] = useState(initial);
  const result = analyzeTurnkey(inputs);

  useEffect(() => {
    onChange({ inputs, computed: { ...result } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs]);

  const set = <K extends keyof TurnkeyInputs>(key: K, value: TurnkeyInputs[K]) =>
    setInputs((previous) => ({ ...previous, [key]: value }));

  return (
    <>
      <Card>
        <Text variant="label" tone="muted">
          Inputs
        </Text>
        <View style={fieldStyles.row}>
          <MoneyInput label="Purchase" value={inputs.purchase} onChange={(v) => set('purchase', v)} />
          <MoneyInput label="Repairs" value={inputs.repairs} onChange={(v) => set('repairs', v)} />
        </View>
        <View style={fieldStyles.row}>
          <MoneyInput label="Monthly rent" value={inputs.monthlyRent} onChange={(v) => set('monthlyRent', v)} />
          <PercentInput label="Expenses %" value={inputs.expensePct} onChange={(v) => set('expensePct', v)} />
        </View>
        <View style={fieldStyles.row}>
          <PercentInput
            label="Buyer cap rate %"
            value={inputs.capRate}
            onChange={(v) => set('capRate', v)}
            hint="What a passive buyer accepts."
          />
          <PercentInput
            label="Selling costs %"
            value={inputs.sellingCostPct}
            onChange={(v) => set('sellingCostPct', v)}
          />
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Text variant="label" tone="muted">
            Results
          </Text>
          <VerdictPill verdict={verdictFor(result.returnOnCost, VERDICT_THRESHOLDS.turnkeyReturnOnCost)} />
        </View>

        <ResultRow label="Sale price to buyer" value={formatMoney(result.salePrice)} emphasis />
        <ResultRow label="Annual NOI" value={formatMoney(result.noi)} />
        <ResultRow label="Selling costs" value={formatMoney(result.sellingCosts)} tone="muted" />
        <ResultRow
          label="Profit"
          value={formatMoney(result.profit)}
          tone={result.profit >= 0 ? 'positive' : 'negative'}
        />
        <ResultRow label="Return on cost" value={formatPercent(result.returnOnCost)} />

        {inputs.capRate <= 0 ? (
          <Text variant="caption" tone="negative">
            Enter a cap rate above zero. At zero there is no price an income buyer
            would pay.
          </Text>
        ) : null}
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  loan: { gap: spacing.sm, paddingVertical: spacing.sm },
  // Separates headline results from the cost breakdown below them.
  spacer: { height: spacing.sm },
});
