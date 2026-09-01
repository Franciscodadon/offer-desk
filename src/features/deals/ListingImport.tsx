/**
 * Import a listing at the top of the new-deal form - PRD 7.3 capture.
 *
 * Paste the link and the address fills itself in; paste the page text and the
 * price, size, and agent details follow. Nothing is fetched from the portal:
 * PRD 11 and 13 require linking out rather than scraping, so this reads the URL
 * string and whatever the user copied, both of which they already have.
 *
 * What was read is listed back before anything is applied. An import that
 * quietly overwrites a field the user typed is worse than no import.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text, TextField } from '@/components/ui';
import {
  FIELD_LABELS,
  filledFields,
  mergeListings,
  parseListingText,
  parseListingUrl,
  type ParsedListing,
} from '@/features/import/listingParser';
import { spacing } from '@/theme/tokens';

type Props = {
  /** Applies the parsed values to the form. */
  onImport: (listing: ParsedListing, url: string) => void;
};

export function ListingImport({ onImport }: Props) {
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [result, setResult] = useState<ParsedListing | null>(null);
  const [applied, setApplied] = useState(false);

  const hasInput = url.trim().length > 0 || pasted.trim().length > 0;

  function handleRead() {
    const parsed = mergeListings(parseListingUrl(url), parseListingText(pasted));
    setResult(parsed);
    setApplied(false);
  }

  function handleApply() {
    if (!result) return;
    onImport(result, url.trim());
    setApplied(true);
  }

  const found = result ? filledFields(result) : [];

  return (
    <Card>
      <Text variant="label" tone="muted">
        Start from a listing
      </Text>

      <TextField
        label="Listing URL"
        value={url}
        onChangeText={(text) => {
          setUrl(text);
          setResult(null);
        }}
        placeholder="https://www.zillow.com/homedetails/..."
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="The address is read from the link itself. The link is saved with the deal."
      />

      {showPaste ? (
        <TextField
          label="Paste the listing page"
          value={pasted}
          onChangeText={(text) => {
            setPasted(text);
            setResult(null);
          }}
          placeholder="Select the listing page, copy, and paste here"
          multiline
          numberOfLines={5}
          style={styles.paste}
          hint="Gets the price, beds, baths, size, and the agent's name and contact."
        />
      ) : (
        <Button
          label="Also paste the page for price and agent"
          variant="ghost"
          fullWidth={false}
          onPress={() => setShowPaste(true)}
        />
      )}

      <Button
        label="Read listing"
        variant="secondary"
        onPress={handleRead}
        disabled={!hasInput}
      />

      {result ? (
        found.length === 0 ? (
          <Text variant="body" tone="muted">
            Nothing could be read from that. Fill the fields in below, or paste the
            page text as well as the link.
          </Text>
        ) : (
          <View style={styles.result}>
            <Text variant="bodyStrong">Found {found.length} of 13 fields</Text>
            {found.map((field) => (
              <View key={field} style={styles.row}>
                <Text variant="caption" tone="muted">
                  {FIELD_LABELS[field]}
                </Text>
                <Text variant="body" numberOfLines={1} style={styles.value}>
                  {String(result[field])}
                </Text>
              </View>
            ))}
            <Button
              label={applied ? 'Filled in below' : 'Use these'}
              onPress={handleApply}
              disabled={applied}
            />
            <Text variant="caption" tone="subtle">
              Check them against the listing before sending anything. Photos and
              automatic lookup by address are not in yet.
            </Text>
          </View>
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  paste: { minHeight: 110, paddingTop: spacing.md, textAlignVertical: 'top' },
  result: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  value: { flexShrink: 1, textAlign: 'right' },
});
