import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await signIn(email, password);
    setError(result.error);
    setSubmitting(false);
    // On success the auth listener updates the session and the layout guard
    // redirects; there is nothing to navigate to from here.
  }

  return (
    <Screen center>
      <View style={styles.header}>
        <Text variant="title">Offer Desk</Text>
        <Text variant="body" tone="muted">
          Sign in to your workspace.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@company.com"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onSubmit}
          error={error}
        />
        <Button label="Sign in" onPress={onSubmit} disabled={!canSubmit} loading={submitting} />
      </View>

      <View style={styles.footer}>
        <Text variant="body" tone="muted">
          No account yet?
        </Text>
        <Link href="/sign-up">
          <Text variant="bodyStrong" tone="accent">
            Create a workspace
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  form: { gap: spacing.lg },
  footer: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
});
