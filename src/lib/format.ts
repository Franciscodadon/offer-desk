/**
 * Money, percent, and date formatting.
 *
 * The analyzer's rule is that displayed figures are rounded for reading but
 * never for math - callers pass exact numbers and format at the edge.
 */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdCents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `$237,483`. Whole dollars, the default everywhere in the app. */
export function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return usd.format(Math.round(value));
}

/** `$1,234.56`. Only where cents matter, such as per-sqft figures. */
export function formatMoneyCents(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return usdCents.format(value);
}

/**
 * `14.0%`. Takes a ratio (0.14), not a percentage number.
 */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio == null || !Number.isFinite(ratio)) return '--';
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** `1,850` - counts, sqft, and other bare numbers. */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '--';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** `Aug 31, 2026` from an ISO date or timestamp. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '--';
  const date = parseDate(value);
  if (!date) return '--';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Parses an ISO date (`2026-08-31`) or timestamp without letting a bare date
 * shift a day backwards in negative-offset time zones.
 */
export function parseDate(value: string): Date | null {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `2026-08-31` in UTC - the storage form for date-only columns. */
export function toDateOnly(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Pulls a number out of user input that may carry `$`, commas, or `%`.
 * Returns null for anything that is not a finite number, so a half-typed
 * field never silently becomes 0 in the deal math.
 */
export function parseNumericInput(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = input.replace(/[$,\s%]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}
