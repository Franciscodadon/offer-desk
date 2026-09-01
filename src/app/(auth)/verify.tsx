/**
 * Confirm a new account with the code Supabase emails.
 *
 * Supabase's default confirmation template sends a six-digit code, so the app
 * has to be able to take one. A screen that only says "check your email" is a
 * dead end when the email contains a code and nothing to click.
 *
 * The email may also contain a link, depending on the project's template. That
 * path still works and lands the user signed in; this screen is for the code.
 */
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { spacing } from '@/theme/tokens';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();
  const { verifyEmailCode, resendEmailCode } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const address = (email ?? '').trim();
  const canSubmit = code.trim().length === CODE_LENGTH && !submitting && address.length > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);

    const result = await verifyEmailCode(address, code);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    // Verification signs the user in; the layout guard takes it from here.
    router.replace('/pipeline');
  }

  async function onResend() {
    setResending(true);
    setError(null);
    setNotice(null);

    const result = await resendEmailCode(address);
    setResending(false);
    setNotice(result.error ? null : 'Sent. Check your inbox for a new code.');
    if (result.error) setError(result.error);
  }

  if (address.length === 0) {
    return (
      <Screen center>
        <Card>
          <Text variant="heading">Confirm your email</Text>
          <Text variant="body" tone="muted">
            Open the confirmation email we sent, then sign in.
          </Text>
        </Card>
        <Link href="/sign-in">
          <Text variant="bodyStrong" tone="accent">
            Back to sign in
          </Text>
        </Link>
      </Screen>
    );
  }

  return (
    <Screen center>
      <View style={styles.header}>
        <Text variant="title">Enter your code</Text>
        <Text variant="body" tone="muted">
          We emailed a {CODE_LENGTH} digit code to {address}. Enter it here to finish
          setting up your workspace.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="Confirmation code"
          value={code}
          onChangeText={(text) => {
            // Codes get pasted with stray spaces; keep only the digits.
            setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH));
            setError(null);
          }}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder="123456"
          numeric
          error={error}
          onSubmitEditing={onSubmit}
          returnKeyType="go"
        />

        <Button
          label="Confirm and continue"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />

        <Button
          label="Send a new code"
          variant="secondary"
          onPress={onResend}
          loading={resending}
        />

        {notice ? (
          <Text variant="body" tone="accent">
            {notice}
          </Text>
        ) : null}

        <Text variant="caption" tone="subtle">
          If the email has a link instead of a code, opening the link works too.
        </Text>
      </View>

      <View style={styles.footer}>
        <Link href="/sign-in">
          <Text variant="bodyStrong" tone="accent">
            Back to sign in
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm },
  form: { gap: spacing.lg },
  footer: { alignItems: 'center' },
});
