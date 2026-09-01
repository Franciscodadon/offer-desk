/**
 * Reads a listing the user is already looking at - PRD 7.3 capture.
 *
 * Two inputs, neither of which fetches anything:
 *
 *   1. The URL itself. The major portals encode the full address in the path,
 *      so a pasted link yields street, city, state, and ZIP with no request to
 *      anyone. This is reading a string the user handed over, not visiting a
 *      site.
 *
 *   2. Text the user copied off the page. Price, beds, baths, size, MLS, and
 *      the agent's name and contact details are all on the page in front of
 *      them, and a person copying what they can see is not automated access.
 *
 * PRD 11 and 13 are explicit that portal pages must not be scraped - link out,
 * do not fetch - so nothing here makes a request to Zillow, Redfin, or anyone
 * else. Licensed enrichment by address is the sanctioned path for automatic
 * lookup and slots in beside this rather than replacing it.
 *
 * Every field is optional and nothing is guessed. A value that cannot be read
 * confidently is left null for the user to type, because a wrong address on an
 * LOI is worse than a blank one.
 */

export type ParsedListing = {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  listPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  mls: string | null;
  agentName: string | null;
  agentPhone: string | null;
  agentEmail: string | null;
};

export const EMPTY_LISTING: ParsedListing = {
  address: null,
  city: null,
  state: null,
  zip: null,
  listPrice: null,
  beds: null,
  baths: null,
  sqft: null,
  yearBuilt: null,
  mls: null,
  agentName: null,
  agentPhone: null,
  agentEmail: null,
};

/** Which fields actually got a value, for telling the user what was read. */
export function filledFields(listing: ParsedListing): (keyof ParsedListing)[] {
  return (Object.keys(listing) as (keyof ParsedListing)[]).filter(
    (key) => listing[key] != null && listing[key] !== '',
  );
}

export const FIELD_LABELS: Record<keyof ParsedListing, string> = {
  address: 'Address',
  city: 'City',
  state: 'State',
  zip: 'ZIP',
  listPrice: 'List price',
  beds: 'Beds',
  baths: 'Baths',
  sqft: 'Square feet',
  yearBuilt: 'Year built',
  mls: 'MLS number',
  agentName: 'Agent name',
  agentPhone: 'Agent phone',
  agentEmail: 'Agent email',
};

const STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]);

/** Turns "4218-SW-12th-Pl" into "4218 SW 12th Pl". */
function unslug(part: string): string {
  return part
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Street-type words, which are what mark where an address ends and a city
 * begins in a portal's hyphenated path.
 */
const STREET_SUFFIXES = new Set([
  'st','street','ave','avenue','rd','road','dr','drive','ln','lane','ct','court','pl','place',
  'blvd','boulevard','ter','terrace','cir','circle','way','pkwy','parkway','hwy','highway',
  'trl','trail','loop','run','path','pike','plz','plaza','sq','square','xing','crossing','bnd',
  'bend','cv','cove','pt','point','ldg','landing','mnr','manor','row','walk','row',
]);

const DIRECTIONALS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);

/**
 * Splits "4218 SW 12th Pl Cape Coral" into its street and its city.
 *
 * The street ends at its type word, so the first one is the boundary. It has to
 * be the first rather than the last: "123 Main St St Petersburg" would
 * otherwise put half the city into the street. Index 2 is the earliest a type
 * word can legitimately appear, which keeps a street actually named "Court" or
 * "Park" from ending the address one word early.
 *
 * A directional immediately after the type word belongs to the street, so
 * "1907 Barrett Ave N Ocala" keeps its N.
 */
function splitStreetAndCity(
  words: string[],
): { street: string[]; city: string[] } | null {
  const normalized = words.map((word) => word.toLowerCase().replace(/\.$/, ''));

  for (let i = 2; i < words.length - 1; i += 1) {
    if (!STREET_SUFFIXES.has(normalized[i])) continue;

    let end = i;
    if (i + 1 < words.length - 1 && DIRECTIONALS.has(normalized[i + 1])) end = i + 1;

    const street = words.slice(0, end + 1);
    const city = words.slice(end + 1);
    if (street.length === 0 || city.length === 0) continue;
    return { street, city };
  }

  // No recognizable street type. Rather than guess where the city starts,
  // take the last word only, which is right for the common single-word case
  // and leaves the user to correct the rest.
  if (words.length >= 3) {
    return { street: words.slice(0, -1), city: words.slice(-1) };
  }
  return null;
}

/**
 * Pulls the address out of a listing URL's path.
 *
 * Handles the shapes the three big portals use. An unrecognized host still
 * gets a best effort, because many brokerage sites follow the same convention,
 * and anything ambiguous simply returns nulls.
 */
export function parseListingUrl(input: string): ParsedListing {
  const result = { ...EMPTY_LISTING };

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return result;
  }

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length === 0) return result;

  // realtor.com: /realestateandhomes-detail/4218-SW-12th-Pl_Cape-Coral_FL_33914_M00000
  const underscored = segments.find((segment) => segment.split('_').length >= 4);
  if (underscored) {
    const parts = underscored.split('_');
    const [street, city, state, zip] = parts;
    if (state && STATES.has(state.toUpperCase())) {
      result.address = unslug(street);
      result.city = unslug(city);
      result.state = state.toUpperCase();
      if (/^\d{5}$/.test(zip)) result.zip = zip;
      return result;
    }
  }

  // zillow: /homedetails/4218-SW-12th-Pl-Cape-Coral-FL-33914/00000_zpid/
  // Also matches any hyphenated segment ending in ...-STATE-ZIP.
  for (const segment of segments) {
    const match = segment.match(/^(.*)-([A-Za-z]{2})-(\d{5})$/);
    if (!match) continue;

    const [, head, state, zip] = match;
    if (!STATES.has(state.toUpperCase())) continue;

    const words = head.split('-').filter(Boolean);
    if (words.length < 2) continue;

    const split = splitStreetAndCity(words);
    if (!split) continue;

    result.address = unslug(split.street.join('-'));
    result.city = unslug(split.city.join('-'));
    result.state = state.toUpperCase();
    result.zip = zip;
    return result;
  }

  // redfin: /FL/Cape-Coral/4218-SW-12th-Pl-33914/home/00000
  const stateIndex = segments.findIndex((segment) => STATES.has(segment.toUpperCase()) && segment.length === 2);
  if (stateIndex !== -1 && segments.length > stateIndex + 2) {
    const city = segments[stateIndex + 1];
    const streetSegment = segments[stateIndex + 2];
    const zipMatch = streetSegment.match(/^(.*)-(\d{5})$/);

    if (zipMatch) {
      result.address = unslug(zipMatch[1]);
      result.zip = zipMatch[2];
    } else {
      result.address = unslug(streetSegment);
    }
    result.city = unslug(city);
    result.state = segments[stateIndex].toUpperCase();
    return result;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pasted page text
// ---------------------------------------------------------------------------

function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(/[$,\s]/g, ''));
  return Number.isFinite(value) ? value : null;
}

/** Formats a run of digits as (239) 555-0100, leaving anything else alone. */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  if (digits.length !== 10) return raw.trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Reads what a copied listing page says. Deliberately conservative: each field
 * has a specific pattern, and anything that does not match is left null rather
 * than approximated.
 */
export function parseListingText(text: string): ParsedListing {
  const result = { ...EMPTY_LISTING };
  if (!text || text.trim().length === 0) return result;

  const flat = text.replace(/ /g, ' ');

  // Address, city, state, ZIP on one line, which is how every portal prints it.
  const addressMatch = flat.match(
    /(\d+[^,\n]{2,60}?),\s*([A-Za-z .'-]{2,40}),\s*([A-Za-z]{2})\s*(\d{5})(?:-\d{4})?/,
  );
  if (addressMatch && STATES.has(addressMatch[3].toUpperCase())) {
    result.address = addressMatch[1].trim();
    result.city = addressMatch[2].trim();
    result.state = addressMatch[3].toUpperCase();
    result.zip = addressMatch[4];
  }

  // Price: the first figure that reads like one, so a "$1,200 HOA" line further
  // down cannot win over the headline number.
  const priceMatch = flat.match(/\$\s?([\d,]{5,12})(?!\s*\/)/);
  const price = toNumber(priceMatch?.[1]);
  if (price != null && price >= 1000) result.listPrice = price;

  const bedsMatch = flat.match(/(\d+(?:\.\d)?)\s*(?:bd\b|beds?\b|bedrooms?\b)/i);
  result.beds = toNumber(bedsMatch?.[1]);

  const bathsMatch = flat.match(/(\d+(?:\.\d)?)\s*(?:ba\b|baths?\b|bathrooms?\b)/i);
  result.baths = toNumber(bathsMatch?.[1]);

  const sqftMatch = flat.match(/([\d,]{3,7})\s*(?:sq\.?\s?ft|sqft|square feet)/i);
  const sqft = toNumber(sqftMatch?.[1]);
  // Lot sizes also carry "sqft"; a living area under 200 is not one.
  if (sqft != null && sqft >= 200) result.sqft = sqft;

  const yearMatch = flat.match(/(?:built in|year built)[:\s]*((?:18|19|20)\d{2})/i);
  result.yearBuilt = toNumber(yearMatch?.[1]);

  const mlsMatch = flat.match(/MLS\s*#?\s*:?\s*([A-Z0-9-]{5,20})/i);
  if (mlsMatch) result.mls = mlsMatch[1].toUpperCase();

  // Agent name follows one of the standard preambles. Requiring the preamble
  // keeps a random capitalised phrase from becoming the agent.
  const agentMatch = flat.match(
    /(?:listed by|listing agent|listing provided by|courtesy of|presented by)[:\s]*\s*([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/i,
  );
  if (agentMatch) result.agentName = agentMatch[1].trim();

  const emailMatch = flat.match(/[\w.+-]+@[\w-]+\.[\w.]{2,}/);
  if (emailMatch) result.agentEmail = emailMatch[0].toLowerCase();

  const phoneMatch = flat.match(
    /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  );
  if (phoneMatch) {
    const normalized = normalizePhone(phoneMatch[0]);
    // A ZIP+4 or an MLS number can look like a phone; require 10 digits.
    if (/^\(\d{3}\) \d{3}-\d{4}$/.test(normalized)) result.agentPhone = normalized;
  }

  return result;
}

/**
 * Combines a URL read and a text read, preferring whichever has the value.
 * The URL wins on address parts: it is structured data rather than a guess at
 * where a line break fell.
 */
export function mergeListings(
  fromUrl: ParsedListing,
  fromText: ParsedListing,
): ParsedListing {
  const merged = { ...EMPTY_LISTING };

  for (const key of Object.keys(merged) as (keyof ParsedListing)[]) {
    const urlValue = fromUrl[key];
    const textValue = fromText[key];
    (merged as Record<string, unknown>)[key] = urlValue ?? textValue ?? null;
  }

  return merged;
}
