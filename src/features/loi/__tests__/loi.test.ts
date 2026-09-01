import { renderTemplate, type MergeContext, type LoiTerms } from '../mergeFields';
import {
  DEFAULT_VARIANT,
  EMAIL_BODY_TEMPLATE,
  EMAIL_SUBJECT_TEMPLATE,
  suggestVariant,
  templateFor,
  type LoiOccupancy,
  type LoiPricing,
} from '../templates';

const terms: LoiTerms = {
  purchasePrice: 240000,
  earnestMoney: 1000,
  inspectionDays: 10,
  closeDays: 21,
  additionalTerms: '',
  letterDate: '2026-09-01',
  offerValidDays: 5,
};

const context = (over: Partial<MergeContext> = {}): MergeContext => ({
  org: {
    name: 'Deo Volente',
    buyer_entity: 'Deo Volente LLC',
    signatory_name: 'Francisco Caballero Jr.',
    signatory_title: 'Acquisitions Manager',
    logo_url: null,
  },
  deal: {
    address: '4218 SW 12th Place',
    city: 'Cape Coral',
    state: 'FL',
    zip: '33914',
    parcel_id: null,
    mls: null,
    list_price: 300000,
  },
  property: { beds: 3, baths: 2, sqft: 1850, year_built: 1998, is_vacant: true },
  agent: {
    name: 'Dana Reyes',
    brokerage: 'Gulf Coast Realty',
    email: 'dana@gulfcoast.com',
    phone: null,
  },
  terms,
  ...over,
});

describe('renderTemplate', () => {
  it('fills every placeholder with formatted values', () => {
    const result = renderTemplate(templateFor(DEFAULT_VARIANT), context());

    expect(result.text).toContain('Dana Reyes');
    expect(result.text).toContain('Deo Volente LLC');
    expect(result.text).toContain('4218 SW 12th Place, Cape Coral, FL 33914');
    // Money is formatted at merge time, so templates never handle units.
    expect(result.text).toContain('$240,000');
    expect(result.text).toContain('$1,000');
    expect(result.text).toContain('Sep 1, 2026');
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('leaves no unfilled placeholder in the output', () => {
    const result = renderTemplate(templateFor(DEFAULT_VARIANT), context());
    // The failure that actually reaches an agent.
    expect(result.text).not.toMatch(/\{\{|\}\}/);
  });

  it('reports a missing required field and refuses to call the letter complete', () => {
    const result = renderTemplate(
      templateFor(DEFAULT_VARIANT),
      context({ terms: { ...terms, purchasePrice: null } }),
    );

    expect(result.complete).toBe(false);
    expect(result.missing.map((field) => field.key)).toContain('purchase_price');
    expect(result.missing.find((f) => f.key === 'purchase_price')?.required).toBe(true);
  });

  it('stays sendable when only an optional field is missing', () => {
    const result = renderTemplate(
      templateFor(DEFAULT_VARIANT),
      context({
        agent: { name: 'Dana Reyes', brokerage: null, email: null, phone: null },
      }),
    );
    expect(result.complete).toBe(true);
  });

  it('never invents a value for a missing field', () => {
    const result = renderTemplate(
      '{{purchase_price}}',
      context({ terms: { ...terms, purchasePrice: null } }),
    );
    expect(result.text).toBe('');
    expect(result.text).not.toContain('$0');
  });

  it('strips an unknown placeholder rather than shipping it, and reports it', () => {
    const result = renderTemplate('Offer from {{buyer_entty}} today.', context());
    expect(result.text).toBe('Offer from today.');
    expect(result.unknownFields).toEqual(['buyer_entty']);
  });

  it('tidies the whitespace a removed field leaves behind', () => {
    const result = renderTemplate(
      'Sold by {{agent_brokerage}} , see MLS {{mls}}.',
      context({
        agent: { name: 'Dana', brokerage: null, email: null, phone: null },
      }),
    );
    expect(result.text).not.toContain('  ');
    expect(result.text).not.toContain(' ,');
  });

  it('is case insensitive and tolerates spacing inside the braces', () => {
    const result = renderTemplate('{{ PURCHASE_PRICE }}', context());
    expect(result.text).toBe('$240,000');
  });

  it('reports each missing field once even when used repeatedly', () => {
    const result = renderTemplate(
      '{{purchase_price}} and again {{purchase_price}}',
      context({ terms: { ...terms, purchasePrice: null } }),
    );
    expect(result.missing).toHaveLength(1);
  });
});

describe('templates', () => {
  const variants: { occupancy: LoiOccupancy; pricing: LoiPricing }[] = [
    { occupancy: 'vacant', pricing: 'priced' },
    { occupancy: 'vacant', pricing: 'preliminary' },
    { occupancy: 'occupied', pricing: 'priced' },
    { occupancy: 'occupied', pricing: 'preliminary' },
  ];

  it.each(variants)('renders %o completely from a full context', (variant) => {
    const result = renderTemplate(templateFor(variant), context());
    expect(result.complete).toBe(true);
    expect(result.unknownFields).toEqual([]);
    expect(result.text).not.toMatch(/\{\{/);
  });

  it.each(variants)('states plainly that %o is non-binding', (variant) => {
    // PRD 13 requires it, and it is what keeps this a letter of intent rather
    // than an accidental contract.
    const result = renderTemplate(templateFor(variant), context());
    expect(result.text.toLowerCase()).toContain('non-binding');
  });

  it.each(variants)('uses no em dashes in %o, per house style', (variant) => {
    const result = renderTemplate(templateFor(variant), context());
    expect(result.text).not.toContain('—');
  });

  it('says the property is vacant only in the vacant variants', () => {
    const vacant = renderTemplate(
      templateFor({ occupancy: 'vacant', pricing: 'priced' }),
      context(),
    ).text;
    const occupied = renderTemplate(
      templateFor({ occupancy: 'occupied', pricing: 'priced' }),
      context(),
    ).text;

    expect(vacant).toContain('vacant');
    expect(occupied).toContain('occupied');
    expect(occupied).toContain('leases');
  });

  it('frames a preliminary price as subject to inspection', () => {
    const preliminary = renderTemplate(
      templateFor({ occupancy: 'vacant', pricing: 'preliminary' }),
      context(),
    ).text;
    expect(preliminary).toContain('subject to inspection');
  });

  it('promises no financing contingency in every variant', () => {
    for (const variant of variants) {
      const text = renderTemplate(templateFor(variant), context()).text;
      expect(text.toLowerCase()).toContain('cash');
    }
  });
});

describe('document structure', () => {
  const variants: { occupancy: LoiOccupancy; pricing: LoiPricing }[] = [
    { occupancy: 'vacant', pricing: 'priced' },
    { occupancy: 'vacant', pricing: 'preliminary' },
    { occupancy: 'occupied', pricing: 'priced' },
    { occupancy: 'occupied', pricing: 'preliminary' },
  ];

  /**
   * Line breaks inside a block are preserved in the rendered document, so a
   * hard-wrapped paragraph in a template comes out broken mid-sentence in the
   * PDF. Every paragraph must therefore live on one source line, and only
   * deliberate breaks (the address block, the terms list, the signature) may
   * span lines. This is the defect that shipped a ragged letter once already.
   */
  it.each(variants)('keeps every prose paragraph on one source line in %o', (variant) => {
    const blocks = templateFor(variant).split(/\n\s*\n/);

    for (const block of blocks) {
      const lines = block.split('\n').filter((line) => line.trim().length > 0);
      if (lines.length < 2) continue;

      const isTermsList = lines.every((line) => /^[A-Z][^:]{2,40}:\s/.test(line.trim()));
      const isShortLineBlock = lines.every((line) => line.trim().length < 60);

      // Anything else is a wrapped paragraph, which would render broken.
      expect(isTermsList || isShortLineBlock).toBe(true);
    }
  });

  it.each(variants)('puts each term of %o on its own line', (variant) => {
    const text = renderTemplate(templateFor(variant), context()).text;
    const termLines = text
      .split('\n')
      .filter((line) => /^(Purchase price|Closing|Financing|Inspection period):/.test(line.trim()));
    // If terms were wrapped, these would not each start a line.
    expect(termLines.length).toBeGreaterThanOrEqual(4);
  });
});

describe('suggestVariant', () => {
  it('starts from what the deal already knows', () => {
    expect(suggestVariant(true, true)).toEqual({ occupancy: 'vacant', pricing: 'priced' });
    expect(suggestVariant(false, true)).toEqual({ occupancy: 'occupied', pricing: 'priced' });
    expect(suggestVariant(true, false)).toEqual({
      occupancy: 'vacant',
      pricing: 'preliminary',
    });
  });

  it('treats unknown occupancy as vacant rather than guessing tenants', () => {
    // Claiming occupants that do not exist reads worse than the reverse.
    expect(suggestVariant(null, true).occupancy).toBe('vacant');
  });
});

describe('outreach email', () => {
  it('renders a subject and body from the same context', () => {
    const subject = renderTemplate(EMAIL_SUBJECT_TEMPLATE, context());
    const body = renderTemplate(EMAIL_BODY_TEMPLATE, context());

    expect(subject.text).toBe('Offer on 4218 SW 12th Place from Deo Volente LLC');
    expect(subject.complete).toBe(true);
    expect(body.text).toContain('Dana Reyes');
    expect(body.text).toContain('$240,000');
    expect(body.text).not.toMatch(/\{\{/);
    expect(body.text).not.toContain('—');
  });
});
