import {
  filledFields,
  mergeListings,
  parseListingText,
  parseListingUrl,
} from '../listingParser';

describe('parseListingUrl', () => {
  it('reads a Zillow listing URL', () => {
    const result = parseListingUrl(
      'https://www.zillow.com/homedetails/4218-SW-12th-Pl-Cape-Coral-FL-33914/43567890_zpid/',
    );
    expect(result.address).toBe('4218 SW 12th Pl');
    expect(result.city).toBe('Cape Coral');
    expect(result.state).toBe('FL');
    expect(result.zip).toBe('33914');
  });

  it('reads a Redfin listing URL', () => {
    const result = parseListingUrl(
      'https://www.redfin.com/FL/Cape-Coral/4218-SW-12th-Pl-33914/home/12345678',
    );
    expect(result.address).toBe('4218 SW 12th Pl');
    expect(result.city).toBe('Cape Coral');
    expect(result.state).toBe('FL');
    expect(result.zip).toBe('33914');
  });

  it('reads a realtor.com listing URL', () => {
    const result = parseListingUrl(
      'https://www.realtor.com/realestateandhomes-detail/4218-SW-12th-Pl_Cape-Coral_FL_33914_M12345-67890',
    );
    expect(result.address).toBe('4218 SW 12th Pl');
    expect(result.city).toBe('Cape Coral');
    expect(result.state).toBe('FL');
    expect(result.zip).toBe('33914');
  });

  it('handles a single-word city', () => {
    const result = parseListingUrl(
      'https://www.zillow.com/homedetails/1907-Barrett-Ave-N-Ocala-FL-34473/1234_zpid/',
    );
    expect(result.city).toBe('Ocala');
    expect(result.address).toBe('1907 Barrett Ave N');
  });

  it('handles a three-word city', () => {
    const result = parseListingUrl(
      'https://www.zillow.com/homedetails/880-Palm-St-Bonita-Springs-Estates-FL-34135/1234_zpid/',
    );
    expect(result.state).toBe('FL');
    expect(result.zip).toBe('34135');
    expect(result.address).toBe('880 Palm St');
  });

  it('does not eat a city that begins with a street-type word', () => {
    // "St Petersburg" would lose half its name to the street if the split
    // looked for the last street type rather than the first.
    const result = parseListingUrl(
      'https://www.zillow.com/homedetails/123-Main-St-St-Petersburg-FL-33701/1234_zpid/',
    );
    expect(result.address).toBe('123 Main St');
    expect(result.city).toBe('St Petersburg');
  });

  it('does not end the street early on a street named after a street type', () => {
    // "123 Court St" is a real address; "Court" must not end it at index 1.
    const result = parseListingUrl(
      'https://www.zillow.com/homedetails/123-Court-St-Springfield-FL-32401/1234_zpid/',
    );
    expect(result.address).toBe('123 Court St');
    expect(result.city).toBe('Springfield');
  });

  it('returns nothing rather than guessing from an unrelated URL', () => {
    const result = parseListingUrl('https://example.com/about');
    expect(result.address).toBeNull();
    expect(result.city).toBeNull();
  });

  it('does not throw on text that is not a URL', () => {
    expect(() => parseListingUrl('not a url')).not.toThrow();
    expect(parseListingUrl('not a url').address).toBeNull();
  });

  it('rejects a two-letter segment that is not a real state', () => {
    const result = parseListingUrl(
      'https://www.zillow.com/homedetails/4218-SW-12th-Pl-Cape-Coral-ZZ-33914/1234_zpid/',
    );
    expect(result.state).toBeNull();
  });
});

describe('parseListingText', () => {
  const page = `
    4218 SW 12th Pl, Cape Coral, FL 33914
    $389,000
    3 bd | 2 ba | 1,850 sqft
    Single Family Residence, Built in 1998
    MLS# 224061883
    Listed by Dana Reyes, Gulf Coast Realty
    (239) 555-0100
    dana@gulfcoastrealty.com
  `;

  it('reads the address, city, state and ZIP from one line', () => {
    const result = parseListingText(page);
    expect(result.address).toBe('4218 SW 12th Pl');
    expect(result.city).toBe('Cape Coral');
    expect(result.state).toBe('FL');
    expect(result.zip).toBe('33914');
  });

  it('reads the price, size and age', () => {
    const result = parseListingText(page);
    expect(result.listPrice).toBe(389000);
    expect(result.beds).toBe(3);
    expect(result.baths).toBe(2);
    expect(result.sqft).toBe(1850);
    expect(result.yearBuilt).toBe(1998);
    expect(result.mls).toBe('224061883');
  });

  it('reads the agent and their contact details', () => {
    const result = parseListingText(page);
    expect(result.agentName).toBe('Dana Reyes');
    expect(result.agentPhone).toBe('(239) 555-0100');
    expect(result.agentEmail).toBe('dana@gulfcoastrealty.com');
  });

  it('normalizes phone formats to one shape', () => {
    expect(parseListingText('Call 239.555.0100 today').agentPhone).toBe('(239) 555-0100');
    expect(parseListingText('Call 2395550100').agentPhone).toBe('(239) 555-0100');
    expect(parseListingText('Call +1 239-555-0100').agentPhone).toBe('(239) 555-0100');
  });

  it('takes the headline price, not a later smaller figure', () => {
    const result = parseListingText('$389,000 asking\nHOA $1,200 per year');
    expect(result.listPrice).toBe(389000);
  });

  it('does not read a lot size as living area', () => {
    // Lot lines also say sqft; a living area of 10 is not a real reading.
    const result = parseListingText('Lot size: 10 sqft');
    expect(result.sqft).toBeNull();
  });

  it('requires a preamble before treating words as an agent name', () => {
    // A capitalised phrase on its own is not evidence of an agent.
    expect(parseListingText('Beautiful Waterfront Home').agentName).toBeNull();
    expect(parseListingText('Listing Agent: Marcus Webb').agentName).toBe('Marcus Webb');
    expect(parseListingText('Courtesy of Ana Ruiz Diaz').agentName).toBe('Ana Ruiz Diaz');
  });

  it('does not mistake a ZIP+4 or MLS number for a phone', () => {
    expect(parseListingText('33914-1234').agentPhone).toBeNull();
    expect(parseListingText('MLS# 224061883').agentPhone).toBeNull();
  });

  it('returns everything null for empty input rather than throwing', () => {
    const result = parseListingText('');
    expect(filledFields(result)).toEqual([]);
  });

  it('reads a partial page without inventing the rest', () => {
    const result = parseListingText('$250,000\n2 bd | 1 ba');
    expect(result.listPrice).toBe(250000);
    expect(result.beds).toBe(2);
    expect(result.address).toBeNull();
    expect(result.agentName).toBeNull();
  });
});

describe('mergeListings', () => {
  it('prefers the URL for address parts, since it is structured', () => {
    const fromUrl = parseListingUrl(
      'https://www.zillow.com/homedetails/4218-SW-12th-Pl-Cape-Coral-FL-33914/1234_zpid/',
    );
    const fromText = parseListingText('999 Wrong St, Nowhere, FL 00000\n$389,000');

    const merged = mergeListings(fromUrl, fromText);
    expect(merged.address).toBe('4218 SW 12th Pl');
    expect(merged.city).toBe('Cape Coral');
    // The text still supplies what the URL cannot carry.
    expect(merged.listPrice).toBe(389000);
  });

  it('falls back to the text when the URL yielded nothing', () => {
    const merged = mergeListings(
      parseListingUrl('https://example.com/x'),
      parseListingText('4218 SW 12th Pl, Cape Coral, FL 33914'),
    );
    expect(merged.address).toBe('4218 SW 12th Pl');
  });
});

describe('filledFields', () => {
  it('names only the fields that got a value', () => {
    const fields = filledFields(parseListingText('$389,000\n3 bd'));
    expect(fields).toContain('listPrice');
    expect(fields).toContain('beds');
    expect(fields).not.toContain('agentEmail');
  });
});
