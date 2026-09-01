/**
 * Screen container: themed background plus safe-area padding, with an optional
 * scroll view. Keyboard avoidance is on by default because most screens in this
 * app are forms filled in one-handed.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

/** Comfortable reading width for a form, which is most screens here. */
const DEFAULT_MAX_WIDTH = 720;

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Centers content vertically. Used by the auth and setup screens. */
  center?: boolean;
  /**
   * Widest the content is allowed to get. The default keeps forms readable on
   * a big monitor; the dashboard raises it, because a deck of panels is the
   * one screen here that has something to do with the extra width.
   */
  maxWidth?: number;
};

export function Screen({
  children,
  scroll = true,
  center = false,
  maxWidth = DEFAULT_MAX_WIDTH,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: insets.top + spacing.lg,
    paddingBottom: insets.bottom + spacing.xl,
    paddingHorizontal: spacing.lg,
  };

  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { maxWidth },
        padding,
        center && styles.centered,
      ]}
      keyboardShouldPersistTaps="handled"
      // The pipeline is the first thing a user reads; never hide it behind a
      // bounce on a short list.
      alwaysBounceVertical={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { maxWidth }, padding, center && styles.centered, styles.flex]}>
      {children}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.color.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {content}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    width: '100%',
    // Keeps the web build from stretching forms across a wide monitor.
    alignSelf: 'center',
  },
  centered: {
    justifyContent: 'center',
  },
});
