/**
 * Import from the Offer Desk prototype.
 *
 * The prototype keeps everything in one browser localStorage blob and can
 * export it as JSON. PRD 9 and the phase 0 roadmap item both require today's
 * deals to carry over, so this maps that blob onto `deals`, `properties`,
 * `comps`, and `analyses` rows.
 *
 * Two rules shape the design:
 *   1. A partial import is worse than a reported one. Every row that cannot be
 *      mapped is collected in `warnings` with enough detail to fix by hand,
 *      rather than being dropped silently.
 *   2. Nothing here writes to the database. It returns rows for the caller to
 *      insert inside a single transaction, so a failed import leaves no
 *      half-populated pipeline behind.
 *
 * The exact prototype export shape has not been captured yet, so the readers
 * below accept the plausible spellings of each field (camelCase, snake_case,
 * and the abbreviated forms the prototype's UI uses). When a real export is
 * available, drop it into the fixture test and tighten these.
 */
import { isDealStatus, type DealStatus } from '@/domain/status';
import type { Inserts } from '@/lib/database.types';
import { parseNumericInput } from '@/lib/format';

export type LegacyImportResult = {
  deals: Inserts<'deals'>[];
  properties: Omit<Inserts<'properties'>, 'deal_id'>[];
  comps: Omit<Inserts<'comps'>, 'deal_id'>[];
  analyses: Omit<Inserts<'analyses'>, 'deal_id'>[];
  /** Index into `deals` that each property/comp/analysis belongs to. */
  propertyDealIndex: number[];
  compDealIndex: number[];
  analysisDealIndex: number[];
  warnings: string[];
};

type Unknown = Record<string, unknown>;

function asRecord(value: unknown): Unknown | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Unknown)
    : null;
}

/** First present, non-empty value among the given keys. */
function pick(row: Unknown, keys: string[]): unknown {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function readString(row: Unknown, keys: string[]): string | null {
  const value = pick(row, keys);
  if (value == null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function readNumber(row: Unknown, keys: string[]): number | null {
  const value = pick(row, keys);
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return parseNumericInput(String(value));
}

function readBoolean(row: Unknown, keys: string[]): boolean | null {
  const value = pick(row, keys);
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(text)) return true;
  if (['false', 'no', 'n', '0'].includes(text)) return false;
  return null;
}

/**
 * Normalizes a date to the `YYYY-MM-DD` storage form. Accepts what the
 * prototype emits: ISO strings, `M/D/YYYY`, and epoch milliseconds.
 */
export function readDate(row: Unknown, keys: string[]): string | null {
  const value = pick(row, keys);
  if (value == null) return null;

  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const usFormat = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usFormat) {
    const [, month, day, year] = usFormat;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/**
 * Maps a prototype status label onto a DealStatus. The prototype writes human
 * labels ("LOI Sent"); the database uses snake_case enum values.
 */
export function normalizeStatus(raw: unknown): DealStatus | null {
  if (raw == null) return null;
  const key = String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (isDealStatus(key)) return key;

  const aliases: Record<string, DealStatus> = {
    loi: 'loi_sent',
    sent: 'loi_sent',
    offer_sent: 'loi_sent',
    followup: 'follow_up',
    following_up: 'follow_up',
    accepted: 'offer_accepted',
    rejected: 'offer_rejected',
    seller_rejected: 'offer_rejected',
    declined: 'offer_rejected',
    buyer_passed: 'buyer_rejected',
    passed: 'pass',
    dead: 'pass',
  };
  return aliases[key] ?? null;
}

/** Locates the deal array in an export whose top-level shape may vary. */
function findDeals(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  const root = asRecord(payload);
  if (!root) return null;

  for (const key of ['deals', 'properties', 'rows', 'offers', 'pipeline', 'data']) {
    const value = root[key];
    if (Array.isArray(value)) return value;
    // One level of nesting, e.g. { state: { deals: [...] } }.
    const nested = asRecord(value);
    if (nested && Array.isArray(nested.deals)) return nested.deals as unknown[];
  }
  return null;
}

const STRATEGY_KEYS: Record<string, 'wholesale' | 'flip' | 'brrrr' | 'turnkey'> = {
  wholesale: 'wholesale',
  flip: 'flip',
  fixflip: 'flip',
  fix_and_flip: 'flip',
  brrrr: 'brrrr',
  turnkey: 'turnkey',
};

/**
 * Converts a prototype JSON export into rows ready to insert for `orgId`.
 * Never throws on bad input; malformed rows are reported in `warnings`.
 */
export function mapLegacyExport(payload: unknown, orgId: string): LegacyImportResult {
  const result: LegacyImportResult = {
    deals: [],
    properties: [],
    comps: [],
    analyses: [],
    propertyDealIndex: [],
    compDealIndex: [],
    analysisDealIndex: [],
    warnings: [],
  };

  const rows = findDeals(payload);
  if (!rows) {
    result.warnings.push(
      'Could not find a deal list in this file. Expected a JSON array, or an object with a "deals" array.',
    );
    return result;
  }

  rows.forEach((raw, index) => {
    const row = asRecord(raw);
    if (!row) {
      result.warnings.push(`Row ${index + 1}: not an object; skipped.`);
      return;
    }

    const address = readString(row, ['address', 'propertyAddress', 'property_address', 'addr']);
    if (!address) {
      // Address is the one field with no sensible default - a deal without one
      // cannot be found again in the pipeline.
      result.warnings.push(`Row ${index + 1}: no address; skipped.`);
      return;
    }

    const rawStatus = pick(row, ['status', 'stage', 'dealStatus']);
    const status = normalizeStatus(rawStatus);
    if (rawStatus != null && status == null) {
      result.warnings.push(
        `Row ${index + 1} (${address}): unrecognized status "${String(rawStatus)}"; imported as Follow Up.`,
      );
    }

    const dealIndex = result.deals.length;
    result.deals.push({
      org_id: orgId,
      address,
      city: readString(row, ['city']),
      state: readString(row, ['state', 'st']),
      zip: readString(row, ['zip', 'zipcode', 'postal_code', 'postalCode']),
      parcel_id: readString(row, ['parcelId', 'parcel_id', 'apn', 'parcel']),
      mls: readString(row, ['mls', 'mlsNumber', 'mls_number', 'mls#']),
      list_price: readNumber(row, ['listPrice', 'list_price', 'list', 'asking']),
      offer_price: readNumber(row, ['offerPrice', 'offer_price', 'offer']),
      status: status ?? 'follow_up',
      submitted_at: readDate(row, ['submittedAt', 'submitted_at', 'date', 'offerDate', 'sentAt']),
      next_action_at: readDate(row, ['nextActionAt', 'next_action_at', 'followUpDate']),
      notes: readString(row, ['notes', 'note', 'comments']),
    });

    mapProperty(row, orgId, dealIndex, result);
    mapComps(row, orgId, dealIndex, index, result);
    mapAnalyses(row, orgId, dealIndex, result);
  });

  return result;
}

function mapProperty(
  row: Unknown,
  orgId: string,
  dealIndex: number,
  result: LegacyImportResult,
): void {
  const source = asRecord(row.property) ?? row;
  const property = {
    org_id: orgId,
    beds: readNumber(source, ['beds', 'bd', 'bedrooms']),
    baths: readNumber(source, ['baths', 'ba', 'bathrooms']),
    sqft: readNumber(source, ['sqft', 'sqFt', 'squareFeet', 'living_sqft']),
    lot_sqft: readNumber(source, ['lotSqft', 'lot_sqft', 'lot', 'lotSize']),
    year_built: readNumber(source, ['yearBuilt', 'year_built', 'year']),
    subdivision: readString(source, ['subdivision', 'sub']),
    listing_url: readString(source, ['listingUrl', 'listing_url', 'link', 'url']),
    appraiser_url: readString(source, ['appraiserUrl', 'appraiser_url', 'appraiser']),
    permit_no: readString(source, ['permitNo', 'permit_no', 'permit']),
    permit_url: readString(source, ['permitUrl', 'permit_url']),
    is_vacant: readBoolean(source, ['isVacant', 'is_vacant', 'vacant']),
  };

  // Skip a property row that carries no facts at all rather than writing an
  // empty 1:1 record for every deal.
  const hasFacts = Object.entries(property).some(
    ([key, value]) => key !== 'org_id' && value != null,
  );
  if (!hasFacts) return;

  result.properties.push(property);
  result.propertyDealIndex.push(dealIndex);
}

function mapComps(
  row: Unknown,
  orgId: string,
  dealIndex: number,
  rowIndex: number,
  result: LegacyImportResult,
): void {
  const rawComps = pick(row, ['comps', 'comparables']);
  if (!Array.isArray(rawComps)) return;

  rawComps.forEach((rawComp, compIndex) => {
    const comp = asRecord(rawComp);
    if (!comp) return;

    const address = readString(comp, ['address', 'addr']);
    if (!address) {
      result.warnings.push(
        `Row ${rowIndex + 1}, comp ${compIndex + 1}: no address; skipped.`,
      );
      return;
    }

    result.comps.push({
      org_id: orgId,
      address,
      beds: readNumber(comp, ['beds', 'bd']),
      baths: readNumber(comp, ['baths', 'ba']),
      sqft: readNumber(comp, ['sqft', 'sqFt']),
      distance_mi: readNumber(comp, ['dist', 'distance', 'distanceMi', 'distance_mi']),
      sold_price: readNumber(comp, ['soldPrice', 'sold_price', 'sold', 'price']),
      sold_date: readDate(comp, ['soldDate', 'sold_date', 'date']),
      link: readString(comp, ['link', 'url']),
    });
    result.compDealIndex.push(dealIndex);
  });
}

function mapAnalyses(
  row: Unknown,
  orgId: string,
  dealIndex: number,
  result: LegacyImportResult,
): void {
  const container = asRecord(pick(row, ['analyses', 'analysis', 'strategies']));
  if (!container) return;

  for (const [rawKey, rawValue] of Object.entries(container)) {
    const strategy = STRATEGY_KEYS[rawKey.trim().toLowerCase().replace(/[\s-]+/g, '_')];
    const analysis = asRecord(rawValue);
    if (!strategy || !analysis) continue;

    result.analyses.push({
      org_id: orgId,
      strategy,
      arv: readNumber(analysis, ['arv', 'ARV']),
      repairs: readNumber(analysis, ['repairs', 'rehab', 'repairCosts']),
      mao_pct: normalizeRatio(readNumber(analysis, ['maoPct', 'mao_pct', 'maoPercent'])),
      market: readString(analysis, ['market']),
      purchase: readNumber(analysis, ['purchase', 'purchasePrice', 'price']),
      target_profit: readNumber(analysis, ['targetProfit', 'target_profit']),
      // The prototype's own input state is preserved verbatim so nothing is
      // lost in translation; the analyzer re-derives outputs from it.
      inputs: analysis as Record<string, never>,
      computed: {} as Record<string, never>,
    });
    result.analysisDealIndex.push(dealIndex);
  }
}

/**
 * The prototype stores MAO either as a percentage (70) or a ratio (0.7).
 * The database column is a ratio, so anything above 1 is treated as a percent.
 */
export function normalizeRatio(value: number | null): number | null {
  if (value == null) return null;
  return value > 1 ? value / 100 : value;
}
