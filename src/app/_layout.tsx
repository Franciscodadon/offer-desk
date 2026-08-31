/**
 * Root layout. Mounts the providers every screen depends on, in order:
 * safe area -> theme -> offline query cache -> auth.
 *
 * The splash screen stays up until fonts are loaded and the stored session has
 * been read, so the app never flashes an unstyled or signed-out frame at
 * someone who is already signed in.
 */
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { persistOptions, queryClient } from '@/lib/query';
import { ThemeProvider, useAppFonts, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or the module is unavailable on this platform.
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AuthProvider>
            {/* A font that fails to download must not block the app; render
                with system fallbacks rather than hanging on the splash. */}
            <AppShell ready={fontsLoaded || fontError != null} />
          </AuthProvider>
        </PersistQueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell({ ready }: { ready: boolean }) {
  const theme = useTheme();
  const { initialized } = useAuth();
  const canRender = ready && initialized;

  useEffect(() => {
    if (canRender) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [canRender]);

  if (!canRender) return null;

  return (
    <>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
