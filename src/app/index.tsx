/**
 * Entry route. Sends the user to the pipeline, the auth screens, or the setup
 * screen depending on how far the app is configured. Kept as a redirect so
 * there is exactly one place that decides where a cold start lands.
 */
import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';

export default function Index() {
  const { isSignedIn } = useAuth();

  if (!isSupabaseConfigured) return <Redirect href="/setup" />;
  return <Redirect href={isSignedIn ? '/pipeline' : '/sign-in'} />;
}
