import { mapLegacyExport, normalizeRatio, normalizeStatus } from '../legacyImport';

const ORG = '00000000-0000-0000-0000-000000000001';

describe('normalizeStatus', () => {
  it('accepts the prototype human labels', () => {
    expect(normalizeStatus('LOI Sent')).toBe('loi_sent');
    expect(normalizeStatus('Follow Up')).toBe('follow_up');
    expect(normalizeStatus('Buyer Rejected')).toBe('buyer_rejected');
  });

  it('accepts the stored enum values unchanged', () => {
    expect(normalizeStatus('offer_accepted')).toBe('offer_accepted');
  });

  it('maps known aliases', () => {
    expect(normalizeStatus('Accepted')).toBe('offer_accepted');
    expect(normalizeStatus('dead')).toBe('pass');
  });

  it('returns null for anything unrecognized rather than guessing', () => {
    expect(normalizeStatus('under contract')).toBeNull();
    expect(normalizeStatus(null)).toBeNull();
  });
});

describe('normalizeRatio', () => {
  it('converts a percentage to a ratio', () => {
    expect(normalizeRatio(70)).toBeCloseTo(0.7);
  });

  it('leaves a ratio alone', () => {
    expect(normalizeRatio(0.7)).toBeCloseTo(0.7);
  });

  it('passes through null', () => {
    expect(normalizeRatio(null)).toBeNull();
  });
});

describe('mapLegacyExport', () => {
  it('maps a prototype export into deal, property, comp, and analysis rows', () => {
    const result = mapLegacyExport(
      {
        deals: [
          {
            address: '123 Alpha St',
            city: 'Fort Myers',
            state: 'FL',
            zip: '33901',
            listPrice: '$300,000',
            offerPrice: 240000,
            status: 'LOI Sent',
            date: '8/31/2026',
            notes: 'Vacant, agent responsive',
            beds: 3,
            baths: 2,
            sqft: 1850,
            yearBuilt: 1998,
            listingUrl: 'https://example.com/listing',
            comps: [
              { address: '125 Alpha St', sqft: 1800, soldPrice: 310000, dist: 0.2 },
              { address: '130 Alpha St', sqft: 1900, soldPrice: 325000, dist: 0.4 },
            ],
            analyses: {
              flip: { arv: 357244, repairs: 25000, targetProfit: 50000, maoPct: 70 },
            },
          },
        ],
      },
      ORG,
    );

    expect(result.warnings).toEqual([]);
    expect(result.deals).toHaveLength(1);

    const deal = result.deals[0];
    expect(deal.org_id).toBe(ORG);
    expect(deal.address).toBe('123 Alpha St');
    // Currency formatting from the prototype is stripped, not stored as text.
    expect(deal.list_price).toBe(300000);
    expect(deal.status).toBe('loi_sent');
    expect(deal.submitted_at).toBe('2026-08-31');

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0].sqft).toBe(1850);
    expect(result.propertyDealIndex).toEqual([0]);

    expect(result.comps).toHaveLength(2);
    expect(result.comps[0].sold_price).toBe(310000);
    expect(result.compDealIndex).toEqual([0, 0]);

    expect(result.analyses).toHaveLength(1);
    expect(result.analyses[0].strategy).toBe('flip');
    expect(result.analyses[0].arv).toBe(357244);
    // 70 in the prototype means 70%, stored as a ratio.
    expect(result.analyses[0].mao_pct).toBeCloseTo(0.7);
    expect(result.analysisDealIndex).toEqual([0]);
  });

  it('accepts a bare array export', () => {
    const result = mapLegacyExport([{ address: '1 Main St' }], ORG);
    expect(result.deals).toHaveLength(1);
    expect(result.warnings).toEqual([]);
  });

  it('reports rows it cannot map instead of dropping them silently', () => {
    const result = mapLegacyExport(
      { deals: [{ city: 'Cape Coral' }, { address: '2 Main St', status: 'under contract' }] },
      ORG,
    );

    expect(result.deals).toHaveLength(1);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toMatch(/no address/i);
    expect(result.warnings[1]).toMatch(/unrecognized status/i);
    // An unmappable status still imports the deal, parked in Follow Up.
    expect(result.deals[0].status).toBe('follow_up');
  });

  it('reports an unreadable file rather than throwing', () => {
    const result = mapLegacyExport({ somethingElse: true }, ORG);
    expect(result.deals).toEqual([]);
    expect(result.warnings[0]).toMatch(/could not find a deal list/i);
  });

  it('does not write an empty property row for a deal with no facts', () => {
    const result = mapLegacyExport({ deals: [{ address: '3 Main St' }] }, ORG);
    expect(result.properties).toEqual([]);
  });
});
