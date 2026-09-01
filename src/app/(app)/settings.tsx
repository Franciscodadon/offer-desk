/**
 * Settings - workspace identity, appearance, and account.
 *
 * Branding fields are read-only in phase 0; editing them writes to `orgs` in
 * phase 1, where they start feeding the LOI letterhead (PRD 7.1).
 */
import { StyleSheet, View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { EMPTY_VALUE } from '@/lib/format';
import { radii, spacing } from '@/theme/tokens';
import { useTheme, useThemePreference, type ThemePreference } from '@/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const { org, profile, signOut } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const theme = useTheme();

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Settings</Text>
      </View>

      <Card>
        <Text variant="label" tone="muted">
          Workspace
        </Text>
        <Row label="Name" value={org?.name ?? EMPTY_VALUE} />
        <Row label="Buyer entity" value={org?.buyer_entity ?? 'Not set'} />
        <Row label="Signatory" value={org?.signatory_name ?? 'Not set'} />
        <Text variant="caption" tone="subtle">
          These appear on generated LOIs and pitches. Editing arrives with the LOI generator.
        </Text>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Account
        </Text>
        <Row label="Name" value={profile?.name ?? EMPTY_VALUE} />
        <Row label="Email" value={profile?.email ?? EMPTY_VALUE} />
        <Row label="Role" value={profile?.role ?? EMPTY_VALUE} />
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Appearance
        </Text>
        <View style={styles.segment}>
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <Button
                key={option.value}
                label={option.label}
                variant={selected ? 'primary' : 'secondary'}
                fullWidth={false}
                onPress={() => setPreference(option.value)}
                style={{
                  ...styles.segmentButton,
                  borderColor: selected ? theme.color.accent : theme.color.border,
                }}
              />
            );
          })}
        </View>
      </Card>

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="body" tone="muted">
        {label}
      </Text>
      <Text variant="body" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  segment: { flexDirection: 'row', gap: spacing.sm },
  segmentButton: { flexGrow: 1, borderRadius: radii.md, paddingHorizontal: spacing.md },
});
