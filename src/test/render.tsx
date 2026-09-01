/**
 * Shared render helper for component tests.
 *
 * Wraps a subject in the providers every screen assumes: safe-area metrics
 * (supplied explicitly, since there is no real window in a test) and the theme.
 * Query and auth providers are deliberately not included - tests mock the data
 * hooks directly, which keeps them fast and free of network stubs.
 */
import { render, type RenderOptions } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';

const TEST_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react-native';
