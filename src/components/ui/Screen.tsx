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

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Centers content vertically. Used by the auth and setup screens. */
  center?: boolean;
};

export function Screen({ children, scroll = true, center = false }: Props) {
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
    <View style={[styles.content, padding, center && styles.centered, styles.flex]}>{children}</View>
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
    maxWidth: 720,
    width: '100%',
    // Keeps the web build from stretching forms across a wide monitor.
    alignSelf: 'center',
  },
  centered: {
    justifyContent: 'center',
  },
});
