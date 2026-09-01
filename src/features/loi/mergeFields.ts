/**
 * Merge fields for LOIs and outreach email - PRD 7.4.
 *
 * The engine is deliberately small and strict. An LOI is a document a real
 * agent reads with a real offer on it, so the failure that matters is not a
 * crash: it is a letter that goes out with a blank where the purchase price
 * should be, or with a raw `{{buyer_entity}}` sitting in the middle of a
 * sentence. Both are caught here rather than discovered by the recipient.
 *
 * Rules:
 *   - Rendering never invents a value. A field with no data is reported as
 *     missing and the caller decides whether to send.
 *   - Money and dates are formatted at merge time, so a template author never
 *     has to think about units or locale.
 */
import type { Contact, Deal, Org, Property } from '@/domain/types';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';

/** Terms a user can adjust per deal before generating (PRD 7.4). */
export type LoiTerms = {
  purchasePrice: number | null;
  earnestMoney: number | null;
  inspectionDays: number | null;
  closeDays: number | null;
  /** Free text appended as an extra paragraph. Optional. */
  additionalTerms: string;
  /** Date the letter is dated. Defaults to today. */
  letterDate: string;
  /** How long the offer stands, in days. */
  offerValidDays: number | null;
};

export type MergeContext = {
  org: Pick<
    Org,
    'name' | 'buyer_entity' | 'signatory_name' | 'signatory_title' | 'logo_url'
  >;
  deal: Pick<Deal, 'address' | 'city' | 'state' | 'zip' | 'parcel_id' | 'mls' | 'list_price'>;
  property: Pick<Property, 'beds' | 'baths' | 'sqft' | 'year_built' | 'is_vacant'> | null;
  agent: Pick<Contact, 'name' | 'brokerage' | 'email' | 'phone'> | null;
  terms: LoiTerms;
};

/** Every field a template may reference. */
export type MergeFieldKey =
  | 'agent_name'
  | 'agent_brokerage'
  | 'agent_email'
  | 'buyer_entity'
  | 'close_days'
  | 'company_name'
  | 'earnest_money'
  | 'full_address'
  | 'inspection_days'
  | 'letter_date'
  | 'list_price'
  | 'mls'
  | 'offer_valid_days'
  | 'parcel_id'
  | 'property_address'
  | 'property_beds'
  | 'property_baths'
  | 'property_sqft'
  | 'property_year'
  | 'purchase_price'
  | 'signatory_name'
  | 'signatory_title';

type FieldSpec = {
  /** Human label, used in the missing-field report. */
  label: string;
  /** Reads the value. Return null when there is nothing to say. */
  read: (context: MergeContext) => string | null;
  /**
   * A letter is not fit to send without this. Optional fields simply resolve to
   * an empty string and the surrounding sentence is written to survive it.
   */
  required: boolean;
};

const FIELDS: Record<MergeFieldKey, FieldSpec> = {
  agent_name: {
    label: 'Listing agent name',
    read: ({ agent }) => agent?.name ?? null,
    // Addressed as "Dear Property Owner or Representative" when unknown.
    required: false,
  },
  agent_brokerage: {
    label: 'Brokerage',
    read: ({ agent }) => agent?.brokerage ?? null,
    required: false,
  },
  agent_email: {
    label: 'Agent email',
    read: ({ agent }) => agent?.email ?? null,
    required: false,
  },
  buyer_entity: {
    label: 'Buyer entity',
    read: ({ org }) => org.buyer_entity ?? org.name ?? null,
    required: true,
  },
  close_days: {
    label: 'Days to close',
    read: ({ terms }) =>
      terms.closeDays == null ? null : formatNumber(terms.closeDays),
    required: true,
  },
  company_name: {
    label: 'Company name',
    read: ({ org }) => org.name ?? null,
    required: true,
  },
  earnest_money: {
    label: 'Earnest money deposit',
    read: ({ terms }) =>
      terms.earnestMoney == null ? null : formatMoney(terms.earnestMoney),
    required: true,
  },
  full_address: {
    label: 'Property address',
    read: ({ deal }) => {
      const locality = [deal.city, deal.state].filter(Boolean).join(', ');
      const tail = [locality, deal.zip].filter(Boolean).join(' ');
      return [deal.address, tail].filter(Boolean).join(', ') || null;
    },
    required: true,
  },
  inspection_days: {
    label: 'Inspection period',
    read: ({ terms }) =>
      terms.inspectionDays == null ? null : formatNumber(terms.inspectionDays),
    required: true,
  },
  letter_date: {
    label: 'Letter date',
    read: ({ terms }) => (terms.letterDate ? formatDate(terms.letterDate) : null),
    required: true,
  },
  list_price: {
    label: 'List price',
    read: ({ deal }) => (deal.list_price == null ? null : formatMoney(deal.list_price)),
    required: false,
  },
  mls: { label: 'MLS number', read: ({ deal }) => deal.mls ?? null, required: false },
  offer_valid_days: {
    label: 'Offer valid for',
    read: ({ terms }) =>
      terms.offerValidDays == null ? null : formatNumber(terms.offerValidDays),
    required: false,
  },
  parcel_id: {
    label: 'Parcel ID',
    read: ({ deal }) => deal.parcel_id ?? null,
    required: false,
  },
  property_address: {
    label: 'Street address',
    read: ({ deal }) => deal.address ?? null,
    required: true,
  },
  property_beds: {
    label: 'Beds',
    read: ({ property }) =>
      property?.beds == null ? null : formatNumber(property.beds),
    required: false,
  },
  property_baths: {
    label: 'Baths',
    read: ({ property }) =>
      property?.baths == null ? null : formatNumber(property.baths),
    required: false,
  },
  property_sqft: {
    label: 'Square feet',
    read: ({ property }) =>
      property?.sqft == null ? null : formatNumber(property.sqft),
    required: false,
  },
  property_year: {
    label: 'Year built',
    read: ({ property }) =>
      property?.year_built == null ? null : String(property.year_built),
    required: false,
  },
  purchase_price: {
    label: 'Purchase price',
    read: ({ terms }) =>
      terms.purchasePrice == null ? null : formatMoney(terms.purchasePrice),
    required: true,
  },
  signatory_name: {
    label: 'Signatory name',
    read: ({ org }) => org.signatory_name ?? null,
    required: true,
  },
  signatory_title: {
    label: 'Signatory title',
    read: ({ org }) => org.signatory_title ?? null,
    required: false,
  },
};

export const MERGE_FIELD_KEYS = Object.keys(FIELDS) as MergeFieldKey[];

export function isMergeFieldKey(key: string): key is MergeFieldKey {
  return key in FIELDS;
}

export type MissingField = { key: MergeFieldKey; label: string; required: boolean };

export type RenderResult = {
  text: string;
  /** Fields the template asked for that had no value. */
  missing: MissingField[];
  /** True when nothing required is missing, i.e. the letter is fit to send. */
  complete: boolean;
  /** Template placeholders that are not real fields, i.e. author typos. */
  unknownFields: string[];
};

/** Matches `{{field_name}}`, tolerating internal spaces. */
const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/**
 * Fills a template's placeholders.
 *
 * An unknown placeholder is removed rather than left in the letter: a stray
 * `{{buyer_entty}}` reaching an agent is worse than a missing clause, and it is
 * reported so the template can be fixed.
 */
export function renderTemplate(template: string, context: MergeContext): RenderResult {
  const missing: MissingField[] = [];
  const unknownFields: string[] = [];
  const seen = new Set<string>();

  const text = template.replace(PLACEHOLDER, (_match, rawKey: string) => {
    const key = rawKey.toLowerCase();

    if (!isMergeFieldKey(key)) {
      if (!unknownFields.includes(key)) unknownFields.push(key);
      return '';
    }

    const spec = FIELDS[key];
    const value = spec.read(context);

    if (value == null || value.trim() === '') {
      if (!seen.has(key)) {
        seen.add(key);
        missing.push({ key, label: spec.label, required: spec.required });
      }
      return '';
    }

    return value;
  });

  return {
    text: tidy(text),
    missing,
    complete: missing.every((field) => !field.required),
    unknownFields,
  };
}

/**
 * Cleans up after removed placeholders so a dropped optional field does not
 * leave a double space, a stranded comma, or a blank line in the middle of a
 * paragraph.
 */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ ,/g, ',')
    .replace(/\(\s*\)/g, '')
    .replace(/ +\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/** Lists the field keys a template references, for a preview or an editor. */
export function fieldsUsedBy(template: string): string[] {
  const keys: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const key = match[1].toLowerCase();
    if (!keys.includes(key)) keys.push(key);
  }
  return keys;
}
