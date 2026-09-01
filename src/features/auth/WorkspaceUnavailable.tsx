/**
 * Shown when an account signs in but has no workspace behind it.
 *
 * This screen exists because the alternative was rendering nothing. The guard
 * used to return null here, written for the single frame between a session
 * arriving and the profile loading; when the profile never arrives, that frame
 * lasts forever and the app is a blank page with no way to tell why.
 *
 * A signed-in user with no org is always one of two things, and they have
 * different fixes, so the screen names which one happened.
 */
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { spacing } from '@/theme/tokens';

import { useAuth, type WorkspaceProblem } from './AuthProvider';

const SCHEMA_STEPS = [
  'In the project folder, run: npm run db:bundle',
  'Open supabase/schema.bundle.sql, copy all of it.',
  'In Supabase, open SQL Editor, then New query, paste it, and press Run.',
  'Come back here and press Try again.',
];

const PROFILE_STEPS = [
  'In Supabase, open Authentication, then Users.',
  'Delete this account. Its workspace was never created, so nothing is lost.',
  'Sign up again. The database creates the workspace this time.',
];

export function WorkspaceUnavailable({ problem }: { problem: WorkspaceProblem }) {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const address = profile?.email ?? session?.user.email ?? 'this account';

  const schemaMissing = problem.kind === 'schema_missing';

  return (
    <Screen center>
      <View style={styles.header}>
        <Text variant="title">
          {schemaMissing ? 'The database is empty' : 'This account has no workspace'}
        </Text>
        <Text variant="body" tone="muted">
          {schemaMissing
            ? 'You are signed in, but the tables the app reads have not been created yet. This is the schema step, and it only has to be done once.'
            : `You are signed in as ${address}, but no workspace was created for it. That happens when an account is made before the database is set up.`}
        </Text>
      </View>

      <Card>
        <Text variant="bodyStrong">{schemaMissing ? 'Apply the schema' : 'Start the account over'}</Text>
        {(schemaMissing ? SCHEMA_STEPS : PROFILE_STEPS).map((step, index) => (
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

      {problem.kind === 'unknown' ? (
        <Card>
          <Text variant="label" tone="muted">
            What the database said
          </Text>
          <Text variant="mono" tone="negative">
            {problem.message}
          </Text>
        </Card>
      ) : null}

      <Button label="Try again" onPress={() => void refreshProfile()} />
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  stepText: { flex: 1 },
});
