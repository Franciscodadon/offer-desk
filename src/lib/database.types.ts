/**
 * Postgres row shapes, matching supabase/migrations.
 *
 * Hand-maintained for now. Once the schema settles, regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 * Keep this file and the migrations in lockstep; the app's camelCase domain
 * types in src/domain/types.ts map onto these snake_case rows.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// postgrest-js requires a Relationships entry on every table. Foreign keys are
// declared in the migrations and are not needed for the queries the app makes,
// so these stay empty until embedded selects (deal -> agent) are introduced.
export type Database = {
  public: {
    Tables: {
      orgs: {
        Row: Timestamps & {
          id: string;
          name: string;
          logo_url: string | null;
          signatory_name: string | null;
          signatory_title: string | null;
          buyer_entity: string | null;
          default_terms: Json;
          plan: string;
        };
        Insert: Partial<Database['public']['Tables']['orgs']['Row']> & { name: string };
        Update: Partial<Database['public']['Tables']['orgs']['Row']>;
        Relationships: [];
      };
      users: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          email: string;
          name: string | null;
          role: 'owner' | 'admin' | 'member';
          auth_provider: string | null;
        };
        Insert: Partial<Database['public']['Tables']['users']['Row']> & {
          id: string;
          org_id: string;
          email: string;
        };
        Update: Partial<Database['public']['Tables']['users']['Row']>;
        Relationships: [];
      };
      contacts: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          name: string;
          brokerage: string | null;
          phone: string | null;
          email: string | null;
          type: 'listing_agent' | 'buyer' | 'seller' | 'lender' | 'title' | 'other';
        };
        Insert: Partial<Database['public']['Tables']['contacts']['Row']> & {
          org_id: string;
          name: string;
        };
        Update: Partial<Database['public']['Tables']['contacts']['Row']>;
        Relationships: [];
      };
      deals: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          address: string;
          city: string | null;
          state: string | null;
          zip: string | null;
          parcel_id: string | null;
          mls: string | null;
          agent_id: string | null;
          list_price: number | null;
          offer_price: number | null;
          status:
            | 'loi_sent'
            | 'follow_up'
            | 'offer_accepted'
            | 'offer_rejected'
            | 'buyer_rejected'
            | 'pass';
          submitted_at: string | null;
          next_action_at: string | null;
          assignee_id: string | null;
          notes: string | null;
        };
        Insert: Partial<Database['public']['Tables']['deals']['Row']> & {
          org_id: string;
          address: string;
        };
        Update: Partial<Database['public']['Tables']['deals']['Row']>;
        Relationships: [];
      };
      properties: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          deal_id: string;
          beds: number | null;
          baths: number | null;
          sqft: number | null;
          lot_sqft: number | null;
          year_built: number | null;
          subdivision: string | null;
          listing_url: string | null;
          appraiser_url: string | null;
          permit_no: string | null;
          permit_url: string | null;
          is_vacant: boolean | null;
        };
        Insert: Partial<Database['public']['Tables']['properties']['Row']> & {
          org_id: string;
          deal_id: string;
        };
        Update: Partial<Database['public']['Tables']['properties']['Row']>;
        Relationships: [];
      };
      analyses: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          deal_id: string;
          strategy: 'wholesale' | 'flip' | 'brrrr' | 'turnkey';
          arv: number | null;
          repairs: number | null;
          mao_pct: number | null;
          market: string | null;
          purchase: number | null;
          target_profit: number | null;
          inputs: Json;
          computed: Json;
        };
        Insert: Partial<Database['public']['Tables']['analyses']['Row']> & {
          org_id: string;
          deal_id: string;
          strategy: 'wholesale' | 'flip' | 'brrrr' | 'turnkey';
        };
        Update: Partial<Database['public']['Tables']['analyses']['Row']>;
        Relationships: [];
      };
      comps: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          deal_id: string;
          address: string;
          beds: number | null;
          baths: number | null;
          sqft: number | null;
          distance_mi: number | null;
          sold_price: number | null;
          sold_date: string | null;
          link: string | null;
        };
        Insert: Partial<Database['public']['Tables']['comps']['Row']> & {
          org_id: string;
          deal_id: string;
          address: string;
        };
        Update: Partial<Database['public']['Tables']['comps']['Row']>;
        Relationships: [];
      };
      documents: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          deal_id: string | null;
          type: 'loi' | 'pof' | 'pitch' | 'other';
          storage_path: string;
          url: string | null;
          version: number;
        };
        Insert: Partial<Database['public']['Tables']['documents']['Row']> & {
          org_id: string;
          type: 'loi' | 'pof' | 'pitch' | 'other';
          storage_path: string;
        };
        Update: Partial<Database['public']['Tables']['documents']['Row']>;
        Relationships: [];
      };
      templates: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          kind: 'loi' | 'email';
          name: string;
          body: string;
          variant: string | null;
          is_default: boolean;
        };
        Insert: Partial<Database['public']['Tables']['templates']['Row']> & {
          org_id: string;
          kind: 'loi' | 'email';
          name: string;
          body: string;
        };
        Update: Partial<Database['public']['Tables']['templates']['Row']>;
        Relationships: [];
      };
      email_accounts: {
        // Token columns exist in Postgres but are stripped from every client-
        // visible read by the email_accounts_safe view; they are never selected
        // through the anon key.
        Row: Timestamps & {
          id: string;
          org_id: string;
          user_id: string;
          provider: 'gmail' | 'outlook';
          address: string;
          display_name: string | null;
          token_expires_at: string | null;
          is_default: boolean;
          status: 'connected' | 'needs_reauth' | 'revoked';
        };
        Insert: Partial<Database['public']['Tables']['email_accounts']['Row']> & {
          org_id: string;
          user_id: string;
          provider: 'gmail' | 'outlook';
          address: string;
        };
        Update: Partial<Database['public']['Tables']['email_accounts']['Row']>;
        Relationships: [];
      };
      activities: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          deal_id: string | null;
          user_id: string | null;
          type: string;
          payload: Json;
          at: string;
        };
        Insert: Partial<Database['public']['Tables']['activities']['Row']> & {
          org_id: string;
          type: string;
        };
        Update: Partial<Database['public']['Tables']['activities']['Row']>;
        Relationships: [];
      };
      reminders: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          deal_id: string;
          due_at: string;
          done: boolean;
        };
        Insert: Partial<Database['public']['Tables']['reminders']['Row']> & {
          org_id: string;
          deal_id: string;
          due_at: string;
        };
        Update: Partial<Database['public']['Tables']['reminders']['Row']>;
        Relationships: [];
      };
      subscriptions: {
        Row: Timestamps & {
          id: string;
          org_id: string;
          stripe_customer: string | null;
          plan: string;
          seats: number;
          status: string;
        };
        Insert: Partial<Database['public']['Tables']['subscriptions']['Row']> & {
          org_id: string;
        };
        Update: Partial<Database['public']['Tables']['subscriptions']['Row']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_org_id: { Args: Record<string, never>; Returns: string };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
