import {
  EMPTY_VALUE,
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  parseNumericInput,
  toDateOnly,
} from '../format';

describe('formatMoney', () => {
  it('renders whole dollars', () => {
    expect(formatMoney(237483)).toBe('$237,483');
  });

  it('rounds rather than truncating', () => {
    expect(formatMoney(237482.6)).toBe('$237,483');
  });

  it('renders a placeholder for missing values', () => {
    expect(formatMoney(null)).toBe(EMPTY_VALUE);
    expect(formatMoney(undefined)).toBe(EMPTY_VALUE);
    expect(formatMoney(Number.NaN)).toBe(EMPTY_VALUE);
  });

  it('uses a single-glyph placeholder, so tabular figures do not space it out', () => {
    expect(EMPTY_VALUE).toHaveLength(1);
  });
});

describe('formatPercent', () => {
  it('takes a ratio and renders one decimal by default', () => {
    expect(formatPercent(0.14)).toBe('14.0%');
  });

  it('honors a digit override', () => {
    expect(formatPercent(0.4923, 0)).toBe('49%');
  });
});

describe('formatNumber', () => {
  it('groups thousands', () => {
    expect(formatNumber(1850)).toBe('1,850');
  });
});

describe('formatDate', () => {
  it('does not shift a bare date across a time-zone boundary', () => {
    expect(formatDate('2026-08-31')).toBe('Aug 31, 2026');
  });

  it('renders the placeholder for a missing date', () => {
    expect(formatDate(null)).toBe(EMPTY_VALUE);
    expect(formatDate('not a date')).toBe(EMPTY_VALUE);
  });
});

describe('toDateOnly', () => {
  it('emits the storage form', () => {
    expect(toDateOnly(new Date('2026-08-31T18:30:00Z'))).toBe('2026-08-31');
  });
});

describe('parseNumericInput', () => {
  it('strips currency and grouping characters', () => {
    expect(parseNumericInput('$357,244')).toBe(357244);
    expect(parseNumericInput('12.5%')).toBe(12.5);
  });

  it('returns null for partial input instead of zero', () => {
    expect(parseNumericInput('')).toBeNull();
    expect(parseNumericInput('-')).toBeNull();
    expect(parseNumericInput('.')).toBeNull();
    expect(parseNumericInput('abc')).toBeNull();
  });
});
