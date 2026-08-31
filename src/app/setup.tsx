/**
 * Setup screen, shown when no Supabase project is wired up yet.
 *
 * The scaffold is meant to run before the backend exists, so this explains
 * exactly what is missing instead of crashing on a null client.
 */
import { StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '@/components/ui';
import { describeMissingEnv } from '@/lib/env';
import { spacing } from '@/theme/tokens';

const STEPS = [
  'Create a free project at supabase.com (the free tier covers the internal build).',
  'In the dashboard, open Project Settings, then API, and copy the Project URL and the anon public key.',
  'Copy .env.example to .env.local in the project root and paste both values in.',
  'Apply the database schema: npx supabase db push (or paste supabase/migrations/*.sql into the SQL editor in filename order).',
  'Restart the dev server with npm start. This screen is replaced by sign-in.',
];

export default function SetupScreen() {
  const missing = describeMissingEnv();

  return (
    <Screen center>
      <View style={styles.header}>
        <Text variant="title">Offer Desk</Text>
        <Text variant="body" tone="muted">
          The app is built and running. It just needs a database to talk to.
        </Text>
      </View>

      <Card>
        <Text variant="label" tone="muted">
          Missing configuration
        </Text>
        {missing.map((key) => (
          <Text key={key} variant="mono" tone="negative">
            {key}
          </Text>
        ))}
      </Card>

      <Card>
        <Text variant="bodyStrong">Connect a backend</Text>
        {STEPS.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text variant="mono" tone="accent">
              {index + 1}
            </Text>
            <Text variant="body" tone="muted" style={styles.stepText}>
              {step}
            </Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepText: { flex: 1 },
});
