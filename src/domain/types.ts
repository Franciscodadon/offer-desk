/**
 * Domain records - PRD 9 data model.
 *
 * These are aliases of the Postgres row shapes rather than a parallel
 * camelCase model. One definition per record means a column added to a
 * migration cannot silently disagree with the type the screens use; the price
 * is snake_case field names in the UI, which is a fair trade for removing a
 * whole class of drift between three files.
 *
 * Semantic helpers that carry real logic live here too, since they belong to
 * the domain rather than to any screen.
 */
import type { Tables } from '@/lib/database.types';

import type { DealStatus } from './status';

export type Uuid = string;
/** ISO-8601 timestamp. */
export type Timestamp = string;
/** ISO-8601 date, no time component. */
export type DateOnly = string;

export type Org = Tables<'orgs'>;
export type User = Tables<'users'>;
export type Contact = Tables<'contacts'>;
export type Deal = Tables<'deals'>;
export type Property = Tables<'properties'>;
export type Analysis = Tables<'analyses'>;
export type Comp = Tables<'comps'>;
export type DocumentRecord = Tables<'documents'>;
export type Template = Tables<'templates'>;
export type EmailAccount = Tables<'email_accounts'>;
export type Activity = Tables<'activities'>;
export type Reminder = Tables<'reminders'>;
export type Subscription = Tables<'subscriptions'>;

export type OrgRole = User['role'];
export type ContactType = Contact['type'];
export type AnalysisStrategy = Analysis['strategy'];
export type DocumentType = DocumentRecord['type'];
export type TemplateKind = Template['kind'];
export type EmailProvider = EmailAccount['provider'];
export type EmailAccountStatus = EmailAccount['status'];

/**
 * Org-level defaults merged into new deals and LOIs. Stored as JSONB, so this
 * describes the shape rather than constraining it at the database level.
 */
export type DefaultTerms = {
  emd?: number;
  inspectionDays?: number;
  closeDays?: number;
  /** Assignment fee used to seed the wholesale analyzer. */
  assignmentFee?: number;
  /** Default MAO as a ratio, e.g. 0.7 for the 70% rule. */
  maoPct?: number;
  /** Negotiation buffer applied to the initial seller offer, as a ratio. */
  negotiationBuffer?: number;
};

/** Reads the org's default terms out of the JSONB column safely. */
export function readDefaultTerms(org: Pick<Org, 'default_terms'> | null | undefined): DefaultTerms {
  const raw = org?.default_terms;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  return raw as DefaultTerms;
}

/**
 * Offer price as a share of list price - shown on every pipeline row (PRD 7.2).
 * Null rather than 0 when either side is missing, so an unpriced deal shows a
 * dash instead of an alarming 0%.
 */
export function offerToList(
  deal: Pick<Deal, 'offer_price' | 'list_price'>,
): number | null {
  if (deal.offer_price == null || deal.list_price == null || deal.list_price === 0) {
    return null;
  }
  return deal.offer_price / deal.list_price;
}

/** A deal with the related rows the detail screen and pitch generator need. */
export type DealWithRelations = Deal & {
  property: Property | null;
  agent: Contact | null;
  comps: Comp[];
  analyses: Analysis[];
};

export type { DealStatus };
