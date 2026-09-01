/**
 * Signed-in layout. The guard here is what keeps every data screen from
 * rendering before an org is known - RLS keys on org_id, so a screen that
 * queried without one would simply return nothing and look like data loss.
 */
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { fontFamily, fontSize } from '@/theme/tokens';
import { useTheme } from '@/theme';

export default function AppLayout() {
  const theme = useTheme();
  const { isSignedIn, orgId } = useAuth();

  if (!isSupabaseConfigured) return <Redirect href="/setup" />;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  // Signed in but the profile row has not arrived yet. Render nothing for the
  // one frame it takes rather than flashing an empty pipeline.
  if (!orgId) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textSubtle,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.border,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.bodyMedium,
          fontSize: fontSize.xs,
        },
      }}
    >
      <Tabs.Screen name="pipeline" options={{ title: 'Pipeline' }} />
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
      {/* Reached from the pipeline, not from the tab bar. `href: null` keeps
          these routes navigable while hiding them as tabs. */}
      <Tabs.Screen name="deal/new" options={{ href: null }} />
      <Tabs.Screen name="deal/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="deal/[id]/comps" options={{ href: null }} />
      <Tabs.Screen name="deal/[id]/analyzer" options={{ href: null }} />
    </Tabs>
  );
}
