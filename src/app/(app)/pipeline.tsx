/**
 * Pipeline - PRD 7.2. The app's home screen and the list every other screen
 * routes back to.
 *
 * The list is rendered from the offline cache, and search and filtering run
 * over it locally, so the whole screen keeps working with no connection.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Button, Chip, EmptyState, Screen, Text, TextField } from '@/components/ui';
import { DEAL_STATUSES, DEAL_STATUS_LABELS, statusColors, type DealStatus } from '@/domain/status';
import { useAuth } from '@/features/auth/AuthProvider';
import { DealRow } from '@/features/deals/DealRow';
import { applyFilters, countByStatus, defaultFilters, type DealSort } from '@/features/deals/filters';
import { useContacts, useDeals } from '@/features/deals/queries';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

const SORTS: { value: DealSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'address', label: 'Address' },
  { value: 'offer_to_list', label: 'Offer/List' },
];

export default function PipelineScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { orgId } = useAuth();

  const deals = useDeals(orgId);
  const contacts = useContacts(orgId);

  const [search, setSearch] = useState('');
  const [statuses, setStatuses] = useState<Set<DealStatus>>(new Set());
  const [sort, setSort] = useState<DealSort>('newest');
  const [needsFollowUp, setNeedsFollowUp] = useState(false);

  const all = useMemo(() => deals.data ?? [], [deals.data]);
  const counts = useMemo(() => countByStatus(all), [all]);

  const visible = useMemo(
    () =>
      applyFilters(
        all,
        { ...defaultFilters, search, statuses, sort, needsFollowUp },
        contacts.data ?? [],
      ),
    [all, contacts.data, needsFollowUp, search, sort, statuses],
  );

  function toggleStatus(status: DealStatus) {
    setStatuses((previous) => {
      const next = new Set(previous);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  const filtering = search.trim().length > 0 || statuses.size > 0 || needsFollowUp;

  return (
    <Screen scroll={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title">Pipeline</Text>
          <Text variant="body" tone="muted">
            {all.length === 0
              ? 'No deals yet'
              : `${visible.length} of ${all.length} ${all.length === 1 ? 'deal' : 'deals'}`}
          </Text>
        </View>
        <Button
          label="New deal"
          fullWidth={false}
          onPress={() => router.push('/deal/new')}
        />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(deal) => deal.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={deals.isRefetching}
            onRefresh={() => void deals.refetch()}
            tintColor={theme.color.accent}
          />
        }
        ListHeaderComponent={
          all.length === 0 && !deals.isLoading ? null : (
            <View style={styles.filters}>
              <TextField
                label="Search"
                value={search}
                onChangeText={setSearch}
                placeholder="Address, city, agent, MLS"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />

              <View style={styles.chipRow}>
                {DEAL_STATUSES.map((status) => {
                  const colors = statusColors(status, theme);
                  return (
                    <Chip
                      key={status}
                      label={DEAL_STATUS_LABELS[status]}
                      count={counts[status]}
                      selected={statuses.has(status)}
                      selectedColor={colors.bg}
                      selectedTextColor={colors.fg}
                      onPress={() => toggleStatus(status)}
                    />
                  );
                })}
                <Chip
                  label="Needs follow-up"
                  selected={needsFollowUp}
                  onPress={() => setNeedsFollowUp((value) => !value)}
                />
              </View>

              <View style={styles.chipRow}>
                <Text variant="caption" tone="muted" style={styles.sortLabel}>
                  Sort
                </Text>
                {SORTS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={sort === option.value}
                    onPress={() => setSort(option.value)}
                  />
                ))}
              </View>
            </View>
          )
        }
        renderItem={({ item }) => (
          <DealRow deal={item} onPress={() => router.push(`/deal/${item.id}`)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          deals.isLoading ? null : filtering ? (
            <EmptyState
              title="No matches"
              body="No deals match these filters. Clear them to see the whole pipeline."
              actionLabel="Clear filters"
              onAction={() => {
                setSearch('');
                setStatuses(new Set());
                setNeedsFollowUp(false);
              }}
            />
          ) : (
            <EmptyState
              title="Your pipeline is empty"
              body="Log the first property and the offer, and it will show up here with its status and offer-to-list."
              actionLabel="Log a deal"
              onAction={() => router.push('/deal/new')}
            />
          )
        }
      />

      {deals.isError ? (
        <Text variant="caption" tone="negative">
          Could not refresh from the server. Showing the last synced copy.
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: { gap: 2, flexShrink: 1 },
  list: { gap: 0, paddingBottom: spacing.xl },
  filters: { gap: spacing.md, paddingBottom: spacing.lg },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
  sortLabel: { marginRight: spacing.xs },
  separator: { height: spacing.md },
});
