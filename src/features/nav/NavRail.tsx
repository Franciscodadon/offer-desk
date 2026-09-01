/**
 * The desktop navigation rail.
 *
 * On a wide screen the bottom tab bar is the wrong shape twice over: it puts
 * navigation where a laptop user's hands are not, and it spends the one axis
 * the screen has plenty of - width - on nothing. The rail moves the same
 * destinations to the left edge and gets the workspace name onto the screen,
 * which the tab bar never had room for.
 *
 * It sits beside the navigator rather than replacing it: the tab bar is still
 * what renders on a phone, and both drive the same routes, so there is one set
 * of destinations and one router, not two.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { radii, sizing, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type NavDestination = {
  /** Route to navigate to, and the prefix that marks this item current. */
  href: '/dashboard' | '/pipeline' | '/settings';
  label: string;
};

export const NAV_DESTINATIONS: NavDestination[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/settings', label: 'Settings' },
];

export const RAIL_WIDTH = 208;

/**
 * True when `pathname` is this destination or something under it, so a deal
 * screen opened from the pipeline keeps Pipeline lit rather than clearing the
 * rail entirely.
 */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavRail({
  pathname,
  workspaceName,
  onNavigate,
}: {
  pathname: string;
  workspaceName: string | null;
  onNavigate: (href: NavDestination['href']) => void;
}) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="none"
      style={[
        styles.rail,
        { backgroundColor: theme.color.surface, borderRightColor: theme.color.border },
      ]}
    >
      <View style={styles.brand}>
        <View style={[styles.mark, { backgroundColor: theme.color.accent }]}>
          <Text variant="label" tone="onAccent">
            O
          </Text>
        </View>
        <Text variant="label" numberOfLines={1}>
          Offer Desk
        </Text>
      </View>

      <View style={styles.items}>
        {NAV_DESTINATIONS.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <Pressable
              key={item.href}
              onPress={() => onNavigate(item.href)}
              accessibilityRole="link"
              accessibilityState={{ selected: current }}
              style={({ pressed }) => [
                styles.item,
                current ? { backgroundColor: theme.color.accentMuted } : null,
                pressed && !current ? { backgroundColor: theme.color.surfaceMuted } : null,
              ]}
            >
              <Text variant="label" tone={current ? 'accent' : 'muted'}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {workspaceName ? (
        <Text variant="caption" tone="subtle" numberOfLines={2} style={styles.footer}>
          {workspaceName}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: RAIL_WIDTH,
    borderRightWidth: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xl,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  items: { gap: 2 },
  item: {
    minHeight: sizing.minTapTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  // Pushed to the bottom of the rail, out of the way of the destinations.
  footer: { marginTop: 'auto', paddingHorizontal: spacing.sm },
});
