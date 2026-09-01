import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { spacing } from '@/theme/tokens';

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const canSubmit =
    name.trim().length > 0 &&
    orgName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= MIN_PASSWORD_LENGTH &&
    !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await signUp({ email, password, name, orgName });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      // Supabase emails a code, so send the user somewhere they can enter one.
      router.push({
        pathname: '/verify',
        params: { email: email.trim().toLowerCase() },
      });
      return;
    }
    // Confirmation is off, so signUp already returned a session and the layout
    // guard redirects on its own.
  }

  return (
    <Screen center>
      <View style={styles.header}>
        <Text variant="title">Create your workspace</Text>
        <Text variant="body" tone="muted">
          Your workspace holds your deals, templates, and branding.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Your name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          placeholder="Francisco Caballero"
        />
        <TextField
          label="Company or workspace name"
          value={orgName}
          onChangeText={setOrgName}
          placeholder="Deo Volente"
          hint="Appears on your LOIs and pitches."
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@company.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          onSubmitEditing={onSubmit}
          error={error ?? (passwordTooShort ? `Use at least ${MIN_PASSWORD_LENGTH} characters.` : null)}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <Button
          label="Create workspace"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="body" tone="muted">
          Already have an account?
        </Text>
        <Link href="/sign-in">
          <Text variant="bodyStrong" tone="accent">
            Sign in
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
