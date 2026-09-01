/**
 * Signed-in layout. The guard here is what keeps every data screen from
 * rendering before an org is known - RLS keys on org_id, so a screen that
 * queried without one would simply return nothing and look like data loss.
 *
 * Navigation has two shapes for one set of destinations. On a phone it is the
 * tab bar the navigator draws. On a wide screen the tab bar is hidden and the
 * rail beside it takes over: same routes, same router, drawn where a laptop
 * user is actually looking.
 */
import { Redirect, Tabs, usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { WorkspaceUnavailable } from '@/features/auth/WorkspaceUnavailable';
import { NavRail } from '@/features/nav/NavRail';
import { isSupabaseConfigured } from '@/lib/env';
import { fontFamily, fontSize } from '@/theme/tokens';
import { breakpoint, ContentWidthProvider, useTheme } from '@/theme';

export default function AppLayout() {
  const theme = useTheme();
  const pathname = usePathname();
  // Two boxes, measured separately: the frame decides whether the rail is
  // worth its width, and the content area is what the screens inside lay
  // themselves out in. See theme/ContentWidth.
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const [contentWidth, setContentWidth] = useState<number | null>(null);
  const isWide = frameWidth != null && frameWidth >= breakpoint.wide;
  const router = useRouter();
  const { isSignedIn, orgId, org, workspaceProblem } = useAuth();

  if (!isSupabaseConfigured) return <Redirect href="/setup" />;
  if (!isSignedIn) return <Redirect href="/sign-in" />;
  // Signed in but no workspace. If the lookup already failed, say why: this
  // used to render null, which is right for the frame between a session
  // arriving and the profile loading, and a permanent blank page when the
  // profile never arrives at all.
  if (!orgId) {
    if (workspaceProblem) return <WorkspaceUnavailable problem={workspaceProblem} />;
    return null;
  }

  return (
    <View
      style={styles.frame}
      onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
    >
      {isWide ? (
        <NavRail
          pathname={pathname}
          workspaceName={org?.name ?? null}
          onNavigate={(href) => router.navigate(href)}
        />
      ) : null}

      <View
        style={styles.content}
        onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}
      >
        <ContentWidthProvider width={contentWidth}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: theme.color.accent,
              tabBarInactiveTintColor: theme.color.textSubtle,
              // The rail is already showing these destinations; two navigations
              // on one screen would be one too many.
              tabBarStyle: isWide
                ? { display: 'none' }
                : {
                    backgroundColor: theme.color.surface,
                    borderTopColor: theme.color.border,
                  },
              tabBarLabelStyle: {
                fontFamily: fontFamily.bodyMedium,
                fontSize: fontSize.xs,
              },
            }}
          >
            {/* Dashboard leads: the first question on opening the app is "where
                do we stand", and the pipeline is one tap from the answer. */}
            <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
            <Tabs.Screen name="pipeline" options={{ title: 'Pipeline' }} />
            <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
            {/* Reached from the pipeline, not from the tab bar. `href: null`
                keeps these routes navigable while hiding them as tabs. */}
            <Tabs.Screen name="deal/new" options={{ href: null }} />
            <Tabs.Screen name="deal/[id]/index" options={{ href: null }} />
            <Tabs.Screen name="deal/[id]/comps" options={{ href: null }} />
            <Tabs.Screen name="deal/[id]/analyzer" options={{ href: null }} />
            <Tabs.Screen name="deal/[id]/loi" options={{ href: null }} />
          </Tabs>
        </ContentWidthProvider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexDirection: 'row' },
  // `minWidth: 0` keeps a wide panel inside the navigator from pushing the
  // rail off the screen instead of scrolling itself.
  content: { flex: 1, minWidth: 0 },
});
