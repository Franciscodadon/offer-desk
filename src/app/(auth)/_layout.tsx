import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { useTheme } from '@/theme';

export default function AuthLayout() {
  const theme = useTheme();
  const { isSignedIn } = useAuth();

  if (!isSupabaseConfigured) return <Redirect href="/setup" />;
  // Someone already signed in has no business on the sign-in screen.
  if (isSignedIn) return <Redirect href="/pipeline" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.color.background },
      }}
    />
  );
}
