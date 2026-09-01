/**
 * Auth + workspace context.
 *
 * Holds the Supabase session, the signed-in user's profile, and their org. The
 * org is what every RLS policy keys on, so nothing that reads data should
 * render until `orgId` is known - the guard in app/(app)/_layout.tsx enforces
 * that.
 */
import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { Tables } from '@/lib/database.types';
import { isSupabaseConfigured } from '@/lib/env';
import { queryClient } from '@/lib/query';
import { getSupabase } from '@/lib/supabase';

export type Profile = Tables<'users'>;
export type Org = Tables<'orgs'>;

type AuthState = {
  /** False until the stored session has been read from disk. */
  initialized: boolean;
  session: Session | null;
  profile: Profile | null;
  org: Org | null;
  /** Set when the last auth action failed, for display on the auth screens. */
  error: string | null;
};

type AuthContextValue = AuthState & {
  isSignedIn: boolean;
  orgId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: {
    email: string;
    password: string;
    name: string;
    orgName: string;
  }) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Confirms a signup with the code Supabase emails. */
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null }>;
  /** Sends the confirmation email again. */
  resendEmailCode: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Supabase surfaces auth failures with terse messages. Rewrite the ones a user
 * will actually hit; pass anything else through rather than swallowing detail.
 */
function readableAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'That email and password do not match an account.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email address first.';
  }
  if (normalized.includes('user already registered')) {
    return 'An account already exists for that email. Sign in instead.';
  }
  if (normalized.includes('password should be at least')) {
    return 'Use a password of at least 8 characters.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    // With no Supabase project wired up there is no session to wait for, so the
    // app is immediately "initialized" and falls through to the setup screen.
    initialized: !isSupabaseConfigured,
    session: null,
    profile: null,
    org: null,
    error: null,
  });

  const loadProfile = useCallback(async (session: Session | null) => {
    const supabase = getSupabase();
    if (!supabase || !session) {
      setState((prev) => ({ ...prev, profile: null, org: null }));
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      // The signup trigger creates this row. If it is missing the account is in
      // a broken state, so surface it rather than rendering an empty pipeline.
      setState((prev) => ({
        ...prev,
        profile: null,
        org: null,
        error: profileError?.message ?? 'This account has no workspace yet.',
      }));
      return;
    }

    const { data: org } = await supabase
      .from('orgs')
      .select('*')
      .eq('id', profile.org_id)
      .maybeSingle();

    setState((prev) => ({ ...prev, profile, org: org ?? null, error: null }));
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let cancelled = false;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, session: data.session }));
        await loadProfile(data.session);
        if (!cancelled) setState((prev) => ({ ...prev, initialized: true }));
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, initialized: true }));
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, session }));
      void loadProfile(session);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const supabase = getSupabase();
    if (!supabase) return { error: 'Supabase is not configured yet.' };

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    const message = error ? readableAuthError(error.message) : null;
    setState((prev) => ({ ...prev, error: message }));
    return { error: message };
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(
    async ({ email, password, name, orgName }) => {
      const supabase = getSupabase();
      if (!supabase) {
        return { error: 'Supabase is not configured yet.', needsConfirmation: false };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        // Read by the handle_new_user trigger to name the workspace and the
        // profile it creates.
        options: { data: { name: name.trim(), org_name: orgName.trim() } },
      });

      if (error) {
        const message = readableAuthError(error.message);
        setState((prev) => ({ ...prev, error: message }));
        return { error: message, needsConfirmation: false };
      }

      // With email confirmation on, signUp returns a user but no session.
      return { error: null, needsConfirmation: data.session == null };
    },
    [],
  );

  /**
   * Confirms a signup with the six-digit code from the email.
   *
   * Supabase's default template sends a code rather than only a link, so the
   * app has to accept one; a confirmation the user cannot complete in the app
   * is a dead end. On success this establishes a session, and the auth listener
   * picks it up and the guard redirects.
   */
  const verifyEmailCode = useCallback<AuthContextValue['verifyEmailCode']>(
    async (email, code) => {
      const supabase = getSupabase();
      if (!supabase) return { error: 'Supabase is not configured yet.' };

      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'signup',
      });

      if (!error) {
        setState((previous) => ({ ...previous, error: null }));
        return { error: null };
      }

      const normalized = error.message.toLowerCase();
      if (normalized.includes('expired')) {
        return { error: 'That code has expired. Send a new one and try again.' };
      }
      if (normalized.includes('invalid') || normalized.includes('token')) {
        return { error: 'That code did not match. Check it and try again.' };
      }
      return { error: error.message };
    },
    [],
  );

  const resendEmailCode = useCallback<AuthContextValue['resendEmailCode']>(
    async (email) => {
      const supabase = getSupabase();
      if (!supabase) return { error: 'Supabase is not configured yet.' };

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim().toLowerCase(),
      });

      if (!error) return { error: null };

      // Supabase rate-limits confirmation email and says how long to wait, so
      // pass that through rather than a generic failure.
      const normalized = error.message.toLowerCase();
      if (normalized.includes('security purposes') || normalized.includes('rate limit')) {
        return {
          error: `${error.message} Repeated attempts extend the wait rather than shortening it.`,
        };
      }
      return { error: error.message };
    },
    [],
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    // Drop cached deals so the next account on this device cannot read them
    // out of the offline cache.
    await queryClient.cancelQueries();
    queryClient.clear();
    setState((prev) => ({ ...prev, session: null, profile: null, org: null, error: null }));
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(state.session);
  }, [loadProfile, state.session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isSignedIn: state.session != null,
      orgId: state.profile?.org_id ?? null,
      signIn,
      signUp,
      verifyEmailCode,
      resendEmailCode,
      signOut,
      refreshProfile,
    }),
    [refreshProfile, resendEmailCode, signIn, signOut, signUp, state, verifyEmailCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
