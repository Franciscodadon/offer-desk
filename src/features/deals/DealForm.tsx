/**
 * Create and edit form for a deal, its property facts, and its listing agent.
 *
 * PRD flow A puts this on a phone in a driveway with a two-minute budget, so
 * the field order follows what a person actually knows in that moment: where
 * they are, who is listing it, what it is priced at, what they will offer.
 *
 * Money and measurement fields are held as strings while being typed and
 * parsed with `parseNumericInput`, which returns null rather than 0 for partial
 * input - a half-typed "2" in a price must not be stored as two dollars.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Chip, Text, TextField } from '@/components/ui';
import type { ParsedListing } from '@/features/import/listingParser';

import { ListingImport } from './ListingImport';
import { DEAL_STATUSES, DEAL_STATUS_LABELS, statusColors, type DealStatus } from '@/domain/status';
import type { Contact, Deal, Property } from '@/domain/types';
import { parseNumericInput, toDateOnly } from '@/lib/format';
import { spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';

export type DealFormValues = {
  address: string;
  city: string;
  state: string;
  zip: string;
  mls: string;
  parcelId: string;
  listPrice: string;
  offerPrice: string;
  status: DealStatus;
  submittedAt: string;
  nextActionAt: string;
  notes: string;

  agentName: string;
  agentBrokerage: string;
  agentPhone: string;
  agentEmail: string;

  beds: string;
  baths: string;
  sqft: string;
  yearBuilt: string;
  listingUrl: string;
};

export type DealFormPayload = {
  deal: {
    address: string;
    city: string | null;
    state: string | null;
    zip: string | null;
    mls: string | null;
    parcel_id: string | null;
    list_price: number | null;
    offer_price: number | null;
    status: DealStatus;
    submitted_at: string | null;
    next_action_at: string | null;
    notes: string | null;
  };
  /** Null when no agent details were entered. */
  agent: {
    name: string;
    brokerage: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  /** Null when no property facts were entered. */
  property: {
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    year_built: number | null;
    listing_url: string | null;
  } | null;
};

const EMPTY: DealFormValues = {
  address: '',
  city: '',
  state: '',
  zip: '',
  mls: '',
  parcelId: '',
  listPrice: '',
  offerPrice: '',
  status: 'loi_sent',
  submittedAt: toDateOnly(),
  nextActionAt: '',
  notes: '',
  agentName: '',
  agentBrokerage: '',
  agentPhone: '',
  agentEmail: '',
  beds: '',
  baths: '',
  sqft: '',
  yearBuilt: '',
  listingUrl: '',
};

const numberToText = (value: number | null | undefined): string =>
  value == null ? '' : String(value);

/** Seeds the form from existing rows when editing. */
export function valuesFromDeal(
  deal: Deal,
  property: Property | null,
  agent: Contact | null,
): DealFormValues {
  return {
    address: deal.address,
    city: deal.city ?? '',
    state: deal.state ?? '',
    zip: deal.zip ?? '',
    mls: deal.mls ?? '',
    parcelId: deal.parcel_id ?? '',
    listPrice: numberToText(deal.list_price),
    offerPrice: numberToText(deal.offer_price),
    status: deal.status,
    submittedAt: deal.submitted_at ?? '',
    nextActionAt: deal.next_action_at ?? '',
    notes: deal.notes ?? '',
    agentName: agent?.name ?? '',
    agentBrokerage: agent?.brokerage ?? '',
    agentPhone: agent?.phone ?? '',
    agentEmail: agent?.email ?? '',
    beds: numberToText(property?.beds),
    baths: numberToText(property?.baths),
    sqft: numberToText(property?.sqft),
    yearBuilt: numberToText(property?.year_built),
    listingUrl: property?.listing_url ?? '',
  };
}

const trimmedOrNull = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/** Accepts YYYY-MM-DD, or nothing. Anything else is rejected by validation. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validate(values: DealFormValues): Partial<Record<keyof DealFormValues, string>> {
  const errors: Partial<Record<keyof DealFormValues, string>> = {};

  if (values.address.trim().length === 0) {
    errors.address = 'An address is required. It is how you find the deal again.';
  }

  for (const field of ['submittedAt', 'nextActionAt'] as const) {
    const value = values[field].trim();
    if (value.length > 0 && !DATE_PATTERN.test(value)) {
      errors[field] = 'Use YYYY-MM-DD.';
    }
  }

  for (const field of ['listPrice', 'offerPrice', 'sqft', 'yearBuilt', 'beds', 'baths'] as const) {
    const raw = values[field].trim();
    if (raw.length > 0 && parseNumericInput(raw) == null) {
      errors[field] = 'Enter a number.';
    }
  }

  if (values.agentEmail.trim().length > 0 && !values.agentEmail.includes('@')) {
    errors.agentEmail = 'Enter a valid email address.';
  }

  return errors;
}

export function toPayload(values: DealFormValues): DealFormPayload {
  const agentName = values.agentName.trim();
  const property = {
    beds: parseNumericInput(values.beds),
    baths: parseNumericInput(values.baths),
    sqft: parseNumericInput(values.sqft),
    year_built: parseNumericInput(values.yearBuilt),
    listing_url: trimmedOrNull(values.listingUrl),
  };
  const hasPropertyFacts = Object.values(property).some((value) => value != null);

  return {
    deal: {
      address: values.address.trim(),
      city: trimmedOrNull(values.city),
      state: trimmedOrNull(values.state),
      zip: trimmedOrNull(values.zip),
      mls: trimmedOrNull(values.mls),
      parcel_id: trimmedOrNull(values.parcelId),
      list_price: parseNumericInput(values.listPrice),
      offer_price: parseNumericInput(values.offerPrice),
      status: values.status,
      submitted_at: trimmedOrNull(values.submittedAt),
      next_action_at: trimmedOrNull(values.nextActionAt),
      notes: trimmedOrNull(values.notes),
    },
    agent:
      agentName.length > 0
        ? {
            name: agentName,
            brokerage: trimmedOrNull(values.agentBrokerage),
            phone: trimmedOrNull(values.agentPhone),
            email: trimmedOrNull(values.agentEmail),
          }
        : null,
    property: hasPropertyFacts ? property : null,
  };
}

/** Fills the form from a parsed listing, leaving anything it did not find. */
export function applyListing(
  values: DealFormValues,
  listing: ParsedListing,
  url: string,
): DealFormValues {
  const keep = (current: string, incoming: string | number | null): string =>
    incoming == null || incoming === '' ? current : String(incoming);

  return {
    ...values,
    address: keep(values.address, listing.address),
    city: keep(values.city, listing.city),
    state: keep(values.state, listing.state),
    zip: keep(values.zip, listing.zip),
    mls: keep(values.mls, listing.mls),
    listPrice: keep(values.listPrice, listing.listPrice),
    beds: keep(values.beds, listing.beds),
    baths: keep(values.baths, listing.baths),
    sqft: keep(values.sqft, listing.sqft),
    yearBuilt: keep(values.yearBuilt, listing.yearBuilt),
    agentName: keep(values.agentName, listing.agentName),
    agentPhone: keep(values.agentPhone, listing.agentPhone),
    agentEmail: keep(values.agentEmail, listing.agentEmail),
    listingUrl: url.trim().length > 0 ? url.trim() : values.listingUrl,
  };
}

type Props = {
  initial?: DealFormValues;
  submitLabel: string;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (payload: DealFormPayload) => void;
  onCancel?: () => void;
  /**
   * Shows the listing importer above the fields. On for a new deal, off when
   * editing one that already has its details.
   */
  showImport?: boolean;
};

export function DealForm({
  initial,
  submitLabel,
  submitting = false,
  error,
  onSubmit,
  onCancel,
  showImport = false,
}: Props) {
  const theme = useTheme();
  const [values, setValues] = useState<DealFormValues>(initial ?? EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof DealFormValues, string>>>({});
  const [attempted, setAttempted] = useState(false);

  function set<K extends keyof DealFormValues>(key: K, value: DealFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    // Clear a field's error as soon as it is touched; re-validated on submit.
    if (attempted) setErrors((previous) => ({ ...previous, [key]: undefined }));
  }

  function handleSubmit() {
    setAttempted(true);
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(toPayload(values));
  }

  return (
    <View style={styles.form}>
      {showImport ? (
        <ListingImport
          onImport={(listing, url) =>
            setValues((previous) => applyListing(previous, listing, url))
          }
        />
      ) : null}
      <Card>
        <Text variant="label" tone="muted">
          Property
        </Text>
        <TextField
          label="Address"
          value={values.address}
          onChangeText={(text) => set('address', text)}
          placeholder="123 Main St"
          autoCapitalize="words"
          error={errors.address}
        />
        <View style={styles.row}>
          <View style={styles.grow}>
            <TextField
              label="City"
              value={values.city}
              onChangeText={(text) => set('city', text)}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.short}>
            <TextField
              label="State"
              value={values.state}
              onChangeText={(text) => set('state', text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
          <View style={styles.short}>
            <TextField
              label="ZIP"
              value={values.zip}
              onChangeText={(text) => set('zip', text)}
              keyboardType="number-pad"
              maxLength={10}
              numeric
            />
          </View>
        </View>
        <TextField
          label="Listing URL"
          value={values.listingUrl}
          onChangeText={(text) => set('listingUrl', text)}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          hint="Paste the listing link to keep it with the deal."
        />
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Listing agent
        </Text>
        <TextField
          label="Name"
          value={values.agentName}
          onChangeText={(text) => set('agentName', text)}
          autoCapitalize="words"
        />
        <TextField
          label="Brokerage"
          value={values.agentBrokerage}
          onChangeText={(text) => set('agentBrokerage', text)}
          autoCapitalize="words"
        />
        <View style={styles.row}>
          <View style={styles.grow}>
            <TextField
              label="Phone"
              value={values.agentPhone}
              onChangeText={(text) => set('agentPhone', text)}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.grow}>
            <TextField
              label="Email"
              value={values.agentEmail}
              onChangeText={(text) => set('agentEmail', text)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              error={errors.agentEmail}
            />
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Numbers
        </Text>
        <View style={styles.row}>
          <View style={styles.grow}>
            <TextField
              label="List price"
              value={values.listPrice}
              onChangeText={(text) => set('listPrice', text)}
              keyboardType="numeric"
              numeric
              error={errors.listPrice}
            />
          </View>
          <View style={styles.grow}>
            <TextField
              label="Offer price"
              value={values.offerPrice}
              onChangeText={(text) => set('offerPrice', text)}
              keyboardType="numeric"
              numeric
              error={errors.offerPrice}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.grow}>
            <TextField
              label="Beds"
              value={values.beds}
              onChangeText={(text) => set('beds', text)}
              keyboardType="numeric"
              numeric
              error={errors.beds}
            />
          </View>
          <View style={styles.grow}>
            <TextField
              label="Baths"
              value={values.baths}
              onChangeText={(text) => set('baths', text)}
              keyboardType="numeric"
              numeric
              error={errors.baths}
            />
          </View>
          <View style={styles.grow}>
            <TextField
              label="Sqft"
              value={values.sqft}
              onChangeText={(text) => set('sqft', text)}
              keyboardType="numeric"
              numeric
              error={errors.sqft}
            />
          </View>
          <View style={styles.grow}>
            <TextField
              label="Year"
              value={values.yearBuilt}
              onChangeText={(text) => set('yearBuilt', text)}
              keyboardType="number-pad"
              numeric
              error={errors.yearBuilt}
            />
          </View>
        </View>
        <View style={styles.row}>
          <View style={styles.grow}>
            <TextField
              label="MLS #"
              value={values.mls}
              onChangeText={(text) => set('mls', text)}
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.grow}>
            <TextField
              label="Parcel ID"
              value={values.parcelId}
              onChangeText={(text) => set('parcelId', text)}
              autoCapitalize="characters"
            />
          </View>
        </View>
      </Card>

      <Card>
        <Text variant="label" tone="muted">
          Status
        </Text>
        <View style={styles.chipRow}>
          {DEAL_STATUSES.map((status) => {
            const colors = statusColors(status, theme);
            return (
              <Chip
                key={status}
                label={DEAL_STATUS_LABELS[status]}
                selected={values.status === status}
                selectedColor={colors.bg}
                selectedTextColor={colors.fg}
                onPress={() => set('status', status)}
              />
            );
          })}
        </View>
        <View style={styles.row}>
          <View style={styles.grow}>
            <TextField
              label="Offer sent"
              value={values.submittedAt}
              onChangeText={(text) => set('submittedAt', text)}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              numeric
              error={errors.submittedAt}
              hint="Drives the weekly offer count."
            />
          </View>
          <View style={styles.grow}>
            <TextField
              label="Next action"
              value={values.nextActionAt}
              onChangeText={(text) => set('nextActionAt', text)}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
              numeric
              error={errors.nextActionAt}
            />
          </View>
        </View>
        <TextField
          label="Notes"
          value={values.notes}
          onChangeText={(text) => set('notes', text)}
          multiline
          numberOfLines={4}
          style={styles.notes}
        />
      </Card>

      {error ? (
        <Text variant="body" tone="negative">
          {error}
        </Text>
      ) : null}

      <Button label={submitLabel} onPress={handleSubmit} loading={submitting} />
      {onCancel ? <Button label="Cancel" variant="ghost" onPress={onCancel} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  grow: { flexGrow: 1, flexBasis: 120 },
  short: { flexBasis: 80, flexGrow: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notes: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
});
