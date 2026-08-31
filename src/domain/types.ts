/**
 * Domain records - PRD 9 data model.
 *
 * These are the shapes the app works with. `src/lib/database.types.ts` holds the
 * literal Postgres row shapes the Supabase client returns; the two are kept in
 * sync by hand until the schema is stable enough to generate types from.
 */
import type { DealStatus } from './status';

export type Uuid = string;
/** ISO-8601 timestamp. */
export type Timestamp = string;
/** ISO-8601 date, no time component. */
export type DateOnly = string;

export type OrgRole = 'owner' | 'admin' | 'member';
export type ContactType = 'listing_agent' | 'buyer' | 'seller' | 'lender' | 'title' | 'other';
export type AnalysisStrategy = 'wholesale' | 'flip' | 'brrrr' | 'turnkey';
export type DocumentType = 'loi' | 'pof' | 'pitch' | 'other';
export type TemplateKind = 'loi' | 'email';
export type EmailProvider = 'gmail' | 'outlook';
export type EmailAccountStatus = 'connected' | 'needs_reauth' | 'revoked';

/** Fields every table carries (PRD 9: timestamps + soft delete on all). */
type Base = {
  id: Uuid;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt: Timestamp | null;
};

/** Everything except `orgs` itself is scoped to an org for RLS isolation. */
type OrgScoped = Base & { orgId: Uuid };

export type Org = Base & {
  name: string;
  logoUrl: string | null;
  signatoryName: string | null;
  signatoryTitle: string | null;
  buyerEntity: string | null;
  /** Default LOI terms merged into new deals: EMD, inspection days, close days. */
  defaultTerms: DefaultTerms;
  plan: string;
};

export type DefaultTerms = {
  emd?: number;
  inspectionDays?: number;
  closeDays?: number;
  /** Assignment fee used to seed the wholesale analyzer. */
  assignmentFee?: number;
  /** Default MAO percentage, e.g. 0.7 for the 70% rule. */
  maoPct?: number;
  /** Negotiation buffer applied to the initial seller offer. */
  negotiationBuffer?: number;
};

export type User = OrgScoped & {
  email: string;
  name: string | null;
  role: OrgRole;
  authProvider: string | null;
};

export type Contact = OrgScoped & {
  name: string;
  brokerage: string | null;
  phone: string | null;
  email: string | null;
  type: ContactType;
};

export type Deal = OrgScoped & {
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  parcelId: string | null;
  mls: string | null;
  agentId: Uuid | null;
  listPrice: number | null;
  offerPrice: number | null;
  status: DealStatus;
  /** Date the offer went out. Drives the weekly KPI count. */
  submittedAt: DateOnly | null;
  nextActionAt: DateOnly | null;
  assigneeId: Uuid | null;
  notes: string | null;
};

export type Property = OrgScoped & {
  dealId: Uuid;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  subdivision: string | null;
  listingUrl: string | null;
  appraiserUrl: string | null;
  permitNo: string | null;
  permitUrl: string | null;
  isVacant: boolean | null;
};

export type Analysis = OrgScoped & {
  dealId: Uuid;
  strategy: AnalysisStrategy;
  arv: number | null;
  repairs: number | null;
  maoPct: number | null;
  market: string | null;
  purchase: number | null;
  targetProfit: number | null;
  /** Strategy-specific inputs. Shapes land with the analyzer in v1. */
  inputs: Record<string, unknown>;
  /** Snapshot of computed outputs at save time. */
  computed: Record<string, unknown>;
};

export type Comp = OrgScoped & {
  dealId: Uuid;
  address: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  distanceMi: number | null;
  soldPrice: number | null;
  soldDate: DateOnly | null;
  link: string | null;
};

export type DocumentRecord = OrgScoped & {
  dealId: Uuid | null;
  type: DocumentType;
  storagePath: string;
  url: string | null;
  version: number;
};

export type Template = OrgScoped & {
  kind: TemplateKind;
  name: string;
  body: string;
  variant: string | null;
  isDefault: boolean;
};

export type EmailAccount = OrgScoped & {
  userId: Uuid;
  provider: EmailProvider;
  address: string;
  displayName: string | null;
  tokenExpiresAt: Timestamp | null;
  isDefault: boolean;
  status: EmailAccountStatus;
  // Note: refresh/access tokens are deliberately absent. They live in columns
  // that RLS never exposes to the client - only Edge Functions read them.
};

export type Activity = OrgScoped & {
  dealId: Uuid | null;
  userId: Uuid | null;
  type: string;
  payload: Record<string, unknown>;
  at: Timestamp;
};

export type Reminder = OrgScoped & {
  dealId: Uuid;
  dueAt: Timestamp;
  done: boolean;
};

/** Offer price as a percentage of list price - shown on every pipeline row. */
export function offerToList(deal: Pick<Deal, 'offerPrice' | 'listPrice'>): number | null {
  if (deal.offerPrice == null || deal.listPrice == null || deal.listPrice === 0) return null;
  return deal.offerPrice / deal.listPrice;
}
